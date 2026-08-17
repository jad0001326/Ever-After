import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PlanningHubHeader } from "./planning-hub-header";

describe("Planning Hub release messaging", () => {
  const originalPublicEntry = process.env.PLANNING_HUB_PUBLIC_ENTRY_ENABLED;

  afterEach(() => {
    if (originalPublicEntry === undefined) delete process.env.PLANNING_HUB_PUBLIC_ENTRY_ENABLED;
    else process.env.PLANNING_HUB_PUBLIC_ENTRY_ENABLED = originalPublicEntry;
  });

  it("retains private-beta wording while public entry is closed", () => {
    delete process.env.PLANNING_HUB_PUBLIC_ENTRY_ENABLED;
    render(<PlanningHubHeader />);

    expect(screen.getByText("Private beta")).toBeTruthy();
    expect(screen.queryByText(/Beta plans are saved in this browser/i)).toBeNull();
  });

  it("discloses the device-only boundary when public entry opens", () => {
    process.env.PLANNING_HUB_PUBLIC_ENTRY_ENABLED = "true";
    render(<PlanningHubHeader />);

    expect(screen.getByText("Public beta")).toBeTruthy();
    expect(screen.getByText(/Beta plans are saved in this browser on this device/i)).toBeTruthy();
    expect(screen.getByText(/Secure account sync and partner sharing are not yet enabled/i)).toBeTruthy();
  });
});
