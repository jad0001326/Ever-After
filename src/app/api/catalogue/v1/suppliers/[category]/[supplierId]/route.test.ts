import { beforeEach, describe, expect, it, vi } from "vitest";

const detail = vi.fn();
vi.mock("@/lib/planning-hub/photographers", () => ({
  getPlanningHubPhotographerDetail: (...args: unknown[]) => detail(...args),
}));

import { GET } from "./route";

const supplierId = "10000000-0000-4000-8000-000000000001";
const context = { params: Promise.resolve({ category: "photographer", supplierId }) };

describe("Supplier catalogue detail API", () => {
  beforeEach(() => detail.mockReset());

  it("returns not found only for a confirmed absent supplier", async () => {
    detail.mockResolvedValue(null);
    const response = await GET(
      new Request(`https://www.everaft.co.uk/api/catalogue/v1/suppliers/photographer/${supplierId}`),
      context,
    );
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("supplier_not_found");
  });

  it("reports catalogue failure without leaking database details", async () => {
    detail.mockImplementationOnce(() => {
      throw new Error("permission denied for private_table");
    });
    const response = await GET(
      new Request(`https://www.everaft.co.uk/api/catalogue/v1/suppliers/photographer/${supplierId}`),
      context,
    );
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.error).toBe("catalogue_unavailable");
    expect(JSON.stringify(body)).not.toContain("private_table");
  });
});
