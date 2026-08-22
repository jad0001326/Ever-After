import { createMemorySessionStorage } from "./session-storage";
import {
  createEverAftSupabaseAuthOptions,
  createEverAftSupabaseClient,
} from "./supabase-client";

describe("Supabase mobile client boundary", () => {
  it("creates a fixture-only client without making a network request", () => {
    const client = createEverAftSupabaseClient(
      {
        url: "https://fixture-project.supabase.co",
        publishableKey: "sb_publishable_fixture-only",
      },
      createMemorySessionStorage(),
    );
    expect(client.auth).toBeDefined();
  });

  it("pins the native session boundary to PKCE and explicit refresh behavior", () => {
    const options = createEverAftSupabaseAuthOptions(createMemorySessionStorage());
    expect(options).toMatchObject({
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    });
    expect(typeof options.lock).toBe("function");
  });

  it.each(["sb_secret_fixture", "service_role_fixture", "legacy-anon-jwt"])(
    "rejects anything other than a publishable key: %s",
    (publishableKey) => {
      expect(() => createEverAftSupabaseClient(
        { url: "https://fixture-project.supabase.co", publishableKey },
        createMemorySessionStorage(),
      )).toThrow(/publishable key/);
    },
  );
});
