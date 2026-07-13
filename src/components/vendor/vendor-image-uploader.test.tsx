import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VendorImageUploader } from "./vendor-image-uploader";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/vendor-images", () => ({
  deleteVenueImageSubmission: vi.fn(),
  registerVenueImageSubmissions: vi.fn()
}));
vi.mock("@/utils/supabase/client", () => ({ createClient: vi.fn() }));

const venueId = "51fdbc32-c29c-4d5c-b517-5710fe367a55";
const userId = "c5e6c787-47dd-4588-8aec-380c4efc9ae6";

describe("VendorImageUploader", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:venue-preview"),
      revokeObjectURL: vi.fn()
    });
  });

  it("explains the private review workflow and shows existing statuses", () => {
    render(
      <VendorImageUploader
        venueId={venueId}
        venueName="Blackshaw Barns"
        userId={userId}
        submissions={[
          {
            id: "pending-photo",
            venueId,
            altText: "Stone barn ceremony room",
            creditText: "Venue team",
            isPreferred: true,
            status: "pending",
            adminNotes: null,
            previewUrl: null,
            createdAt: "2026-07-13T12:00:00.000Z"
          },
          {
            id: "rejected-photo",
            venueId,
            altText: "Outdoor terrace",
            creditText: null,
            isPreferred: false,
            status: "rejected",
            adminNotes: "Please upload a higher-resolution original.",
            previewUrl: null,
            createdAt: "2026-07-12T12:00:00.000Z"
          }
        ]}
      />
    );

    expect(screen.getByRole("button", { name: "Choose venue photos" })).toBeTruthy();
    expect(screen.getByText("Private until approved")).toBeTruthy();
    expect(screen.getByText("In review")).toBeTruthy();
    expect(screen.getByText("Needs changes")).toBeTruthy();
    expect(screen.getByText(/higher-resolution original/i)).toBeTruthy();
  });

  it("keeps submission disabled until the owner confirms display rights", () => {
    const { container } = render(
      <VendorImageUploader venueId={venueId} venueName="Blackshaw Barns" userId={userId} submissions={[]} />
    );
    const input = container.querySelector('input[type="file"]');
    expect(input).toBeTruthy();
    fireEvent.change(input!, { target: { files: [new File(["photo"], "barn.jpg", { type: "image/jpeg" })] } });

    const submit = screen.getByRole("button", { name: "Submit 1 for review" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(submit.disabled).toBe(false);
  });
});
