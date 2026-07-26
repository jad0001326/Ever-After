import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createWeddingProfile } from "@/lib/planning-workspace/profile";
import { PlanningHubProfile } from "./planning-hub-profile";

describe("PlanningHubProfile", () => {
  it("saves shared budget basics and discovery preferences together", () => {
    const onSave = vi.fn();
    render(
      <PlanningHubProfile
        onSave={onSave}
        profile={createWeddingProfile()}
        totalBudgetPence={0}
      />,
    );

    fireEvent.change(screen.getByLabelText("Total wedding budget"), { target: { value: "25000.50" } });
    fireEvent.change(screen.getByLabelText("Wedding date"), { target: { value: "2027-06-12" } });
    fireEvent.change(screen.getByLabelText("Estimated guests"), { target: { value: "90" } });
    fireEvent.change(screen.getByLabelText("Preferred area"), { target: { value: "Perthshire" } });
    fireEvent.click(screen.getByText("Venue"));
    fireEvent.click(screen.getByText("Castle"));
    fireEvent.click(screen.getByRole("button", { name: "Save wedding profile" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        weddingDate: "2027-06-12",
        guestCount: 90,
        location: "Perthshire",
        priorities: ["venue"],
        venueStyles: ["Castle"],
      }),
      2_500_050,
    );
    expect(screen.getByRole("status").textContent).toContain("saved on this device");
  });

  it("uses profile basics in the venue discovery link", () => {
    render(
      <PlanningHubProfile
        onSave={vi.fn()}
        profile={{
          ...createWeddingProfile(),
          guestCount: 80,
          location: "Fife",
        }}
        totalBudgetPence={2_000_000}
      />,
    );

    expect(screen.getByRole("link", { name: "Find matching venues" }).getAttribute("href"))
      .toBe("/planning-hub?location=Fife&guests=80&budget=20000");
  });

  it("keeps the priority selection bounded", () => {
    const onSave = vi.fn();
    render(
      <PlanningHubProfile
        onSave={onSave}
        profile={createWeddingProfile()}
        totalBudgetPence={0}
      />,
    );

    ["Venue", "Guest experience", "Photography", "Food", "Music", "Look & feel"]
      .forEach((label) => fireEvent.click(screen.getByText(label)));
    fireEvent.click(screen.getByRole("button", { name: "Save wedding profile" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("up to five");
  });
});
