const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function required(env, name) {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for Planning Hub API verification.`);
  }
  return value;
}

export function resolvePlanningApiTestConfig(env = process.env) {
  const url = required(env, "SUPABASE_TEST_URL");
  const publishableKey = required(env, "SUPABASE_TEST_PUBLISHABLE_KEY");
  const secretKey = required(env, "SUPABASE_TEST_SECRET_KEY");
  const parsedUrl = new URL(url);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("SUPABASE_TEST_URL must use HTTP or HTTPS.");
  }
  if (publishableKey === secretKey) {
    throw new Error("The publishable and secret test keys must be different.");
  }

  const local = LOOPBACK_HOSTS.has(parsedUrl.hostname);
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
    local,
    publishableKey,
    secretKey,
    url: parsedUrl.origin,
  };
}
