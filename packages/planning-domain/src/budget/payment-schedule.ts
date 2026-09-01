import { createPlanningId } from "../ids";
import { getItemPlanningCost, getPaymentStatus } from "./calculations";
import type {
  BudgetItem,
  PaymentInstallment,
  PaymentInstallmentKind,
} from "./types";

export type PaymentScheduleIssueCode =
  | "too_many_installments"
  | "missing_installment_id"
  | "duplicate_installment_id"
  | "missing_label"
  | "invalid_due_date"
  | "invalid_paid_date"
  | "paid_without_payment"
  | "paid_exceeds_installment"
  | "item_cost_required"
  | "scheduled_exceeds_item_cost"
  | "paid_exceeds_item_cost"
  | "payment_total_mismatch"
  | "deposit_total_mismatch"
  | "due_date_mismatch"
  | "payment_status_mismatch"
  | "cost_status_mismatch";

export type PaymentScheduleIssue = Readonly<{
  code: PaymentScheduleIssueCode;
  installmentId: string | null;
  message: string;
}>;

const KIND_LABELS: Record<PaymentInstallmentKind, string> = {
  deposit: "Deposit",
  installment: "Instalment",
  final: "Final balance",
  other: "Payment",
};

export function createPaymentInstallment(
  kind: PaymentInstallmentKind = "installment",
  id = createPlanningId(),
): PaymentInstallment {
  return {
    id,
    kind,
    label: KIND_LABELS[kind],
    amountPence: null,
    paidPence: 0,
    dueDate: null,
    paidAt: null,
  };
}

export function getEditablePaymentInstallments(item: BudgetItem): PaymentInstallment[] {
  if (item.installments.length > 0) {
    return item.installments.map((installment) => ({ ...installment }));
  }

  const installments: PaymentInstallment[] = [];
  if (item.depositPaidPence > 0) {
    installments.push({
      ...createPaymentInstallment("deposit", legacyInstallmentId(item.id, "deposit")),
      amountPence: item.depositPaidPence,
      paidPence: item.depositPaidPence,
    });
  }
  const otherPaid = Math.max(item.totalPaidPence - item.depositPaidPence, 0);
  if (otherPaid > 0) {
    installments.push({
      ...createPaymentInstallment("other", legacyInstallmentId(item.id, "paid")),
      label: "Payment already recorded",
      amountPence: otherPaid,
      paidPence: otherPaid,
    });
  }
  if (item.dueDate) {
    installments.push({
      ...createPaymentInstallment("installment", legacyInstallmentId(item.id, "due")),
      label: "Next payment",
      dueDate: item.dueDate,
    });
  }
  return installments;
}

export function getPaymentScheduleTotals(installments: PaymentInstallment[]) {
  let scheduledPence = 0;
  let paidPence = 0;
  let unknownAmountCount = 0;
  for (const installment of installments) {
    if (installment.amountPence === null) unknownAmountCount += 1;
    else scheduledPence += installment.amountPence;
    paidPence += installment.paidPence;
  }
  return { scheduledPence, paidPence, unknownAmountCount } as const;
}

export function getPaymentScheduleFingerprint(installments: PaymentInstallment[]) {
  return JSON.stringify(installments.map((installment) => [
    installment.id,
    installment.kind,
    installment.label.trim(),
    installment.amountPence,
    installment.paidPence,
    installment.dueDate,
    installment.paidAt,
  ]));
}

export function getPaymentScheduleValidationFingerprint(item: BudgetItem) {
  return JSON.stringify([
    getItemPlanningCost(item).amountPence,
    getPaymentScheduleFingerprint(item.installments),
    item.depositPaidPence,
    item.totalPaidPence,
    item.dueDate,
    item.paymentStatus,
    item.costStatus,
    item.bookingStatus,
  ]);
}

