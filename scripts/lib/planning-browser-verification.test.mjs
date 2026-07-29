// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  getPlanningBrowserScenarios,
  resolveBrowserExecutable,
  resolvePlanningBrowserConfig,
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

  it("covers the connected handoff at small-iPhone and desktop sizes", () => {
    const scenarios = getPlanningBrowserScenarios();

    expect(scenarios.map((scenario) => scenario.viewport)).toEqual([
      { height: 844, width: 390 },
      { height: 900, width: 1440 },
    ]);
    expect(scenarios.every((scenario) => scenario.path.startsWith(
      "/planning-hub/photography?context=plan&planDate=2027-06-12",
    ))).toBe(true);
    expect(scenarios[0].expectedText).toContain("Venue: Our village hall");
  });
});
