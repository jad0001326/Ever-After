import { resolveCatalogueRuntimeConfiguration } from "./catalogue-runtime";

describe("native catalogue runtime configuration", () => {
  it("accepts HTTPS and the Android emulator local bridge only", () => {
    expect(resolveCatalogueRuntimeConfiguration("https://www.everaft.co.uk").status)
      .toBe("configured");
    expect(resolveCatalogueRuntimeConfiguration("http://10.0.2.2:3000").status)
      .toBe("configured");
    expect(resolveCatalogueRuntimeConfiguration("http://example.test").status)
      .toBe("invalid_configuration");
    expect(resolveCatalogueRuntimeConfiguration().status).toBe("not_configured");
  });
});
