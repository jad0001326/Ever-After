import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Header } from "./header";

describe("primary navigation", () => {
  it("keeps videographers in the desktop bar and the compact menu", () => {
    render(<Header />);

    expect(screen.getByRole("link", { name: "Videographers" }).getAttribute("href")).toBe("/suppliers/videographer");

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    const directory = screen.getByRole("navigation", { name: "Directory" }).textContent ?? "";
    expect(directory).toContain("Venues");
    expect(directory).toContain("Photographers");
    expect(directory).toContain("Videographers");
  });
});
