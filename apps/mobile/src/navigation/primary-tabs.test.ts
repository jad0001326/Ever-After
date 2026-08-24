import { primaryTabs } from "./primary-tabs";

describe("primary navigation", () => {
  it("keeps four visible, explicitly labelled destinations", () => {
    expect(primaryTabs.map(({ label }) => label)).toEqual(["Today", "Discover", "Plan", "You"]);
    expect(primaryTabs.every(({ accessibilityLabel }) => accessibilityLabel.endsWith(" tab"))).toBe(true);
  });
});
