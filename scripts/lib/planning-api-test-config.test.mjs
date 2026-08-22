// @vitest-environment node

import { describe, expect, it } from "vitest";
import { resolvePlanningApiTestConfig } from "./planning-api-test-config.mjs";

const localConfig = {
  PLANNING_API_TEST_APP_URL: "http://127.0.0.1:3000",
  SUPABASE_TEST_PUBLISHABLE_KEY: "sb_publishable_local",
  SUPABASE_TEST_SECRET_KEY: "sb_secret_local",
  SUPABASE_TEST_URL: "http://127.0.0.1:54321",
};

describe("Planning API test configuration", () => {
  it("accepts a loopback Supabase stack without a remote override", () => {
    expect(resolvePlanningApiTestConfig(localConfig)).toEqual({
      appUrl: "http://127.0.0.1:3000",
      local: true,
      production: false,
      publishableKey: "sb_publishable_local",
      secretKey: "sb_secret_local",
      targetClass: "local loopback",
      url: "http://127.0.0.1:54321",
    });
  });

  it("refuses missing credentials and reused privileged keys", () => {
    expect(() => resolvePlanningApiTestConfig({})).toThrow(/PLANNING_API_TEST_APP_URL/);
    expect(() => resolvePlanningApiTestConfig({
      ...localConfig,
      SUPABASE_TEST_SECRET_KEY: localConfig.SUPABASE_TEST_PUBLISHABLE_KEY,
    })).toThrow(/must be different/);
  });

  it("requires an origin-only loopback application server", () => {
    for (const appUrl of [
      "https://preview.example.com",
      "http://127.0.0.1:3000/api/planning",
      "http://user:password@127.0.0.1:3000",
    ]) {
      expect(() => resolvePlanningApiTestConfig({
        ...localConfig,
        PLANNING_API_TEST_APP_URL: appUrl,
      })).toThrow(/origin-only loopback/);
    }
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

  it("refuses EverAft production unless all three explicit locks match", () => {
    const production = {
      ...localConfig,
      SUPABASE_TEST_URL: "https://fryfdniacyhpubfiqnxj.supabase.co",
    };
    expect(() => resolvePlanningApiTestConfig(production)).toThrow(/explicit production override/);
    expect(() => resolvePlanningApiTestConfig({
      ...production,
      PLANNING_API_TEST_ALLOW_PRODUCTION: "true",
    })).toThrow(/production project reference/);
    expect(() => resolvePlanningApiTestConfig({
      ...production,
      PLANNING_API_TEST_ALLOW_PRODUCTION: "true",
      PLANNING_API_TEST_CONFIRM_PRODUCTION_PROJECT: "fryfdniacyhpubfiqnxj",
    })).toThrow(/cleanup/);

    expect(resolvePlanningApiTestConfig({
      ...production,
      PLANNING_API_TEST_ALLOW_PRODUCTION: "true",
      PLANNING_API_TEST_CONFIRM_PRODUCTION_PROJECT: "fryfdniacyhpubfiqnxj",
      PLANNING_API_TEST_CONFIRM_CLEANUP: "delete-temporary-users-and-cascaded-planning-data",
    })).toMatchObject({
      local: false,
      production: true,
      targetClass: "explicitly approved EverAft production",
    });
  });

  it("allows only the canonical deployed app for an approved production smoke", () => {
    const production = {
      ...localConfig,
      PLANNING_API_TEST_ALLOW_PRODUCTION: "true",
      PLANNING_API_TEST_CONFIRM_PRODUCTION_PROJECT: "fryfdniacyhpubfiqnxj",
      PLANNING_API_TEST_CONFIRM_CLEANUP: "delete-temporary-users-and-cascaded-planning-data",
      SUPABASE_TEST_URL: "https://fryfdniacyhpubfiqnxj.supabase.co",
    };
    expect(resolvePlanningApiTestConfig({
      ...production,
      PLANNING_API_TEST_APP_URL: "https://www.everaft.co.uk",
    }).appUrl).toBe("https://www.everaft.co.uk");
    expect(() => resolvePlanningApiTestConfig({
      ...production,
      PLANNING_API_TEST_APP_URL: "https://preview.example.com",
    })).toThrow(/origin-only loopback/);
  });
});
