import { createCatalogueApiClient } from "@everaft/api-client";

export type CatalogueRuntimeConfiguration =
  | Readonly<{ status: "configured"; baseUrl: string }>
  | Readonly<{ status: "not_configured" | "invalid_configuration"; baseUrl: null }>;

export function resolveCatalogueRuntimeConfiguration(raw?: string): CatalogueRuntimeConfiguration {
  const value = raw?.trim() ?? "";
  if (!value) return { status: "not_configured", baseUrl: null };
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "10.0.2.2"].includes(url.hostname);
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
      return { status: "invalid_configuration", baseUrl: null };
    }
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return { status: "configured", baseUrl: url.href };
  } catch {
    return { status: "invalid_configuration", baseUrl: null };
  }
}

export function createNativeCatalogueClient(getAccessToken: () => Promise<string | null>) {
  const configuration = resolveCatalogueRuntimeConfiguration(
    process.env.EXPO_PUBLIC_EVERAFT_API_URL,
  );
  if (configuration.status !== "configured") return null;
  return createCatalogueApiClient({
    baseUrl: configuration.baseUrl,
    getAccessToken,
  });
}
