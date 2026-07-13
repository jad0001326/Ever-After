import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { cookiePreferenceStorageKey, openCookiePreferences } from "@/lib/analytics/consent";
import { CookieBanner } from "./cookie-banner";

describe("CookieBanner", () => {
  beforeEach(() => window.localStorage.clear());

  it("asks explicitly before enabling analytics", () => {
    render(<CookieBanner />);
    expect(screen.getByText(/Google Analytics helps us understand visitor numbers/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Allow analytics" }));

    expect(window.localStorage.getItem(cookiePreferenceStorageKey)).toBe("all");
    expect(screen.queryByLabelText("Cookie preferences")).toBeNull();
  });

  it("lets a returning visitor reopen the choices", () => {
    window.localStorage.setItem(cookiePreferenceStorageKey, "essential");
    render(<CookieBanner />);
    expect(screen.queryByLabelText("Cookie preferences")).toBeNull();

    act(() => openCookiePreferences());

    expect(screen.getByLabelText("Cookie preferences")).toBeTruthy();
  });
});
