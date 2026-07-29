// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  getPlanningBrowserJourney,
  getPlanningBrowserScenarios,
  PLANNING_LAB_INTERACTION_BUDGET_MS,
  resolveBrowserExecutable,
  resolvePlanningBrowserConfig,
  summarizeInteractionTimings,
} from "./planning-browser-verification.mjs";

describe("Planning Hub browser verification configuration", () => {
  it("accepts only a loopback web server", () => {
    expect(resolvePlanningBrowserConfig({
      env: {
        PLANNING_HUB_BROWSER_BASE_URL: "http://localhost:3001/planning-hub",
      },
      exists: (candidate) => candidate.endsWith("chrome.exe"),
      platform: "win32",
    })).toEqual({
      baseUrl: "http://localhost:3001",
      browserPath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    });

    expect(() => resolvePlanningBrowserConfig({
      env: {
        PLANNING_HUB_BROWSER_BASE_URL: "https://www.everaft.co.uk",
      },
      exists: () => true,
      platform: "win32",
    })).toThrow(/refuses non-local URLs/);
  });

  it("honours an explicit executable and fails closed when none exists", () => {
    expect(resolveBrowserExecutable({
      configuredPath: "C:\\Browsers\\chrome.exe",
      exists: (candidate) => candidate === "C:\\Browsers\\chrome.exe",
      platform: "win32",
    })).toBe("C:\\Browsers\\chrome.exe");

    expect(() => resolveBrowserExecutable({
      exists: () => false,
      platform: "linux",
    })).toThrow(/No supported local Chrome or Edge/);

    expect(() => resolveBrowserExecutable({
      configuredPath: "chrome.exe",
      exists: () => true,
      platform: "win32",
    })).toThrow(/must be an absolute path/);
  });

  it("covers every milestone surface at small-iPhone and desktop sizes", () => {
    const scenarios = getPlanningBrowserScenarios();

    expect(scenarios).toHaveLength(10);
    expect(scenarios.slice(0, 5).every((scenario) => (
      scenario.viewport.height === 844 && scenario.viewport.width === 390
    ))).toBe(true);
    expect(scenarios.slice(5).every((scenario) => (
      scenario.viewport.height === 900 && scenario.viewport.width === 1440
    ))).toBe(true);
    expect(scenarios.map((scenario) => scenario.path)).toContain(
      "/wedding-budget-planner",
    );
    expect(scenarios.map((scenario) => scenario.path)).toContain(
      "/wedding-table-planner",
    );
    expect(scenarios.find((scenario) => scenario.name === "photography-context-mobile")
      ?.expectedText).toContain("Venue: Our village hall");
  });

  it("defines a deterministic local-only venue-to-photography journey", () => {
    const journey = getPlanningBrowserJourney();

    expect(journey.viewport).toEqual({ height: 844, width: 390 });
    expect(journey).toMatchObject({
      guestCount: "80",
      laterWeddingDate: "2027-06-19",
      location: "Fife",
      longListItemCount: 7,
      manualVenueCost: "5000",
      manualVenueName: "Browser journey hall",
      paymentAmount: "1000",
      paymentDueDate: "2027-06-01",
      paymentLabel: "Booking deposit",
      paymentPaid: "500",
      totalBudget: "30000",
      weddingDate: "2027-06-12",
    });
    expect(journey.expectedPhotographyText).toContain(
      "£25,000 remaining overall",
    );
  });

  it("summarises the slowest event in each measured interaction", () => {
    expect(PLANNING_LAB_INTERACTION_BUDGET_MS).toBe(200);
    expect(summarizeInteractionTimings([
      {
        duration: 24,
        interactionId: 17,
        name: "keydown",
        target: "button:View",
      },
      {
        duration: 16,
        interactionId: 17,
        name: "keyup",
        target: "button:View",
      },
      {
        duration: 48,
        interactionId: 23,
        name: "click",
        target: "summary:Venue not listed?",
      },
      {
        duration: 80,
        interactionId: 0,
        name: "pointerdown",
        target: "body",
      },
      {
        duration: Number.NaN,
        interactionId: 29,
        name: "click",
        target: "button:Compare",
      },
    ])).toEqual({
      interactionCount: 2,
      interactions: [
        {
          durationMs: 48,
          events: ["click"],
          interactionId: 23,
          target: "summary:Venue not listed?",
        },
        {
          durationMs: 24,
          events: ["keydown", "keyup"],
          interactionId: 17,
          target: "button:View",
        },
      ],
      maxDurationMs: 48,
      slowestInteraction: {
        durationMs: 48,
        events: ["click"],
        interactionId: 23,
        target: "summary:Venue not listed?",
      },
    });
  });

  it("fails clearly when interaction timings are not an array", () => {
    expect(() => summarizeInteractionTimings(null)).toThrow(
      /Interaction timing entries must be an array/,
    );
  });
});
