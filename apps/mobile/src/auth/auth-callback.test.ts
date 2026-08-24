import { parseAuthCallback } from "./auth-callback";

describe("auth callback routing", () => {
  it.each([
    "myeveraft://auth/callback?code=fixture-code&next=%2F%28tabs%29%2Ftoday",
    "https://www.everaft.co.uk/auth/callback?code=fixture-code&next=%2F%28tabs%29%2Ftoday",
  ])("accepts an exact native or web callback: %s", (url) => {
    expect(parseAuthCallback(url)).toEqual({
      code: "fixture-code",
      nextPath: "/(tabs)/today",
    });
  });

  it.each([
    "http://www.everaft.co.uk/auth/callback?code=x",
    "https://everaft.co.uk/auth/callback?code=x",
    "https://www.everaft.co.uk.evil.test/auth/callback?code=x",
    "https://www.everaft.co.uk/auth/other?code=x",
    "myeveraft://evil/callback?code=x",
    "myeveraft://auth/callback?code=space%20token",
    "myeveraft://auth/callback?code=x&next=https%3A%2F%2Fevil.test",
  ])("rejects or contains a hostile callback: %s", (url) => {
    const parsed = parseAuthCallback(url);
    if (url.includes("next=")) expect(parsed?.nextPath).toBeNull();
    else expect(parsed).toBeNull();
  });
});
