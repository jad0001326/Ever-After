"use server";

import { revalidatePath } from "next/cache";
import { readSheet } from "read-excel-file/node";
import { venueTypes } from "@/data/venue-options";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { imageUrlOrRepresentative } from "@/lib/venue-images";

type ImportMode = "validate" | "import";

type ImportError = {
  row: number;
  venue?: string;
  message: string;
};

export type VenueImportState = {
  ok: boolean;
  message: string;
  mode: ImportMode;
  rowsRead: number;
  validRows: number;
  importedRows: number;
  skippedRows: number;
  errors: ImportError[];
} | null;

type RawRow = Record<string, string>;

type ParsedVenue = {
  rowNumber: number;
  name: string;
  slug: string;
  type: (typeof venueTypes)[number];
  town: string;
  region: string;
  summary: string;
  description: string;
  priceFrom: number | null;
  priceTo: number | null;
  capacityMin: number;
  capacityMax: number;
  heroImage: string;
  officialWebsiteUrl: string | null;
  officialGalleryUrl: string | null;
  vendorContactEmail: string | null;
  imageCredit: string | null;
  imagePermissionStatus: "representative" | "approved" | "rejected" | "pending";
  imageIsRepresentative: boolean;
  inviteStatus: "not_sent" | "sent" | "bounced" | "replied" | "claimed";
  inviteSentAt: string | null;
  isFeatured: boolean;
  amenities: string[];
};

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function value(row: RawRow, ...headers: string[]) {
  for (const header of headers) {
    const found = row[normalizeHeader(header)];
    if (found) return found.trim();
  }
  return "";
}

