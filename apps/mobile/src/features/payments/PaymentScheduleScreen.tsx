import {
  createPaymentInstallment,
  getEditablePaymentInstallments,
  getPaymentScheduleFingerprint,
  getPaymentScheduleTotals,
  validatePaymentSchedule,
} from "@everaft/planning-domain/budget/payment-schedule";
import {
  formatMoney,
  getItemPlanningCost,
  parseMoneyToPence,
} from "@everaft/planning-domain/budget/calculations";
import type {
  BudgetItem,
  PaymentInstallment,
  PaymentInstallmentKind,
} from "@everaft/planning-domain/budget/types";
import { getPlanningHubDateKey } from "@everaft/planning-domain/planning-hub/date";
import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { type AppColors, radius, spacing, typography } from "../../design/tokens";
import { useAppTheme } from "../../design/use-app-theme";
import type { DevicePlanData } from "../../planning/device-plan-model";
import { withDevicePaymentSchedule } from "../../planning/payment-reliability";

export type PaymentScheduleSaveResult = Readonly<{
  outcome: "connected" | "device_only" | "needs_attention";
  failure?: "offline" | "unavailable" | "conflict";
}>;

type PaymentScheduleScreenProps = Readonly<{
  data: DevicePlanData;
  initialItemId?: string | null;
  onBack(): void;
  onSave(data: DevicePlanData): Promise<PaymentScheduleSaveResult>;
  referenceDate?: Date;
}>;

type PaymentDraftState = Readonly<{
  baselineFingerprint: string;
  installments: PaymentInstallment[];
}>;

const ITEM_BATCH_SIZE = 10;
const PAYMENT_KINDS: PaymentInstallmentKind[] = [
  "deposit",
  "installment",
  "final",
  "other",
];

