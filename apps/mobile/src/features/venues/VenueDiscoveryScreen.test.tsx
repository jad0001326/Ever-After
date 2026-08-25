import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { createDevicePlan } from "../../planning/device-plan-model";
import { VenueDiscoveryScreen } from "./VenueDiscoveryScreen";

const mockPush = jest.fn();
const mockSave = jest.fn(async (data) => ({ data, revision: 2, savedAt: "2026-08-25T12:00:00.000Z" }));
const mockSearchVenues = jest.fn();
let resolveDelayedSearch: ((value: {
  schemaVersion: number;
  venues: typeof mockVenue[];
  page: { number: number; size: number; total: number; totalPages: number };
}) => void) | undefined;

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native/Libraries/Lists/FlatList", () => {
  const React = jest.requireActual("react") as typeof import("react");
  function FlatList({ data, renderItem, ListHeaderComponent, ListEmptyComponent, ListFooterComponent }: {
    data: unknown[];
    renderItem: (input: { item: unknown; index: number }) => React.ReactNode;
    ListHeaderComponent?: React.ReactNode;
    ListEmptyComponent?: React.ReactNode;
    ListFooterComponent?: React.ReactNode;
  }) {
    return React.createElement(
      React.Fragment,
      null,
      ListHeaderComponent,
      data.length === 0 ? ListEmptyComponent : null,
      ...data.map((item, index) => renderItem({ item, index })),
      ListFooterComponent,
    );
  }
  return { __esModule: true, default: FlatList };
});
jest.mock("../../design/use-app-theme", () => ({
  useAppTheme: () => ({ colors: {
    canvas: "#fff", canvasRaised: "#fff", primary: "#173526", onPrimary: "#fff",
    accent: "#9C542D", text: "#222", textMuted: "#666", border: "#ccc",
    successSurface: "#eee", focus: "#f60",
  } }),
}));
jest.mock("../../auth/NativeAuthProvider", () => ({
  useNativeAuth: () => ({
    getAccessToken: jest.fn(async () => null),
    snapshot: { status: "signed_out", accountId: null, reason: null },
  }),
}));
jest.mock("../../catalogue/catalogue-runtime", () => ({
  createNativeCatalogueClient: () => ({
    searchVenues: (...args: unknown[]) => mockSearchVenues(...args),
    setFavourite: jest.fn(),
  }),
}));
jest.mock("../../planning/DevicePlanProvider", () => ({
  useDevicePlan: () => ({
    state: { status: "ready", record: { data: mockPlan, revision: 1, savedAt: "2026-08-25T11:00:00.000Z" }, saving: false },
    save: mockSave,
  }),
}));

const mockPlan = createDevicePlan({
  weddingDate: null,
  location: "Fife",
  guestCount: 80,
  totalBudgetPence: 2_000_000,
  priorities: ["venue"],
  weddingSeason: "Summer 2027",
});
const mockVenue = {
  id: "10000000-0000-4000-8000-000000000001",
  slug: "venue-one",
  name: "Venue One",
  type: "Castle",
  town: "Cupar",
  region: "Fife",
  summary: "A venue for up to 120 guests.",
  capacityMax: 120,
  imageUrl: null,
  imageStatus: "absent" as const,
  priceFromPence: 500_000,
  pricingLabel: "From",
  pricingUnit: "total",
};

describe("VenueDiscoveryScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchVenues
      .mockImplementationOnce(() => new Promise(() => undefined))
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveDelayedSearch = resolve;
      }));
  });

  it("presents a linear accessible result flow and persists manual fallback", async () => {
    const view = await render(<VenueDiscoveryScreen />);

    await fireEvent.press(view.getByRole("button", { name: "Search venues" }));
    expect(view.getByLabelText("Loading venues")).toBeOnTheScreen();
    resolveDelayedSearch?.({
      schemaVersion: 1,
      venues: [mockVenue],
      page: { number: 1, size: 8, total: 1, totalPages: 1 },
    });
    expect(await view.findByRole("header", { name: "Venue One" })).toBeOnTheScreen();
    expect(view.getByRole("checkbox", { name: "Compare" }).props.accessibilityState).toEqual({ checked: false });
    await fireEvent.press(view.getByRole("button", { name: "View" }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/venue/[venueId]", params: { venueId: mockVenue.id } });

    await fireEvent.changeText(view.getByLabelText("Manual venue name"), "Village Hall");
    await fireEvent.changeText(view.getByLabelText("Manual venue estimate in pounds"), "2500");
    await fireEvent.press(view.getByRole("button", { name: "Add manual venue" }));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSave.mock.calls.at(-1)?.[0].budgetPlan.items[0]).toMatchObject({
      itemName: "Village Hall",
      source: "manual",
    });
    await view.unmount();
  });
});
