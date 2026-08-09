const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const EVERAFT_PRODUCTION_SUPABASE_HOST = "fryfdniacyhpubfiqnxj.supabase.co";

function required(env, name) {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for Planning Hub API verification.`);
  }
  return value;
}

export function resolvePlanningApiTestConfig(env = process.env) {
  const appUrl = required(env, "PLANNING_API_TEST_APP_URL");
  const url = required(env, "SUPABASE_TEST_URL");
  const publishableKey = required(env, "SUPABASE_TEST_PUBLISHABLE_KEY");
  const secretKey = required(env, "SUPABASE_TEST_SECRET_KEY");
  const parsedUrl = new URL(url);
  const parsedAppUrl = new URL(appUrl);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("SUPABASE_TEST_URL must use HTTP or HTTPS.");
  }
  if (
    !["http:", "https:"].includes(parsedAppUrl.protocol)
    || !LOOPBACK_HOSTS.has(parsedAppUrl.hostname)
    || parsedAppUrl.username
    || parsedAppUrl.password
    || parsedAppUrl.pathname !== "/"
    || parsedAppUrl.search
    || parsedAppUrl.hash
  ) {
    throw new Error(
      "PLANNING_API_TEST_APP_URL must be an origin-only loopback HTTP or HTTPS URL.",
    );
  }
  if (publishableKey === secretKey) {
    throw new Error("The publishable and secret test keys must be different.");
  }

  const local = LOOPBACK_HOSTS.has(parsedUrl.hostname);
  if (parsedUrl.hostname === EVERAFT_PRODUCTION_SUPABASE_HOST) {
    throw new Error(
      "Planning Hub API verification permanently refuses the EverAft production Supabase project.",
    );
  }
  if (!local) {
    if (env.PLANNING_API_TEST_ALLOW_REMOTE !== "true") {
      throw new Error(
        "Planning Hub API verification refuses remote Supabase projects by default. Use a free local stack.",
      );
    }
    if (env.PLANNING_API_TEST_CONFIRM_REMOTE_HOST !== parsedUrl.host) {
      throw new Error(
        "PLANNING_API_TEST_CONFIRM_REMOTE_HOST must exactly match the explicitly approved disposable host.",
      );
    }
  }

  return {
    appUrl: parsedAppUrl.origin,
    local,
    publishableKey,
    secretKey,
    url: parsedUrl.origin,
  };
}