export function validatePaymentSchedule(
  item: BudgetItem,
  installments: PaymentInstallment[],
): PaymentScheduleIssue[] {
  const issues: PaymentScheduleIssue[] = [];
  const seenIds = new Set<string>();
  if (installments.length > 50) {
    issues.push(issue("too_many_installments", null, "A payment schedule can contain up to 50 payments."));
  }

  for (const installment of installments) {
    if (!installment.id.trim()) {
      issues.push(issue(
        "missing_installment_id",
        null,
        "Each payment must have a stable identifier.",
      ));
    } else if (seenIds.has(installment.id)) {
      issues.push(issue(
        "duplicate_installment_id",
        installment.id,
        "Each payment must have a unique identifier.",
      ));
    }
    if (installment.id.trim()) seenIds.add(installment.id);
    if (!installment.label.trim()) {
      issues.push(issue("missing_label", installment.id, "Give each payment a label."));
    }
    if (installment.dueDate !== null && !isIsoCalendarDate(installment.dueDate)) {
      issues.push(issue(
        "invalid_due_date",
        installment.id,
        "Enter the due date as a real date in YYYY-MM-DD format.",
      ));
    }
    if (installment.paidAt !== null && !isIsoCalendarDate(installment.paidAt)) {
      issues.push(issue(
        "invalid_paid_date",
        installment.id,
        "Enter the paid date as a real date in YYYY-MM-DD format.",
      ));
    }
    if (installment.paidAt !== null && installment.paidPence === 0) {
      issues.push(issue(
        "paid_without_payment",
        installment.id,
        "Remove the paid date or enter the amount that was paid.",
      ));
    }
    if (
      installment.amountPence !== null
      && installment.paidPence > installment.amountPence
    ) {
      issues.push(issue(
        "paid_exceeds_installment",
        installment.id,
        "The amount paid cannot exceed this payment's expected amount.",
      ));
    }
  }

  const totals = getPaymentScheduleTotals(installments);
  const costPence = getPaymentValidationCost(item);
  if (costPence === null && (totals.scheduledPence > 0 || totals.paidPence > 0)) {
    issues.push(issue(
      "item_cost_required",
      null,
      "Add an estimated or quoted item cost before recording payment amounts.",
    ));
  }
  if (costPence !== null) {
    if (totals.scheduledPence > costPence) {
      issues.push(issue(
        "scheduled_exceeds_item_cost",
        null,
        "Scheduled payments cannot exceed the recorded item cost.",
      ));
    }
    if (totals.paidPence > costPence) {
      issues.push(issue(
        "paid_exceeds_item_cost",
        null,
        "The total paid cannot exceed the recorded item cost.",
      ));
    }
  }
  return issues;
}

export function validatePersistedPaymentSchedule(item: BudgetItem) {
  const issues = validatePaymentSchedule(item, item.installments);
  if (item.installments.length === 0) return issues;

  const totals = getPaymentScheduleTotals(item.installments);
  const depositPaidPence = item.installments
    .filter((installment) => installment.kind === "deposit")
    .reduce((total, installment) => total + installment.paidPence, 0);
  const nextDueDate = item.installments
    .filter((installment) => (
      installment.dueDate
      && (installment.amountPence === null || installment.paidPence < installment.amountPence)
    ))
    .map((installment) => installment.dueDate as string)
    .sort()[0] ?? null;
  const costPence = getPaymentValidationCost(item);
  const calculatedPaymentStatus = getPaymentStatus(costPence, totals.paidPence);
  const paymentStatus: BudgetItem["paymentStatus"] =
    calculatedPaymentStatus === "partially_paid"
      && depositPaidPence > 0
      && totals.paidPence === depositPaidPence
      ? "deposit_paid"
      : calculatedPaymentStatus;
  const costStatus: BudgetItem["costStatus"] = item.bookingStatus === "cancelled"
    ? "cancelled"
    : paymentStatus === "paid" || paymentStatus === "overpaid"
      ? "paid"
      : totals.paidPence > 0
        ? depositPaidPence > 0 && totals.paidPence === depositPaidPence
          ? "deposit_paid"
          : "partially_paid"
        : item.bookingStatus === "booked"
          ? "booked"
          : item.bookingStatus === "quoted"
            ? "quoted"
            : "estimated";

  if (item.totalPaidPence !== totals.paidPence) {
    issues.push(issue(
      "payment_total_mismatch",
      null,
      "The recorded total paid must match the payment schedule.",
    ));
  }
  if (item.depositPaidPence !== depositPaidPence) {
    issues.push(issue(
      "deposit_total_mismatch",
      null,
      "The recorded deposit total must match deposit payments.",
    ));
  }
  if (item.dueDate !== nextDueDate) {
    issues.push(issue(
      "due_date_mismatch",
      null,
      "The next payment deadline must match the payment schedule.",
    ));
  }
  if (item.paymentStatus !== paymentStatus) {
    issues.push(issue(
      "payment_status_mismatch",
      null,
      "The payment status must match the payment schedule.",
    ));
  }
  if (item.costStatus !== costStatus) {
    issues.push(issue(
      "cost_status_mismatch",
      null,
      "The cost status must match the payment schedule.",
    ));
  }
  return issues;
}

function issue(
  code: PaymentScheduleIssueCode,
  installmentId: string | null,
  message: string,
): PaymentScheduleIssue {
  return { code, installmentId, message };
}

function legacyInstallmentId(itemId: string, suffix: "deposit" | "paid" | "due") {
  return `legacy-${suffix}-${itemId.slice(0, 80)}`;
}

function getPaymentValidationCost(item: BudgetItem) {
  if (item.bookingStatus !== "cancelled" && item.costStatus !== "cancelled") {
    return getItemPlanningCost(item).amountPence;
  }
  if (item.confirmedCostPence !== null) return item.confirmedCostPence;
  if (item.estimatedCostPence !== null) return item.estimatedCostPence;
  if (item.costPerPersonPence !== null && item.guestCount !== null) {
    return item.costPerPersonPence * item.guestCount;
  }
  return null;
}

function isIsoCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
