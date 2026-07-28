// @vitest-environment node

import { describe, expect, it } from "vitest";
import { resolvePlanningApiTestConfig } from "./planning-api-test-config.mjs";

const localConfig = {
  SUPABASE_TEST_PUBLISHABLE_KEY: "sb_publishable_local",
  SUPABASE_TEST_SECRET_KEY: "sb_secret_local",
  SUPABASE_TEST_URL: "http://127.0.0.1:54321",
};

describe("Planning API test configuration", () => {
  it("accepts a loopback Supabase stack without a remote override", () => {
    expect(resolvePlanningApiTestConfig(localConfig)).toEqual({
      local: true,
      publishableKey: "sb_publishable_local",
      secretKey: "sb_secret_local",
      url: "http://127.0.0.1:54321",
    });
  });

  it("refuses missing credentials and reused privileged keys", () => {
    expect(() => resolvePlanningApiTestConfig({})).toThrow(/SUPABASE_TEST_URL/);
    expect(() => resolvePlanningApiTestConfig({
      ...localConfig,
      SUPABASE_TEST_SECRET_KEY: localConfig.SUPABASE_TEST_PUBLISHABLE_KEY,
    })).toThrow(/must be different/);
  });

  it("refuses remote projects by default", () => {
    expect(() => resolvePlanningApiTestConfig({
      ...localConfig,
      SUPABASE_TEST_URL: "https://example.supabase.co",
    })).toThrow(/refuses remote Supabase projects/);
  });

  it("requires an exact host confirmation for an approved disposable project", () => {
    const remote = {
      ...localConfig,
      PLANNING_API_TEST_ALLOW_REMOTE: "true",
      SUPABASE_TEST_URL: "https://disposable.supabase.co",
    };
    expect(() => resolvePlanningApiTestConfig(remote)).toThrow(/must exactly match/);
    expect(resolvePlanningApiTestConfig({
      ...remote,
      PLANNING_API_TEST_CONFIRM_REMOTE_HOST: "disposable.supabase.co",
    }).local).toBe(false);
  });
});
