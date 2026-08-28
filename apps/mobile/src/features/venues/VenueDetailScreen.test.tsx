import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { createDevicePlan } from "../../planning/device-plan-model";
import { VenueDetailScreen } from "./VenueDetailScreen";

const mockSaveBudget = jest.fn(async (_data: unknown) => ({ outcome: "device_only" as const }));
const mockBack = jest.fn();
const mockGetVenue = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ venueId: mockVenue.id }),
  useRouter: () => ({ back: mockBack }),
}));
jest.mock("../../design/use-app-theme", () => ({
  useAppTheme: () => ({ colors: {
    canvas: "#fff", canvasRaised: "#fff", primary: "#173526", onPrimary: "#fff",
    accent: "#9C542D", text: "#222", textMuted: "#666", border: "#ccc",
    successSurface: "#eee", focus: "#f60",
  } }),
}));
jest.mock("../../auth/NativeAuthProvider", () => ({
  useNativeAuth: () => ({ getAccessToken: jest.fn(async () => null) }),
}));
jest.mock("../../catalogue/catalogue-runtime", () => ({
  createNativeCatalogueClient: () => ({ getVenue: (...args: unknown[]) => mockGetVenue(...args) }),
}));
jest.mock("../../planning/ConnectedPlanningProvider", () => ({
  useConnectedPlanning: () => ({ data: mockPlan, saveBudget: mockSaveBudget }),
}));

const mockPlan = createDevicePlan({
  weddingDate: "2027-07-12",
  location: "Fife",
  guestCount: 80,
  totalBudgetPence: 2_000_000,
  priorities: ["venue"],
  weddingSeason: null,
});
const mockVenue = {
  id: "10000000-0000-4000-8000-000000000001",
  slug: "venue-one",
  name: "Venue One",
  type: "Castle",
  town: "Cupar",
  region: "Fife",
  summary: "A venue.",
  description: "A detailed venue description.",
  capacityMin: 20,
  capacityMax: 120,
  imageUrl: null,
  imageStatus: "absent" as const,
  priceFromPence: 500_000,
  pricingLabel: "From",
  pricingUnit: "total",
  officialWebsiteUrl: null,
  imageCredit: null,
  gallery: [],
  amenities: ["Parking"],
};

describe("VenueDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVenue.mockResolvedValue(mockVenue);
  });

  it("announces image truth and keeps estimate, quote and booking states distinct", async () => {
    const view = await render(<VenueDetailScreen />);

    expect(await view.findByRole("header", { name: "Venue One" })).toBeOnTheScreen();
    expect(view.getByText("Venue photography is not yet available")).toBeOnTheScreen();
    expect(view.getByRole("radio", { name: /Estimated/ }).props.accessibilityState).toEqual({ checked: true });
    await fireEvent.press(view.getByRole("radio", { name: /Quoted/ }));
    expect(view.getByRole("radio", { name: /Quoted/ }).props.accessibilityState).toEqual({ checked: true });
    await fireEvent.press(view.getByRole("button", { name: "Choose as my venue" }));

    await waitFor(() => expect(mockSaveBudget).toHaveBeenCalled());
    const saved = mockSaveBudget.mock.calls[0][0] as typeof mockPlan;
    expect(saved.budgetPlan).toMatchObject({
      selectedVenueId: mockVenue.id,
      items: [expect.objectContaining({ bookingStatus: "quoted", confirmedCostPence: 500_000 })],
    });
    await view.unmount();
  });
});
