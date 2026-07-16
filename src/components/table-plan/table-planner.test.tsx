import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { TABLE_PLAN_STORAGE_KEY } from "@/lib/table-plan/planner";
import { TablePlanner } from "./table-planner";

describe("TablePlanner", () => {
  beforeEach(() => window.localStorage.clear());

  it("adds individual guests and persists the plan locally", async () => {
    render(<TablePlanner />);
    await screen.findByText("Saved on this device");
    fireEvent.change(screen.getByPlaceholderText("Guest name"), { target: { value: "Ailsa Grant" } });
    fireEvent.click(screen.getByRole("button", { name: "Add guest" }));
    expect(screen.getAllByText("Ailsa Grant").length).toBeGreaterThan(0);
    await waitFor(() => expect(window.localStorage.getItem(TABLE_PLAN_STORAGE_KEY)).toContain("Ailsa Grant"));
  });

  it("loads a complete example that can be edited and exported", async () => {
    render(<TablePlanner />);
    await screen.findByText("Saved on this device");
    fireEvent.click(screen.getByRole("button", { name: "Try an example" }));
    expect(screen.getAllByText("Amy Fraser").length).toBeGreaterThan(0);
    expect(screen.getByText("12 guests")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Print / save PDF" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export guest list CSV" })).toBeTruthy();
  });

  it("pastes multiple guests from a line-separated list", async () => {
    render(<TablePlanner />);
    await screen.findByText("Saved on this device");
    fireEvent.click(screen.getByRole("button", { name: "Paste a guest list" }));
    fireEvent.change(screen.getByLabelText("One name per line"), { target: { value: "Mairi Ross\nCallum Ross" } });
    fireEvent.click(screen.getByRole("button", { name: "Add these guests" }));
    expect(screen.getAllByText("Mairi Ross").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Callum Ross").length).toBeGreaterThan(0);
  });
});
