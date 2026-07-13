import { act, render, screen } from "@testing-library/react";
import { sendGAEvent } from "@next/third-parties/google";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setCookiePreference } from "@/lib/analytics/consent";
import { GoogleAnalyticsController } from "./google-analytics-controller";

const mocks = vi.hoisted(() => ({ pathname: "/venues", sendGAEvent: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("@next/third-parties/google", () => ({
  GoogleAnalytics: ({ gaId }: { gaId: string }) => <div data-testid="google-analytics">{gaId}</div>,
  sendGAEvent: mocks.sendGAEvent
}));

describe("GoogleAnalyticsController", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.pathname = "/venues";
    vi.mocked(sendGAEvent).mockClear();
  });

  it("does not load Google Analytics before consent", () => {
    render(<GoogleAnalyticsController measurementId="G-TEST123" />);
    expect(screen.queryByTestId("google-analytics")).toBeNull();
  });

  it("loads after consent and forwards existing EverAft analytics events", () => {
    render(<GoogleAnalyticsController measurementId="G-TEST123" />);
    act(() => setCookiePreference("all"));

    expect(screen.getByTestId("google-analytics").textContent).toBe("G-TEST123");
    window.dispatchEvent(new CustomEvent("everaft:analytics", { detail: { name: "planner_saved", properties: { destination: "account" } } }));
    expect(sendGAEvent).toHaveBeenCalledWith("event", "planner_saved", { destination: "account" });
  });

  it("does not load on private administration routes", () => {
    mocks.pathname = "/admin/enrichment";
    window.localStorage.setItem("everaft-cookie-preference-v2", "all");
    render(<GoogleAnalyticsController measurementId="G-TEST123" />);
    expect(screen.queryByTestId("google-analytics")).toBeNull();
  });
});
