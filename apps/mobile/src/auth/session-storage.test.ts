import {
  createMemorySessionStorage,
  createNamespacedSessionStorage,
} from "./session-storage";

describe("session storage boundary", () => {
  it("isolates accounts and supports maximum-size session fixtures", async () => {
    const backend = createMemorySessionStorage();
    const first = createNamespacedSessionStorage(backend, "account-a");
    const second = createNamespacedSessionStorage(backend, "account-b");
    const largeFixture = JSON.stringify({ access_token: "x".repeat(16_384) });

    await first.setItem("auth-token", largeFixture);
    expect(await first.getItem("auth-token")).toBe(largeFixture);
    expect(await second.getItem("auth-token")).toBeNull();
  });

  it("removes only the selected account session", async () => {
    const backend = createMemorySessionStorage();
    const first = createNamespacedSessionStorage(backend, "account-a");
    const second = createNamespacedSessionStorage(backend, "account-b");
    await first.setItem("auth-token", "first");
    await second.setItem("auth-token", "second");

    await first.removeItem("auth-token");
    expect(await first.getItem("auth-token")).toBeNull();
    expect(await second.getItem("auth-token")).toBe("second");
  });

  it("does not publish a partially completed write", async () => {
    const stable = createMemorySessionStorage({
      "everaft:account-a:auth-token": "previous-session",
    });
    const interrupted = {
      ...stable,
      async setItem() {
        throw new Error("fixture write interrupted");
      },
    };
    const storage = createNamespacedSessionStorage(interrupted, "account-a");

    await expect(storage.setItem("auth-token", "next-session")).rejects.toThrow(
      "fixture write interrupted",
    );
    expect(await storage.getItem("auth-token")).toBe("previous-session");
  });
});
