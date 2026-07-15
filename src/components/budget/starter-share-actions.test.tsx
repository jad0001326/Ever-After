import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StarterShareActions } from "./starter-share-actions";

const props = {
  budget: "20000",
  description: "A balanced editable wedding budget example.",
  path: "/wedding-budget-planner/20000",
  title: "£20,000 Wedding Budget Example"
};

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(document, "execCommand", { configurable: true, value: undefined });
  Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
});

describe("StarterShareActions", () => {
  it("copies the canonical starter page link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    render(<StarterShareActions {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("http://localhost:3000/wedding-budget-planner/20000"));
    expect(screen.getByText("Link copied — ready to share.")).toBeTruthy();
  });

  it("uses a selection fallback when clipboard permissions are unavailable", async () => {
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });

    render(<StarterShareActions {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(screen.getByText("Link copied — ready to share.")).toBeTruthy();
  });

  it("uses the native share sheet when the browser supports it", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });

    render(<StarterShareActions {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Share this budget" }));

    await waitFor(() => expect(share).toHaveBeenCalledWith({
      title: props.title,
      text: props.description,
      url: "http://localhost:3000/wedding-budget-planner/20000"
    }));
    expect(screen.getByText("Budget shared.")).toBeTruthy();
  });

  it("falls back to copying the link when native sharing is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    render(<StarterShareActions {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Share this budget" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("http://localhost:3000/wedding-budget-planner/20000"));
    expect(screen.getByText("Link copied — ready to share.")).toBeTruthy();
  });

  it("reveals a selectable link when clipboard access is blocked", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("Blocked"));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    render(<StarterShareActions {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    await waitFor(() => expect(screen.getByLabelText("Budget link to copy")).toBeTruthy());
    expect((screen.getByLabelText("Budget link to copy") as HTMLInputElement).value).toBe("http://localhost:3000/wedding-budget-planner/20000");
    expect(screen.getByText("Clipboard access was blocked. Select the link below to copy it.")).toBeTruthy();
  });
});
