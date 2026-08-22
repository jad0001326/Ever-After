import {
  createIntendedDestinationStore,
  sanitizeIntendedDestination,
} from "./intended-destination";

describe("intended destination", () => {
  it.each([
    "/discover/venues/venue-1",
    "/plan/tasks/task-1?from=today",
    "/you/partner?invite=fixture-token",
  ])("accepts a bounded app destination: %s", (path) => {
    expect(sanitizeIntendedDestination(path)).toBe(path);
  });

  it.each([
    "https://evil.test/plan",
    "//evil.test/plan",
    "/\\evil.test/plan",
    "/auth/callback?code=secret",
    "/auth/reset-password?code=secret",
    `/plan/${"x".repeat(513)}`,
  ])("rejects an unsafe or auth-handler destination: %s", (path) => {
    expect(sanitizeIntendedDestination(path)).toBeNull();
  });

  it("consumes a remembered destination exactly once", () => {
    const store = createIntendedDestinationStore({ now: () => 1_000 });
    expect(store.remember("/plan/tasks/task-1")).toBe(true);
    expect(store.consume()).toBe("/plan/tasks/task-1");
    expect(store.consume()).toBeNull();
  });

  it("expires an interrupted sign-in destination after one hour", () => {
    let now = 1_000;
    const store = createIntendedDestinationStore({ now: () => now });
    store.remember("/you/partner?invite=fixture-token");
    now += 60 * 60 * 1000;
    expect(store.consume()).toBeNull();
  });
});
