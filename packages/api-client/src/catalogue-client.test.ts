import { describe, expect, it, vi } from "vitest";
import { CatalogueApiError, createCatalogueApiClient } from "./catalogue-client";

const venueCollection = {
  schemaVersion: 1,
  venues: [],
  page: { number: 1, size: 8, total: 0, totalPages: 1 },
};

describe("createCatalogueApiClient", () => {
  it("keeps public search anonymous and sends only bounded catalogue filters", async () => {
    const fetcher = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ) => Response.json(venueCollection));
    const getAccessToken = vi.fn(async () => "private-token");
    const client = createCatalogueApiClient({
      baseUrl: "https://www.everaft.co.uk",
      getAccessToken,
      fetch: fetcher,
    });

    await client.searchVenues({ location: " Fife ", guests: 20000, page: 2000 });
    const [input, init] = fetcher.mock.calls[0];
    const url = new URL(String(input));
    expect(Object.fromEntries(url.searchParams)).toEqual({
      location: "Fife",
      guests: "10000",
      page: "1000",
    });
    expect(new Headers(init?.headers).has("authorization")).toBe(false);
    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it("requires the current bearer token only for private bookmarks", async () => {
    const fetcher = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ) => Response.json({
      schemaVersion: 1,
      kind: "venue",
      id: "10000000-0000-4000-8000-000000000001",
      saved: true,
    }));
    const client = createCatalogueApiClient({
      baseUrl: "https://www.everaft.co.uk",
      getAccessToken: async () => "private-token",
      fetch: fetcher,
    });

    await client.setFavourite("venue", "10000000-0000-4000-8000-000000000001", true);
    const [, init] = fetcher.mock.calls[0];
    expect(init?.method).toBe("PUT");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer private-token");
  });

  it("does not make a bookmark request after sign-out", async () => {
    const fetcher = vi.fn();
    const client = createCatalogueApiClient({
      baseUrl: "https://www.everaft.co.uk",
      getAccessToken: async () => null,
      fetch: fetcher,
    });
    await expect(client.listFavourites()).rejects.toBeInstanceOf(CatalogueApiError);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
