import { describe, expect, it } from "vitest";
import { publicSupplierCategoryCopy, publicSupplierProfileKeywords } from "@/lib/public-supplier-copy";
import { supplierBaseLabel, supplierTravelSummary } from "@/lib/supplier-travel";

describe("videographer launch copy", () => {
  it("describes coverage of Scottish weddings without calling every supplier Scottish", () => {
    const copy = publicSupplierCategoryCopy({
      slug: "videographer",
      label: "Videographer",
      plural: "Videographers",
    });

    expect(copy.title).toBe("Wedding videographers for Scottish celebrations");
    expect(copy.description).toContain("travel in");
    expect(copy.description).not.toMatch(/Scottish wedding videographers/);
    expect(copy.intro).toContain("England");
    expect(publicSupplierProfileKeywords(
      { slug: "videographer", label: "Videographer", plural: "Videographers" },
      { name: "Channel One Wedding Films", baseTown: "Lancaster", region: "Lancashire" },
    ).join(" ")).not.toMatch(/Scottish wedding videographers/);
  });

  it("states a travel radius from the supplier's own base", () => {
    const lancashire = {
      baseTown: "Lancaster",
      region: "Lancashire",
      serviceAreas: ["Glasgow", "Edinburgh"],
      travelRadiusMiles: 200,
      travelsNationwide: false,
    };

    expect(supplierBaseLabel(lancashire)).toBe("Based in Lancaster, Lancashire · up to 200 miles");
    expect(supplierTravelSummary(lancashire)).toBe("Travels up to 200 miles from Lancaster, including Glasgow, Edinburgh");
    expect(supplierTravelSummary(lancashire)).not.toContain("throughout Scotland");
    expect(supplierTravelSummary({ ...lancashire, travelsNationwide: true, travelRadiusMiles: null, serviceAreas: [] })).toBe("Travels across Scotland");
  });
});
