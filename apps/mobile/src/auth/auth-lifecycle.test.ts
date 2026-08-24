import { bindAuthRefreshToAppState, type AppStateValue } from "./auth-lifecycle";

describe("auth refresh lifecycle", () => {
  it("refreshes only in the foreground and cleans up exactly once", () => {
    const events: string[] = [];
    let listener: ((state: AppStateValue) => void) | undefined;
    const dispose = bindAuthRefreshToAppState(
      {
        startAutoRefresh: () => events.push("start"),
        stopAutoRefresh: () => events.push("stop"),
      },
      {
        currentState: "background",
        addEventListener: (_event, next) => {
          listener = next;
          return { remove: () => events.push("remove") };
        },
      },
    );

    listener?.("active");
    listener?.("active");
    listener?.("background");
    listener?.("inactive");
    dispose();
    expect(events).toEqual(["start", "stop", "remove"]);
  });
});
