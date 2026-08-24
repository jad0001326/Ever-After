import { resolveNativeAuthConfiguration } from "./native-auth-config";

describe("native auth configuration", () => {
  it("keeps a credential-free local build explicitly unconfigured", () => {
    expect(resolveNativeAuthConfiguration({})).toEqual({
      status: "not_configured",
      config: null,
    });
  });

  it.each([
    { supabaseUrl: "https://project.supabase.co" },
    { publishableKey: "sb_publishable_fixture" },
    { supabaseUrl: "http://project.supabase.co", publishableKey: "sb_publishable_fixture" },
    { supabaseUrl: "https://project.supabase.co", publishableKey: "sb_secret_fixture" },
  ])("fails closed for partial or unsafe public configuration", (input) => {
    expect(resolveNativeAuthConfiguration(input).status).toBe("invalid_configuration");
  });

  it("accepts only the complete public client pair", () => {
    expect(resolveNativeAuthConfiguration({
      supabaseUrl: " https://project.supabase.co ",
      publishableKey: " sb_publishable_fixture ",
    })).toEqual({
      status: "configured",
      config: {
        url: "https://project.supabase.co",
        publishableKey: "sb_publishable_fixture",
      },
    });
  });
});
