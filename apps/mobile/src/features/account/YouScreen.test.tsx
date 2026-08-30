import { fireEvent, render } from "@testing-library/react-native";

import { YouScreen } from "./YouScreen";

describe("YouScreen", () => {
  it("labels an unconfigured plan as device-only without a cloud claim", async () => {
    const view = await render(
      <YouScreen
        availability="not_configured"
        onSignIn={jest.fn()}
        sessionStatus="unavailable"
      />,
    );
    expect(view.getByLabelText("Plan storage: On this device")).toBeOnTheScreen();
    expect(view.getByText(/does not claim cloud backup or partner sharing/)).toBeOnTheScreen();
    expect(view.queryByRole("button", { name: "Sign in to My EverAft" })).not.toBeOnTheScreen();
  });

  it("makes configured sign-in reachable without claiming a workspace", async () => {
    const onSignIn = jest.fn();
    const view = await render(
      <YouScreen availability="configured" onSignIn={onSignIn} sessionStatus="signed_out" />,
    );
    await fireEvent.press(view.getByRole("button", { name: "Sign in to My EverAft" }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it("distinguishes account authentication from successful workspace loading", async () => {
    const view = await render(
      <YouScreen availability="configured" onSignIn={jest.fn()} sessionStatus="authenticated" />,
    );
    expect(view.getByLabelText("Plan storage: On this device")).toBeOnTheScreen();
    expect(view.getByText(/account is signed in/)).toBeOnTheScreen();
    expect(view.getByText(/plan remains device-only/)).toBeOnTheScreen();
  });

  it("offers an explicit connection write and a separate safe refresh", async () => {
    const onConnect = jest.fn();
    const onRefresh = jest.fn();
    const view = await render(
      <YouScreen
        availability="configured"
        connectionMessage="The matching workspace is ready."
        onConnect={onConnect}
        onRefresh={onRefresh}
        onSignIn={jest.fn()}
        sessionStatus="authenticated"
        storageLabel="Connected to My EverAft"
      />,
    );
    await fireEvent.press(view.getByRole("button", { name: "Connect this plan" }));
    await fireEvent.press(view.getByRole("button", { name: "Refresh connected plan" }));
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(view.getByLabelText("Plan storage: Connected to My EverAft")).toBeOnTheScreen();
  });
});
