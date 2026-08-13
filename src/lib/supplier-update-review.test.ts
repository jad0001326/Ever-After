import { describe, expect, it } from "vitest";
import { buildSupplierUpdateComparisons } from "@/lib/supplier-update-review";
import type { Database } from "@/types/database";

type Request = Database["public"]["Tables"]["supplier_update_requests"]["Row"];
type Supplier = Database["public"]["Tables"]["supplier_listings"]["Row"];

describe("buildSupplierUpdateComparisons", () => {
  it("shows proposed values for pending reviews", () => {
    const rows = buildSupplierUpdateComparisons({ status: "pending", proposed_base_town: "Glasgow", proposed_starting_price_pence: 125000, previous_values: null, applied_values: null } as Request, { base_town: "Paisley", starting_price_pence: 100000 } as Supplier);
    expect(rows.find((row) => row.key === "base_town")).toMatchObject({ before: "Paisley", after: "Glasgow", changed: true });
    expect(rows.find((row) => row.key === "starting_price_pence")?.after).toContain("1,250");
  });

  it("uses immutable snapshots after approval", () => {
    const rows = buildSupplierUpdateComparisons({ status: "approved", previous_values: { summary: "Old" }, applied_values: { summary: "Approved" }, proposed_summary: "Proposal" } as unknown as Request, { summary: "Changed later" } as Supplier);
    expect(rows.find((row) => row.key === "summary")).toMatchObject({ before: "Old", after: "Approved" });
  });
});
