import { createMemorySessionStorage } from "./session-storage";
import { createEverAftSupabaseClient } from "./supabase-client";

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

  it.each(["sb_secret_fixture", "service_role_fixture"])(
    "rejects a secret key prefix: %s",
    (publishableKey) => {
      expect(() => createEverAftSupabaseClient(
        { url: "https://fixture-project.supabase.co", publishableKey },
        createMemorySessionStorage(),
      )).toThrow(/Secret Supabase keys/);
    },
  );
});
