import { createDevicePlan } from "./device-plan-model";
import { decodeDevicePlan, encodeDevicePlan } from "./device-plan-codec";

describe("device plan payload migration", () => {
  it("upgrades N4 payloads with empty N5 discovery state", () => {
    const current = createPlan();
    const { connectedSync: _connectedSync, discovery: _discovery, ...legacy } = current;
    const decoded = decodeDevicePlan(JSON.stringify({ ...legacy, formatVersion: 1 }));

    expect(decoded.formatVersion).toBe(5);
    expect(decoded.connectedSync).toEqual({ lastConnected: null, pendingBudget: null, pendingTablePlan: null, pendingTasks: [] });
    expect(decoded.discovery).toEqual({ comparedVenues: [], savedVenueIds: [], comparedSuppliers: [], savedSupplierIds: [] });
  });

  it("restores compared and saved venue decisions after an app restart", () => {
    const venue = {
      id: "10000000-0000-4000-8000-000000000001",
      slug: "venue-one",
      name: "Venue One",
      type: "Castle",
      town: "Cupar",
      region: "Fife",
      summary: "A venue.",
      capacityMax: 120,
      imageUrl: null,
      imageStatus: "absent" as const,
      priceFromPence: 500_000,
      pricingLabel: "From",
      pricingUnit: "total",
    };
    const plan = createPlan();
    const data = {
      ...plan,
      discovery: { ...plan.discovery, comparedVenues: [venue], savedVenueIds: [venue.id] },
    };
    const reopened = decodeDevicePlan(encodeDevicePlan(data));

    expect(reopened.discovery.comparedVenues).toEqual([venue]);
    expect(reopened.discovery.savedVenueIds).toEqual([venue.id]);
  });

  it("upgrades the previous current payload without losing discovery decisions", () => {
    const current = createPlan();
    const { connectedSync: _connectedSync, ...versionThree } = current;
    const decoded = decodeDevicePlan(JSON.stringify({ ...versionThree, formatVersion: 3 }));

    expect(decoded).toMatchObject({
      formatVersion: 5,
      connectedSync: { lastConnected: null, pendingBudget: null, pendingTablePlan: null, pendingTasks: [] },
      discovery: current.discovery,
    });
  });

  it("persists only account-scoped table retry metadata without plan contents", () => {
    const plan = createPlan();
    const pendingTablePlan = {
      accountId: "70000000-0000-4000-8000-000000000007",
      workspaceId: "60000000-0000-4000-8000-000000000006",
      baseWorkspaceUpdatedAt: "2026-08-25T10:00:00.000Z",
    };
    const reopened = decodeDevicePlan(encodeDevicePlan({
      ...plan,
      connectedSync: { ...plan.connectedSync, pendingTablePlan },
    }));

    expect(reopened.connectedSync.pendingTablePlan).toEqual(pendingTablePlan);
  });

  it("persists account-scoped budget retry metadata", () => {
    const plan = createPlan();
    const pendingBudget = {
      accountId: "70000000-0000-4000-8000-000000000007",
      workspaceId: "60000000-0000-4000-8000-000000000006",
      baseBudgetUpdatedAt: "2026-08-25T10:00:00.000Z",
    };
    const reopened = decodeDevicePlan(encodeDevicePlan({
      ...plan,
      connectedSync: { ...plan.connectedSync, pendingBudget },
    }));

    expect(reopened.connectedSync.pendingBudget).toEqual(pendingBudget);
  });
});

function createPlan() {
  return createDevicePlan({
    weddingDate: null,
    location: "Fife",
    guestCount: 80,
    totalBudgetPence: 2_000_000,
    priorities: ["venue"],
    weddingSeason: "Summer 2027",
  }, new Date("2026-08-25T10:00:00.000Z"));
}
