import type { Database, Json } from "@/types/database";

type Request = Database["public"]["Tables"]["supplier_update_requests"]["Row"];
type Supplier = Database["public"]["Tables"]["supplier_listings"]["Row"];

export type SupplierUpdateComparison = { key: string; label: string; before: string; after: string; changed: boolean };

const fields = [
  ["base_town", "proposed_base_town", "Base town"], ["region", "proposed_region", "Region"],
  ["service_areas", "proposed_service_areas", "Service areas"], ["travels_nationwide", "proposed_travels_nationwide", "Travels nationwide"],
  ["summary", "proposed_summary", "Summary"], ["description", "proposed_description", "Description"],
  ["services", "proposed_services", "Services"], ["official_website_url", "proposed_official_website_url", "Official website"],
  ["instagram_url", "proposed_instagram_url", "Instagram"], ["facebook_url", "proposed_facebook_url", "Facebook"],
  ["enquiry_url", "proposed_enquiry_url", "Enquiry page"], ["starting_price_pence", "proposed_starting_price_pence", "Starting price"],
  ["typical_price_pence", "proposed_typical_price_pence", "Typical price"], ["pricing_summary", "proposed_pricing_summary", "Pricing summary"],
  ["pricing_unit", "proposed_pricing_unit", "Pricing basis"]
] as const;

export function buildSupplierUpdateComparisons(request: Request, supplier: Supplier): SupplierUpdateComparison[] {
  const previous = snapshot(request.previous_values);
  const applied = snapshot(request.applied_values);
  return fields.map(([key, requestKey, label]) => {
    const fallbackBefore = supplier[key];
    const beforeValue = previous && key in previous ? previous[key] : fallbackBefore;
    const proposed = request[requestKey];
    const afterValue = request.status === "approved" && applied && key in applied ? applied[key] : proposed;
    const before = display(key, beforeValue);
    const after = display(key, afterValue);
    return { key, label, before, after, changed: before !== after };
  });
}

function snapshot(value: Json | null) {
  return value && !Array.isArray(value) && typeof value === "object" ? value as Record<string, Json | undefined> : null;
}

function display(key: string, value: unknown) {
  if (value == null || value === "") return "Not provided";
  if (key.endsWith("_price_pence") && typeof value === "number") return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value / 100);
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
