import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { createDevicePlan } from "../../planning/device-plan-model";
import { SupplierDetailScreen } from "./SupplierDetailScreen";

const mockGetSupplier = jest.fn();
const mockSaveBudget = jest.fn(async (_data: unknown) => ({ outcome: "connected" as const }));
jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ supplierId: mockSupplier.id }), useRouter: () => ({ back: jest.fn() }) }));
jest.mock("../../design/use-app-theme", () => ({ useAppTheme: () => ({ colors: { canvas: "#fff", canvasRaised: "#fff", primary: "#173526", onPrimary: "#fff", accent: "#9C542D", text: "#222", textMuted: "#666", border: "#ccc", successSurface: "#eee", focus: "#f60" } }) }));
jest.mock("../../auth/NativeAuthProvider", () => ({ useNativeAuth: () => ({ getAccessToken: jest.fn(async () => null) }) }));
jest.mock("../../catalogue/catalogue-runtime", () => ({ createNativeCatalogueClient: () => ({ getSupplier: (...args: unknown[]) => mockGetSupplier(...args) }) }));
jest.mock("../../planning/ConnectedPlanningProvider", () => ({ useConnectedPlanning: () => ({ data: mockPlan, saveBudget: mockSaveBudget }) }));

const mockPlan = createDevicePlan({ weddingDate: "2027-08-14", location: "Fife", guestCount: 80, totalBudgetPence: 2_000_000, priorities: ["venue"], weddingSeason: null });
const mockSupplier = { id: "10000000-0000-4000-8000-000000000001", categorySlug: "photographer" as const, slug: "photo-one", name: "Photo One", baseTown: "Cupar", region: "Fife", summary: "A photographer.", description: "Documentary coverage.", styles: ["Documentary"], imageUrl: null, visualStatus: "absent" as const, startingPricePence: 150_000, typicalPricePence: null, pricingSummary: "Packages", pricingUnit: "event", isClaimed: false, travelsNationwide: false, availabilityStatus: "not_checked" as const, services: ["Full day"], officialWebsiteUrl: null, enquiryUrl: null, imageCredit: null, gallery: [], coverageHoursMin: 8, coverageHoursMax: 12, turnaroundWeeksMin: 4, turnaroundWeeksMax: 8 };

describe("SupplierDetailScreen", () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetSupplier.mockResolvedValue(mockSupplier); });
  it("discloses missing imagery and unchecked availability before plan selection", async () => {
    const view = await render(<SupplierDetailScreen />);
    expect(await view.findByRole("header", { name: "Photo One" })).toBeOnTheScreen();
    expect(view.getByText("Photography is not yet available")).toBeOnTheScreen();
    expect(view.getByText(/Availability for your wedding date has not been checked/)).toBeOnTheScreen();
    await fireEvent.press(view.getByRole("radio", { name: "Quoted" }));
    await fireEvent.press(view.getByRole("button", { name: "Add to my plan" }));
    await waitFor(() => expect(mockSaveBudget).toHaveBeenCalled());
    const saved = mockSaveBudget.mock.calls[0][0] as typeof mockPlan;
    expect(saved.budgetPlan.items[0]).toMatchObject({ categoryId: "photography", listingId: mockSupplier.id, bookingStatus: "quoted", availabilityStatus: "not_checked" });
  });
});
