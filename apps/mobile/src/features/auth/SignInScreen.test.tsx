import { fireEvent, render } from "@testing-library/react-native";

import { SignInScreen } from "./SignInScreen";

describe("SignInScreen", () => {
  it("keeps a credential-free build honest and device-only planning reachable", async () => {
    const onContinueOnDevice = jest.fn();
    const view = await render(
      <SignInScreen
        availability="not_configured"
        onContinueOnDevice={onContinueOnDevice}
        onSignIn={jest.fn()}
      />,
    );

    expect(view.getByRole("header", { name: "Welcome back" })).toBeOnTheScreen();
    expect(view.getByText("Connected sign-in is not active in this build")).toBeOnTheScreen();
    expect(view.queryByLabelText("Password")).not.toBeOnTheScreen();
    await fireEvent.press(view.getByRole("button", { name: "Continue on this device" }));
    expect(onContinueOnDevice).toHaveBeenCalledTimes(1);
  });

  it("submits credentials without exposing a provider error and clears the password", async () => {
    const onSignIn = jest.fn(async () => { throw new Error("provider detail"); });
    const view = await render(
      <SignInScreen
        availability="configured"
        onContinueOnDevice={jest.fn()}
        onSignIn={onSignIn}
      />,
    );

    await fireEvent.changeText(view.getByTestId("email-input"), "couple@example.com");
    await fireEvent.changeText(view.getByTestId("password-input"), "fixture-password");
    await fireEvent.press(view.getByRole("button", { name: "Sign in" }));

    expect(onSignIn).toHaveBeenCalledWith(
      "couple@example.com",
      "fixture-password",
    );
    expect(view.getByTestId("password-input")).toHaveProp("value", "");
    expect(view.getByText(/We could not sign you in/)).toBeOnTheScreen();
    expect(view.queryByText("provider detail")).not.toBeOnTheScreen();
  });

  it("shows a generic expired-link recovery without retaining link details", async () => {
    const view = await render(
      <SignInScreen
        availability="configured"
        linkFailed
        onContinueOnDevice={jest.fn()}
        onSignIn={jest.fn()}
      />,
    );
    expect(view.getByText(/secure sign-in link could not be used/)).toBeOnTheScreen();
  });
});
