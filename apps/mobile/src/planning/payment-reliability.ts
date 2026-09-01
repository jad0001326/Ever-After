import type { BudgetPlan, PaymentInstallment } from "@everaft/planning-domain/budget/types";
import { updatePlanningHubItemInstallments } from "@everaft/planning-domain/planning-hub/plan";

import { updateDevicePlan, type DevicePlanData } from "./device-plan-model";

export function withDevicePaymentSchedule(
  data: DevicePlanData,
  itemId: string,
  installments: PaymentInstallment[],
): DevicePlanData {
  return updateDevicePlan(data, (current) => ({
    ...current,
    budgetPlan: updatePlanningHubItemInstallments(
      current.budgetPlan,
      itemId,
      installments,
    ),
  }));
}

export function budgetPlanContentMatches(
  canonical: BudgetPlan,
  intended: BudgetPlan,
) {
  const { updatedAt: _canonicalVersion, ...canonicalContent } = canonical;
  const { updatedAt: _intendedVersion, ...intendedContent } = intended;
  return JSON.stringify(canonicalContent) === JSON.stringify(intendedContent);
}