function parseNumber(input: string) {
  const cleaned = input.replace(/[£,\s]/g, "");
  if (!cleaned || cleaned.toLowerCase() === "tbc") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parsePositiveInteger(input: string) {
  const parsed = Number(input.replace(/[^0-9]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseBoolean(input: string, fallback = false) {
  if (!input) return fallback;
  return ["yes", "true", "y", "1"].includes(input.toLowerCase());
}

function parseImagePermissionStatus(input: string): ParsedVenue["imagePermissionStatus"] {
  const normalized = input.toLowerCase();
  if (["approved", "rejected", "pending", "representative"].includes(normalized)) {
    return normalized as ParsedVenue["imagePermissionStatus"];
  }
  return "representative";
}

function parseInviteStatus(input: string): ParsedVenue["inviteStatus"] {
  const normalized = input.toLowerCase().replace(/\s+/g, "_");
  if (["not_sent", "sent", "bounced", "replied", "claimed"].includes(normalized)) {
    return normalized as ParsedVenue["inviteStatus"];
  }
  return "not_sent";
}

function defaultSummary(name: string, town: string, region: string) {
  return `${name} is a ${town || region ? `${town || region} ` : ""}venue listed for EverAft launch review.`;
}

function defaultDescription(name: string) {
  return `${name} was imported from the EverAft venue intake workbook. Add reviewed copy before publishing this listing.`;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((items) => items.some((item) => item.trim()));
}

async function readWorkbookRows(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (file.name.toLowerCase().endsWith(".csv")) {
    return parseCsv(buffer.toString("utf-8"));
  }

  try {
    return (await readSheet(buffer, "Venue Intake")).map((row) => row.map((cell) => String(cell ?? "")));
  } catch {
    return (await readSheet(buffer, 1)).map((row) => row.map((cell) => String(cell ?? "")));
  }
}

function rowsToObjects(rows: string[][]) {
  const headerIndex = rows.findIndex((row) => row.some((cell) => normalizeHeader(cell) === "venuename"));
  if (headerIndex < 0) return { rows: [], error: "Could not find a header row containing Venue name." };

  const headers = rows[headerIndex].map((header) => normalizeHeader(header));
  const records = rows.slice(headerIndex + 1).map((row, index) => {
    const record: RawRow = {};
    headers.forEach((header, columnIndex) => {
      if (header) record[header] = row[columnIndex]?.trim() ?? "";
    });
    return { rowNumber: headerIndex + index + 2, record };
  });

  return {
    rows: records.filter(({ record }) => value(record, "Venue name", "Name")),
    error: null
  };
}

function parseVenue(rowNumber: number, row: RawRow): { venue?: ParsedVenue; errors: string[] } {
  const errors: string[] = [];
  const name = value(row, "Venue name", "Name");
  const rawType = value(row, "Type", "Venue type");
  const type = venueTypes.includes(rawType as (typeof venueTypes)[number]) ? rawType as ParsedVenue["type"] : undefined;
  const town = value(row, "Town");
  const region = value(row, "Region");
  const capacityMin = parsePositiveInteger(value(row, "Capacity min"));
  const capacityMax = parsePositiveInteger(value(row, "Capacity max"));

  if (!name) errors.push("Venue name is required.");
  if (!type) errors.push(`Type must be one of: ${venueTypes.join(", ")}.`);
  if (!town) errors.push("Town is required.");
  if (!region) errors.push("Region is required.");
  if (capacityMin < 1) errors.push("Capacity min must be at least 1.");
  if (capacityMax < capacityMin) errors.push("Capacity max must be greater than or equal to capacity min.");

  if (!name || !type) return { errors };

  const slug = value(row, "Slug") || slugify(name);
  const priceFrom = parseNumber(value(row, "Price from"));
  const priceTo = parseNumber(value(row, "Price to")) ?? priceFrom;
  const description = value(row, "Description") || defaultDescription(name);
  const summary = value(row, "Summary") || description.slice(0, 180) || defaultSummary(name, town, region);
  const heroImage = imageUrlOrRepresentative(value(row, "Hero image URL"), type);
  const officialWebsiteUrl = value(row, "Official website URL", "Official website/source") || null;
  const officialGalleryUrl = value(row, "Official gallery URL") || null;
  const imagePermissionStatus = parseImagePermissionStatus(value(row, "Image permission status"));

  return {
    errors,
    venue: {
      rowNumber,
      name,
      slug,
      type,
      town,
      region,
      summary,
      description,
      priceFrom,
      priceTo,
      capacityMin,
      capacityMax,
      heroImage,
      officialWebsiteUrl,
      officialGalleryUrl,
      vendorContactEmail: value(row, "Vendor contact email") || null,
      imageCredit: value(row, "Image credit", "Image source/permission notes") || null,
      imagePermissionStatus,
      imageIsRepresentative: parseBoolean(value(row, "Image is representative?"), imagePermissionStatus === "representative"),
      inviteStatus: parseInviteStatus(value(row, "Invite status")),
      inviteSentAt: value(row, "Invite sent at") || null,
      isFeatured: parseBoolean(value(row, "Featured?")),
      amenities: value(row, "Amenities").split(",").map((amenity) => amenity.trim()).filter(Boolean)
    }
  };
}

export async function importVenuesFromFile(_: VenueImportState, formData: FormData): Promise<VenueImportState> {
  await requireAdmin();

  const supabase = await createClient();
  if (!supabase) {
    return { ok: false, message: "Supabase is not configured.", mode: "validate", rowsRead: 0, validRows: 0, importedRows: 0, skippedRows: 0, errors: [] };
  }

  const mode: ImportMode = formData.get("mode")?.toString() === "import" ? "import" : "validate";
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose an Excel workbook or CSV file first.", mode, rowsRead: 0, validRows: 0, importedRows: 0, skippedRows: 0, errors: [] };
  }

  let rawRows: string[][];
  try {
    rawRows = await readWorkbookRows(file);
  } catch (error) {
    return {
      ok: false,
      message: "Could not read that file. Try exporting the Venue Intake sheet as CSV, then upload the CSV instead.",
      mode,
      rowsRead: 0,
      validRows: 0,
      importedRows: 0,
      skippedRows: 0,
      errors: [{
        row: 0,
        message: error instanceof Error ? error.message : "The uploaded workbook could not be parsed."
      }]
    };
  }
  const { rows, error } = rowsToObjects(rawRows);
  if (error) {
    return { ok: false, message: error, mode, rowsRead: 0, validRows: 0, importedRows: 0, skippedRows: 0, errors: [{ row: 0, message: error }] };
  }

  const parsed = rows.map(({ rowNumber, record }) => ({ rowNumber, ...parseVenue(rowNumber, record) }));
  const errors: ImportError[] = parsed.flatMap((item) => item.errors.map((message) => ({ row: item.rowNumber, venue: item.venue?.name, message })));
  const validVenues = parsed.flatMap((item) => item.venue && item.errors.length === 0 ? [item.venue] : []);
  const duplicateSlugs = new Set<string>();
  const seenSlugs = new Set<string>();
  for (const venue of validVenues) {
    if (seenSlugs.has(venue.slug)) duplicateSlugs.add(venue.slug);
    seenSlugs.add(venue.slug);
  }

  duplicateSlugs.forEach((slug) => {
    const venue = validVenues.find((item) => item.slug === slug);
    errors.push({ row: venue?.rowNumber ?? 0, venue: venue?.name, message: `Duplicate slug in file: ${slug}.` });
  });

  const { data: existingVenues } = await supabase.from("venues").select("slug");
  const existingSlugs = new Set((existingVenues ?? []).map((venue) => venue.slug));
  const importableVenues = validVenues.filter((venue) => !duplicateSlugs.has(venue.slug) && !existingSlugs.has(venue.slug));
  const duplicateExisting = validVenues.filter((venue) => existingSlugs.has(venue.slug));
  duplicateExisting.forEach((venue) => errors.push({ row: venue.rowNumber, venue: venue.name, message: `Skipped duplicate existing slug: ${venue.slug}.` }));

  if (mode === "validate") {
    return {
      ok: errors.length === 0,
      message: errors.length === 0 ? `${importableVenues.length} rows are ready to import as drafts.` : `${errors.length} issue${errors.length === 1 ? "" : "s"} found. Fix them or import only valid non-duplicate rows.`,
      mode,
      rowsRead: rows.length,
      validRows: importableVenues.length,
      importedRows: 0,
      skippedRows: rows.length - importableVenues.length,
      errors
    };
  }

  let importedRows = 0;
  const { data: amenities } = await supabase.from("amenities").select("id, name, slug");
  const amenityByKey = new Map((amenities ?? []).flatMap((amenity) => [[amenity.name.toLowerCase(), amenity.id], [amenity.slug.toLowerCase(), amenity.id]]));

  for (const venue of importableVenues) {
    const { data, error: insertError } = await supabase.from("venues").insert({
      slug: venue.slug,
      name: venue.name,
      type: venue.type,
      town: venue.town,
      region: venue.region,
      summary: venue.summary,
      description: venue.description,
      price_from: venue.priceFrom,
      price_to: venue.priceTo,
      capacity_min: venue.capacityMin,
      capacity_max: venue.capacityMax,
      hero_image: venue.heroImage,
      official_website_url: venue.officialWebsiteUrl,
      official_gallery_url: venue.officialGalleryUrl,
      vendor_contact_email: venue.vendorContactEmail,
      listing_status: "draft",
      claim_status: "unclaimed",
      image_permission_status: venue.imagePermissionStatus,
      image_credit: venue.imageCredit,
      image_is_representative: venue.imageIsRepresentative,
      invite_status: venue.inviteStatus,
      invite_sent_at: venue.inviteSentAt ? new Date(venue.inviteSentAt).toISOString() : null,
      is_featured: venue.isFeatured,
      status: "draft"
    }).select("id").single();

    if (insertError || !data) {
      errors.push({ row: venue.rowNumber, venue: venue.name, message: insertError?.message ?? "Could not insert venue." });
      continue;
    }

    const amenityLinks = venue.amenities
      .map((amenity) => amenityByKey.get(amenity.toLowerCase()))
      .filter((id): id is string => Boolean(id))
      .map((amenityId) => ({ venue_id: data.id, amenity_id: amenityId }));

    if (amenityLinks.length > 0) await supabase.from("venue_amenities").insert(amenityLinks);
    importedRows += 1;
  }

  revalidatePath("/admin");
  revalidatePath("/venues");

  return {
    ok: importedRows > 0 && errors.length === 0,
    message: importedRows > 0 ? `Imported ${importedRows} venue${importedRows === 1 ? "" : "s"} as drafts.` : "No venues were imported.",
    mode,
    rowsRead: rows.length,
    validRows: importableVenues.length,
    importedRows,
    skippedRows: rows.length - importedRows,
    errors
  };
}
