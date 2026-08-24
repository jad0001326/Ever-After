export type AuthRefreshController = Readonly<{
  startAutoRefresh(): void;
  stopAutoRefresh(): void;
}>;

export type AppStateValue = "active" | "background" | "inactive" | "unknown";

export type AppStateSource = Readonly<{
  currentState: AppStateValue;
  addEventListener(
    event: "change",
    listener: (state: AppStateValue) => void,
  ): { remove(): void };
}>;

export function bindAuthRefreshToAppState(
  auth: AuthRefreshController,
  appState: AppStateSource,
) {
  let foreground = false;

  const apply = (state: AppStateValue) => {
    const nextForeground = state === "active";
    if (nextForeground === foreground) return;
    foreground = nextForeground;
    if (foreground) auth.startAutoRefresh();
    else auth.stopAutoRefresh();
  };

  apply(appState.currentState);
  const subscription = appState.addEventListener("change", apply);
  return () => {
    subscription.remove();
    if (foreground) auth.stopAutoRefresh();
    foreground = false;
  };
}
