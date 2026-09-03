import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SupplierCatalogueImportForm } from "./supplier-catalogue-import-form";

const actionState = vi.hoisted(() => ({
  value: {
    acceptanceReadyRows: 13,
    batchId: null,
    duplicateHints: 0,
    errors: [],
    manualReviewRows: 1,
    message: "14 structurally valid rows ready to stage. 13 have no manual-review note; 1 requires a recorded resolution before acceptance.",
    mode: "validate" as const,
    ok: true,
    rowsRead: 14,
    stagedRows: 0,
    validRows: 14,
    warnings: [{ business: "Struie Wedding Films", message: "Manual review notes must be resolved and recorded before acceptance.", row: 6 }],
  },
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, useActionState: () => [actionState.value, vi.fn(), false] };
});

vi.mock("@/app/actions/supplier-catalogue", () => ({
  stageSupplierCatalogueFile: vi.fn(),
}));

afterEach(cleanup);

describe("SupplierCatalogueImportForm", () => {
  it("separates structural validity from acceptance readiness", () => {
    render(<SupplierCatalogueImportForm defaultResearchDate="2026-08-17" />);

    expect(screen.getByText("Structurally valid").parentElement?.textContent).toContain("14");
    expect(screen.getByText("Acceptance-ready").parentElement?.textContent).toContain("13");
    expect(screen.getByText("Manual review").parentElement?.textContent).toContain("1");
    expect(screen.getByText(/13 have no manual-review note/)).toBeTruthy();
    expect(screen.getByText(/Struie Wedding Films/).textContent).toContain(
      "Manual review notes must be resolved and recorded before acceptance.",
    );
  });
});
