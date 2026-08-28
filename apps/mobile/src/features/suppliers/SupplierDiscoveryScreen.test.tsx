import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { createDevicePlan } from "../../planning/device-plan-model";
import { SupplierDiscoveryScreen } from "./SupplierDiscoveryScreen";

const mockSearch = jest.fn(); const mockSave = jest.fn(async (data) => ({ data, revision: 2, savedAt: "2026-08-28T12:00:00Z" })); const mockSaveBudget = jest.fn(async (_data: unknown) => ({ outcome: "device_only" as const })); const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("react-native/Libraries/Lists/FlatList", () => { const React = jest.requireActual("react") as typeof import("react"); return { __esModule: true, default: ({ data, renderItem, ListHeaderComponent, ListFooterComponent }: { data: unknown[]; renderItem(input: { item: unknown; index: number }): React.ReactNode; ListHeaderComponent?: React.ReactNode; ListFooterComponent?: React.ReactNode }) => React.createElement(React.Fragment, null, ListHeaderComponent, ...data.map((item, index) => renderItem({ item, index })), ListFooterComponent) }; });
jest.mock("../../design/use-app-theme", () => ({ useAppTheme: () => ({ colors: { canvas: "#fff", canvasRaised: "#fff", primary: "#173526", onPrimary: "#fff", accent: "#9C542D", text: "#222", textMuted: "#666", border: "#ccc", successSurface: "#eee", focus: "#f60" } }) }));
jest.mock("../../auth/NativeAuthProvider", () => ({ useNativeAuth: () => ({ getAccessToken: jest.fn(async () => null), snapshot: { status: "signed_out", accountId: null } }) }));
jest.mock("../../catalogue/catalogue-runtime", () => ({ createNativeCatalogueClient: () => ({ searchSuppliers: (...args: unknown[]) => mockSearch(...args), setFavourite: jest.fn(), listFavourites: jest.fn() }) }));
jest.mock("../../planning/DevicePlanProvider", () => ({ useDevicePlan: () => ({ save: mockSave }) }));
jest.mock("../../planning/ConnectedPlanningProvider", () => ({ useConnectedPlanning: () => ({ data: mockPlan, saveBudget: mockSaveBudget }) }));

const mockPlan = createDevicePlan({ weddingDate: "2027-08-14", location: "Fife", guestCount: 80, totalBudgetPence: 2_000_000, priorities: ["venue"], weddingSeason: null });
const supplier = { id: "10000000-0000-4000-8000-000000000001", categorySlug: "photographer" as const, slug: "photo-one", name: "Photo One", baseTown: "Cupar", region: "Fife", summary: "A photographer.", styles: ["Documentary"], imageUrl: null, visualStatus: "absent" as const, startingPricePence: 150_000, typicalPricePence: null, pricingSummary: null, pricingUnit: "event", isClaimed: false, travelsNationwide: false, availabilityStatus: "not_checked" as const };
const response = { schemaVersion: 1 as const, category: { slug: "photographer" as const, label: "Photographer" as const, plural: "Photographers" as const, budgetCategoryId: "photography" as const }, suppliers: [supplier], context: { venue: "not_provided" as const, venueName: null, location: "Fife", budgetPence: 2_000_000, weddingDate: "2027-08-14", availabilityStatus: "not_checked" as const }, page: { number: 1, size: 8 as const, total: 1, totalPages: 1 } };

describe("SupplierDiscoveryScreen", () => {
  beforeEach(() => { jest.clearAllMocks(); mockSearch.mockResolvedValue(response); });
  it("offers catalogue comparison and a connected manual fallback", async () => {
    const view = await render(<SupplierDiscoveryScreen />);
    expect(await view.findByRole("header", { name: "Photo One" })).toBeOnTheScreen();
    expect(view.getByLabelText("Photo One photograph not yet available")).toBeOnTheScreen();
    expect(view.getByText("Supplier photography is not yet available")).toBeOnTheScreen();
    await fireEvent.press(view.getByRole("checkbox", { name: "Compare" }));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    await fireEvent.changeText(view.getByLabelText("Manual photographer name"), "Local Photographer");
    await fireEvent.changeText(view.getByLabelText("Manual photographer estimate in pounds"), "1200");
    await fireEvent.press(view.getByRole("button", { name: "Add manually" }));
    await waitFor(() => expect(mockSaveBudget).toHaveBeenCalled());
    expect((mockSaveBudget.mock.calls[0][0] as typeof mockPlan).budgetPlan.items[0]).toMatchObject({ categoryId: "photography", source: "manual" });
  });
});
