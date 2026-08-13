import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCsv, parseSupplierCandidateRows } from "@/lib/supplier-catalogue-import";

const headers = ["Business name", "Category", "Base town", "Region", "Service areas", "Summary", "Description", "Services", "Official website URL", "Source URL", "Source type", "Research date", "Pricing unit", "Pricing summary", "Hero image URL", "Image permission status", "Image permission evidence URL", "Image credit", "Review notes"];
const valid = ["Films Co", "videographer", "Glasgow", "Greater Glasgow", "Glasgow|Ayrshire", "Story-led wedding films across Scotland.", "A documentary wedding film team covering celebrations throughout Scotland.", "Full-day films|Highlight films", "https://films.example/", "https://films.example/about", "official_website", "2026-08-01", "quote", "Contact the supplier for a tailored quote.", "", "", "", ""];

describe("supplier catalogue import", () => {
  it("parses quoted CSV cells", () => {
    expect(parseCsv('Business name,Summary\r\n"Films, Co","Story-led, relaxed"')).toEqual([["Business name", "Summary"], ["Films, Co", "Story-led, relaxed"]]);
  });

  it("creates a source-backed candidate without inventing imagery", () => {
    const result = parseSupplierCandidateRows([headers, valid], "2026-08-01", "2026-08-03");
    expect(result.errors).toEqual([]);
    expect(result.candidates[0]).toMatchObject({ category_slug: "videographer", slug: "films-co", service_areas: ["Glasgow", "Ayrshire"], pricing_unit: "quote", image_permission_status: "not_provided", hero_image_url: null });
  });

  it("requires lawful provenance and useful pricing evidence", () => {
    const bad = [...valid];
    bad[9] = "https://unrelated.example/source";
    bad[13] = "";
    const result = parseSupplierCandidateRows([headers, bad], "2026-08-01", "2026-08-03");
    expect(result.errors.map((issue) => issue.message)).toContain("An official_website source must use the supplier's official website host.");
    expect(result.errors.map((issue) => issue.message)).toContain("Add confirmed pricing or an explicit quote-required pricing summary.");
  });

  it("retains unapproved image provenance but warns it will not publish", () => {
    const row = [...valid];
    row[14] = "https://films.example/photo.jpg";
    row[15] = "pending";
    const result = parseSupplierCandidateRows([headers, row], "2026-08-01", "2026-08-03");
    expect(result.candidates[0]?.image_permission_status).toBe("pending");
    expect(result.warnings[0]?.message).toContain("will not be copied");
  });

  it("allows a social-only draft candidate when provenance is explicit", () => {
    const row = [...valid];
    row[8] = "";
    row[9] = "https://instagram.com/filmsco/";
    row[10] = "other_public_source";
    const extendedHeaders = [...headers];
    extendedHeaders.splice(9, 0, "Instagram URL");
    row.splice(9, 0, "https://instagram.com/filmsco/");
    const result = parseSupplierCandidateRows([extendedHeaders, row], "2026-08-01", "2026-08-03");
    expect(result.errors).toEqual([]);
    expect(result.candidates[0]?.official_website_url).toBeNull();
    expect(result.candidates[0]?.instagram_url).toBe("https://instagram.com/filmsco/");
  });

  it("requires evidence and credit before imagery is approved", () => {
    const row = [...valid];
    row[14] = "https://films.example/photo.jpg";
    row[15] = "approved";
    const result = parseSupplierCandidateRows([headers, row], "2026-08-01", "2026-08-03");
    expect(result.errors.map((issue) => issue.message)).toContain("Approved imagery requires a permission evidence URL and image credit.");
  });

  it("rejects duplicate slugs within a batch", () => {
    const result = parseSupplierCandidateRows([headers, valid, valid], "2026-08-01", "2026-08-03");
    expect(result.candidates).toHaveLength(1);
    expect(result.errors.at(-1)?.message).toBe("Slug is duplicated within this file.");
  });

  it("retains manual review blockers for resolution before acceptance", () => {
    const row = [...valid, "Official sources conflict; confirm the current package before acceptance."];
    const result = parseSupplierCandidateRows([headers, row], "2026-08-01", "2026-08-03");

    expect(result.errors).toEqual([]);
    expect(result.candidates[0]?.review_notes).toContain("Official sources conflict");
    expect(result.warnings.map((issue) => issue.message)).toContain(
      "Manual review notes must be resolved and recorded before acceptance.",
    );
  });

  it("keeps the reviewed videographer research sample importable and image-free", () => {
    const source = readFileSync(
      join(process.cwd(), "docs/planning-hub/research/videographer-primary-source-sample-2026-08-03.csv"),
      "utf8",
    );
    const result = parseSupplierCandidateRows(parseCsv(source), "2026-08-03", "2026-08-03");

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.candidates).toHaveLength(5);
    expect(result.candidates.every((candidate) => (
      candidate.category_slug === "videographer"
      && candidate.source_type === "official_website"
      && candidate.starting_price_pence != null
      && candidate.hero_image_url == null
      && candidate.image_permission_status === "not_provided"
    ))).toBe(true);
  });

  it("keeps the regional videographer gap sample importable, reviewable and image-free", () => {
    const source = readFileSync(
      join(process.cwd(), "docs/planning-hub/research/videographer-regional-gap-sample-2026-08-03.csv"),
      "utf8",
    );
    const result = parseSupplierCandidateRows(parseCsv(source), "2026-08-03", "2026-08-03");

    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(2);
    expect(result.candidates).toHaveLength(5);
    expect(result.candidates.every((candidate) => (
      candidate.category_slug === "videographer"
      && candidate.source_type === "official_website"
      && (candidate.starting_price_pence != null || candidate.pricing_unit === "quote")
      && candidate.hero_image_url == null
      && candidate.image_permission_status === "not_provided"
    ))).toBe(true);
    expect(result.candidates.find((candidate) => candidate.slug === "king-wedding-media")?.starting_price_pence)
      .toBe(140_000);
    expect(result.candidates.find((candidate) => candidate.slug === "pinfall-wedding-films")).toMatchObject({
      starting_price_pence: null,
      pricing_unit: "quote",
    });
    expect(result.candidates.find((candidate) => candidate.slug === "struie-wedding-films")).toMatchObject({
      starting_price_pence: null,
      pricing_unit: "quote",
    });
    expect(result.candidates.filter((candidate) => candidate.review_notes)).toHaveLength(2);
  });

  it("keeps the Tayside and islands videographer sample importable and image-free", () => {
    const source = readFileSync(
      join(process.cwd(), "docs/planning-hub/research/videographer-tayside-islands-sample-2026-08-03.csv"),
      "utf8",
    );
    const result = parseSupplierCandidateRows(parseCsv(source), "2026-08-03", "2026-08-03");

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.candidates).toHaveLength(4);
    expect(result.candidates.every((candidate) => (
      candidate.category_slug === "videographer"
      && candidate.source_type === "official_website"
      && (candidate.starting_price_pence != null || candidate.pricing_unit === "quote")
      && candidate.hero_image_url == null
      && candidate.image_permission_status === "not_provided"
    ))).toBe(true);
    expect(result.candidates.find((candidate) => candidate.slug === "cosmic-egg-productions")?.starting_price_pence)
      .toBe(60_000);
    expect(result.candidates.find((candidate) => candidate.slug === "west-coast-weddings")?.starting_price_pence)
      .toBe(155_000);
    expect(result.candidates.filter((candidate) => candidate.pricing_unit === "quote")).toHaveLength(2);
  });
});