export function PaymentScheduleScreen({
  data,
  initialItemId = null,
  onBack,
  onSave,
  referenceDate = new Date(),
}: PaymentScheduleScreenProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const items = useMemo(() => data.budgetPlan.items.filter((item) => (
    item.bookingStatus !== "cancelled" && item.costStatus !== "cancelled"
  )), [data.budgetPlan.items]);
  const initialSelection = initialItemId ?? items[0]?.id ?? null;
  const [requestedItemId, setRequestedItemId] = useState(initialSelection);
  const [visibleItemCount, setVisibleItemCount] = useState(ITEM_BATCH_SIZE);
  const selectedItem = items.find(({ id }) => id === requestedItemId) ?? items[0] ?? null;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to plan</Text>
        </Pressable>
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>YOUR PLAN</Text>
          <Text accessibilityRole="header" style={styles.title}>Payments &amp; instalments</Text>
          <Text style={styles.body}>
            Record real payment terms and what you have paid. EverAft updates your totals and next deadline from this schedule.
          </Text>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text accessibilityRole="header" style={styles.cardTitle}>No planned costs yet</Text>
            <Text style={styles.body}>Shortlist or add a venue or supplier before recording payments.</Text>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Choose a cost</Text>
              {items.slice(0, visibleItemCount).map((item) => {
                const selected = item.id === selectedItem?.id;
                return (
                  <Pressable
                    accessibilityLabel={`${item.itemName}, ${paymentSummary(item, data.budgetPlan.currency)}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={item.id}
                    onPress={() => setRequestedItemId(item.id)}
                    style={[styles.itemButton, selected && styles.itemButtonSelected]}
                  >
                    <Text style={styles.itemName}>{item.itemName}</Text>
                    <Text style={styles.itemMeta}>{paymentSummary(item, data.budgetPlan.currency)}</Text>
                  </Pressable>
                );
              })}
              {visibleItemCount < items.length ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setVisibleItemCount((count) => count + ITEM_BATCH_SIZE)}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Show more costs</Text>
                </Pressable>
              ) : null}
            </View>

            {selectedItem ? (
              <PaymentItemEditor
                currency={data.budgetPlan.currency}
                data={data}
                item={selectedItem}
                key={selectedItem.id}
                onSave={onSave}
                referenceDate={referenceDate}
                styles={styles}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PaymentItemEditor({
  currency,
  data,
  item,
  onSave,
  referenceDate,
  styles,
}: Readonly<{
  currency: string;
  data: DevicePlanData;
  item: BudgetItem;
  onSave(data: DevicePlanData): Promise<PaymentScheduleSaveResult>;
  referenceDate: Date;
  styles: PaymentStyles;
}>) {
  const incomingInstallments = useMemo(() => getEditablePaymentInstallments(item), [item]);
  const incomingFingerprint = useMemo(
    () => getPaymentScheduleFingerprint(incomingInstallments),
    [incomingInstallments],
  );
  const [draftState, setDraftState] = useState<PaymentDraftState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const activeDraft = getActivePaymentDraft(
    draftState,
    incomingFingerprint,
  );
  const installments = activeDraft?.installments ?? incomingInstallments;
  const externalChange = activeDraft !== null
    && incomingFingerprint !== activeDraft.baselineFingerprint;
  const totals = useMemo(() => getPaymentScheduleTotals(installments), [installments]);
  const itemCost = getItemPlanningCost(item).amountPence;
  const paidToday = getPlanningHubDateKey(referenceDate);

  const updateInstallments = useCallback((
    update: (current: PaymentInstallment[]) => PaymentInstallment[],
  ) => {
    setDraftState((current) => {
      const active = getActivePaymentDraft(
        current,
        incomingFingerprint,
      );
      return {
        baselineFingerprint: active?.baselineFingerprint ?? incomingFingerprint,
        installments: update(active?.installments ?? incomingInstallments),
      };
    });
  }, [incomingFingerprint, incomingInstallments]);

  function addPayment() {
    if (installments.length >= 50) {
      setMessage("A payment schedule can contain up to 50 payments.");
      return;
    }
    updateInstallments((current) => [...current, createPaymentInstallment()]);
    setMessage(null);
  }

  const updatePayment = useCallback((id: string, changes: Partial<PaymentInstallment>) => {
    updateInstallments((current) => current.map((installment) => (
      installment.id === id ? { ...installment, ...changes } : installment
    )));
    setMessage(null);
  }, [updateInstallments]);

  const removePayment = useCallback((id: string) => {
    updateInstallments((current) => current.filter((installment) => installment.id !== id));
    setMessage(null);
  }, [updateInstallments]);

  async function save() {
    if (externalChange) {
      setMessage("My EverAft changed while you were editing. Load the latest schedule before saving.");
      return;
    }
    const issues = validatePaymentSchedule(item, installments);
    if (issues.length > 0) {
      setMessage(issues[0].message);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await onSave(withDevicePaymentSchedule(data, item.id, installments));
      setMessage(saveMessage(result));
    } catch {
      setMessage("This schedule is still on screen, but EverAft could not save it. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function loadLatestSchedule() {
    setDraftState(null);
    setMessage("Latest My EverAft payment schedule loaded.");
  }

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{item.itemName}</Text>
      <View accessible accessibilityLabel={`Payment summary. Cost ${itemCost === null ? "not set" : formatMoney(itemCost, currency)}. Scheduled ${formatMoney(totals.scheduledPence, currency)}. Paid ${formatMoney(totals.paidPence, currency)}.`} style={styles.summaryGrid}>
        <Metric label="Cost" styles={styles} value={itemCost === null ? "Not set" : formatMoney(itemCost, currency)} />
        <Metric label="Scheduled" styles={styles} value={formatMoney(totals.scheduledPence, currency)} />
        <Metric label="Paid" styles={styles} value={formatMoney(totals.paidPence, currency)} />
        <Metric label="Amounts TBC" styles={styles} value={String(totals.unknownAmountCount)} />
      </View>

      {installments.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.body}>No payments recorded for this cost yet.</Text>
        </View>
      ) : installments.map((installment, index) => (
        <PaymentRow
          index={index}
          installment={installment}
          key={installment.id}
          onChange={updatePayment}
          onRemove={removePayment}
          paidToday={paidToday}
          styles={styles}
        />
      ))}

      <Pressable accessibilityRole="button" onPress={addPayment} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Add payment</Text>
      </Pressable>
      {externalChange || message ? (
        <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.message}>
          {externalChange
            ? "My EverAft changed while you were editing. Load the latest schedule before saving."
            : message}
        </Text>
      ) : null}
      {externalChange ? (
        <Pressable accessibilityRole="button" onPress={loadLatestSchedule} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Load latest schedule</Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy, disabled: busy }}
        disabled={busy}
        onPress={() => void save()}
        style={[styles.primaryButton, busy && styles.disabledButton]}
      >
        <Text style={styles.primaryButtonText}>{busy ? "Saving…" : "Save payment schedule"}</Text>
      </Pressable>
    </View>
  );
}

function getActivePaymentDraft(
  draft: PaymentDraftState | null,
  incomingFingerprint: string,
) {
  if (draft === null) return null;
  const draftFingerprint = getPaymentScheduleFingerprint(draft.installments);
  if (
    incomingFingerprint !== draft.baselineFingerprint
    && (
      draftFingerprint === draft.baselineFingerprint
      || draftFingerprint === incomingFingerprint
    )
  ) {
    return null;
  }
  return draft;
}

const PaymentRow = memo(function PaymentRow({
  index,
  installment,
  onChange,
  onRemove,
  paidToday,
  styles,
}: Readonly<{
  index: number;
  installment: PaymentInstallment;
  onChange(id: string, changes: Partial<PaymentInstallment>): void;
  onRemove(id: string): void;
  paidToday: string;
  styles: PaymentStyles;
}>) {
  const number = index + 1;
  return (
    <View style={styles.paymentCard}>
      <View style={styles.rowBetween}>
        <Text accessibilityRole="header" style={styles.cardTitle}>Payment {number}</Text>
        <Pressable
          accessibilityLabel={`Remove payment ${number}`}
          accessibilityRole="button"
          onPress={() => onRemove(installment.id)}
          style={styles.smallButton}
        >
          <Text style={styles.dangerText}>Remove</Text>
        </Pressable>
      </View>

      <Text style={styles.fieldLabel}>Payment type</Text>
      <View accessibilityRole="radiogroup" style={styles.kindRow}>
        {PAYMENT_KINDS.map((kind) => (
          <Pressable
            accessibilityLabel={kindLabel(kind)}
            accessibilityRole="radio"
            accessibilityState={{ checked: installment.kind === kind }}
            key={kind}
            onPress={() => onChange(installment.id, { kind })}
            style={[styles.kindButton, installment.kind === kind && styles.kindButtonSelected]}
          >
            <Text style={[styles.kindText, installment.kind === kind && styles.kindTextSelected]}>{kindLabel(kind)}</Text>
          </Pressable>
        ))}
      </View>

      <Field label={`Payment ${number} label`} styles={styles}>
        <TextInput
          accessibilityLabel={`Payment ${number} label`}
          autoCapitalize="sentences"
          maxLength={120}
          onChangeText={(label) => onChange(installment.id, { label })}
          style={styles.input}
          value={installment.label}
        />
      </Field>
      <View style={styles.twoColumns}>
        <MoneyField
          label={`Payment ${number} amount due`}
          onChange={(amountPence) => onChange(installment.id, { amountPence })}
          styles={styles}
          value={installment.amountPence}
        />
        <MoneyField
          label={`Payment ${number} amount paid`}
          onChange={(paidPence) => onChange(installment.id, { paidPence: paidPence ?? 0 })}
          styles={styles}
          value={installment.paidPence}
        />
      </View>
      <View style={styles.twoColumns}>
        <Field label={`Payment ${number} due date`} styles={styles}>
          <TextInput
            accessibilityHint="Use year, month and day, for example 2027-06-30"
            accessibilityLabel={`Payment ${number} due date`}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={10}
            onChangeText={(dueDate) => onChange(installment.id, { dueDate: dueDate || null })}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={styles.placeholder.color}
            style={styles.input}
            value={installment.dueDate ?? ""}
          />
        </Field>
        <Field label={`Payment ${number} paid date`} styles={styles}>
          <TextInput
            accessibilityHint="Use year, month and day, for example 2027-06-30"
            accessibilityLabel={`Payment ${number} paid date`}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={10}
            onChangeText={(paidAt) => onChange(installment.id, { paidAt: paidAt || null })}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={styles.placeholder.color}
            style={styles.input}
            value={installment.paidAt ?? ""}
          />
        </Field>
      </View>
      <Pressable
        accessibilityHint={installment.amountPence === null ? "Enter an expected amount first" : "Records the full expected amount as paid today"}
        accessibilityRole="button"
        accessibilityState={{ disabled: installment.amountPence === null }}
        disabled={installment.amountPence === null}
        onPress={() => onChange(installment.id, {
          paidPence: installment.amountPence ?? 0,
          paidAt: paidToday,
        })}
        style={[styles.secondaryButton, installment.amountPence === null && styles.disabledButton]}
      >
        <Text style={styles.secondaryButtonText}>Mark paid today</Text>
      </Pressable>
    </View>
  );
});

function Field({ children, label, styles }: Readonly<{
  children: ReactNode;
  label: string;
  styles: PaymentStyles;
}>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function MoneyField({ label, onChange, styles, value }: Readonly<{
  label: string;
  onChange(value: number | null): void;
  styles: PaymentStyles;
  value: number | null;
}>) {
  const displayValue = editableMoneyValue(value);
  const [draft, setDraft] = useState(displayValue);
  const lastEmittedValue = useRef(value);

  useEffect(() => {
    if (value === lastEmittedValue.current) return;
    lastEmittedValue.current = value;
    setDraft(displayValue);
  }, [displayValue, value]);

  function changeDraft(text: string) {
    const canonical = text.replace(",", ".");
    if (!/^\d*(?:\.\d{0,2})?$/.test(canonical)) return;
    setDraft(text);
    const parsed = parseMoneyToPence(canonical.startsWith(".") ? `0${canonical}` : canonical);
    lastEmittedValue.current = parsed;
    onChange(parsed);
  }

  return (
    <Field label={label} styles={styles}>
      <TextInput
        accessibilityLabel={label}
        keyboardType="decimal-pad"
        onBlur={() => setDraft(editableMoneyValue(value))}
        onChangeText={changeDraft}
        placeholder="0.00"
        placeholderTextColor={styles.placeholder.color}
        style={styles.input}
        value={draft}
      />
    </Field>
  );
}

function editableMoneyValue(value: number | null) {
  return value === null ? "" : String(value / 100);
}

function Metric({ label, styles, value }: Readonly<{
  label: string;
  styles: PaymentStyles;
  value: string;
}>) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function paymentSummary(item: BudgetItem, currency: string) {
  const paid = Math.max(item.totalPaidPence, item.depositPaidPence, 0);
  const next = item.dueDate ? `next due ${formatDate(item.dueDate)}` : "no deadline";
  return `${formatMoney(paid, currency)} paid, ${next}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function kindLabel(kind: PaymentInstallmentKind) {
  if (kind === "installment") return "Instalment";
  if (kind === "final") return "Final";
  if (kind === "deposit") return "Deposit";
  return "Other";
}

function saveMessage(result: PaymentScheduleSaveResult) {
  if (result.outcome === "connected") return "Payment schedule saved to My EverAft.";
  if (result.outcome === "device_only") return "Payment schedule saved on this device.";
  if (result.failure === "conflict") return "Saved on this device. My EverAft has a newer version that needs attention.";
  if (result.failure === "offline") return "Saved on this device. Reconnect, then refresh My EverAft.";
  return "Saved on this device, but My EverAft could not be updated.";
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.canvas },
    content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
    backButton: { alignSelf: "flex-start", justifyContent: "center", minHeight: 44 },
    backButtonText: { color: colors.primary, fontSize: 16, fontWeight: "700" },
    intro: { gap: spacing.sm },
    eyebrow: { ...typography.label, color: colors.accent },
    title: { ...typography.display, color: colors.primary, fontSize: 38, lineHeight: 44 },
    section: { gap: spacing.md },
    sectionTitle: { ...typography.display, color: colors.primary, fontSize: 28, lineHeight: 34 },
    body: { ...typography.body, color: colors.textMuted },
    itemButton: { backgroundColor: colors.canvasRaised, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.xs, minHeight: 64, padding: spacing.md },
    itemButtonSelected: { borderColor: colors.accent, borderWidth: 2 },
    itemName: { color: colors.primary, fontSize: 17, fontWeight: "700" },
    itemMeta: { color: colors.textMuted, fontSize: 14 },
    emptyCard: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
    summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    metric: { backgroundColor: colors.successSurface, borderRadius: radius.sm, flexGrow: 1, gap: spacing.xs, minWidth: "45%", padding: spacing.md },
    metricValue: { color: colors.primary, fontSize: 19, fontVariant: ["tabular-nums"], fontWeight: "700" },
    metricLabel: { color: colors.textMuted, fontSize: 13 },
    paymentCard: { backgroundColor: colors.canvasRaised, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.md, padding: spacing.md },
    rowBetween: { alignItems: "center", flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
    cardTitle: { ...typography.display, color: colors.primary, fontSize: 22, lineHeight: 28 },
    smallButton: { alignItems: "center", justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.sm },
    dangerText: { color: colors.accent, fontWeight: "700" },
    kindRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    kindButton: { borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.md },
    kindButtonSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    kindText: { color: colors.primary, fontWeight: "600" },
    kindTextSelected: { color: colors.onPrimary },
    field: { flexGrow: 1, gap: spacing.xs, minWidth: "45%" },
    fieldLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
    input: { backgroundColor: colors.canvas, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 48, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    placeholder: { color: colors.textMuted },
    twoColumns: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    primaryButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.pill, justifyContent: "center", minHeight: 52, paddingHorizontal: spacing.lg },
    primaryButtonText: { color: colors.onPrimary, fontSize: 16, fontWeight: "700" },
    secondaryButton: { alignItems: "center", borderColor: colors.primary, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: spacing.lg },
    secondaryButtonText: { color: colors.primary, fontSize: 15, fontWeight: "700" },
    disabledButton: { opacity: 0.5 },
    message: { color: colors.text, fontSize: 15, lineHeight: 21 },
  });
}

type PaymentStyles = ReturnType<typeof createStyles>;
