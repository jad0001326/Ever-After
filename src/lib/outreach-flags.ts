import type { OutreachAudienceType } from "@/lib/outreach-email";

export function supplierCategoryOutreachEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return env.SUPPLIER_CATEGORY_OUTREACH_ENABLED === "true";
}

export function assertSupplierCategoryOutreachEnabled(
  audienceType: OutreachAudienceType,
  env: Record<string, string | undefined> = process.env,
) {
  if (audienceType === "supplier" && !supplierCategoryOutreachEnabled(env)) {
    throw new Error("Supplier category outreach is not enabled.");
  }
}
