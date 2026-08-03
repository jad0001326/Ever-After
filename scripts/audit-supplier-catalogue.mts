import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  buildSupplierCatalogueAudit,
  type SupplierAuditCategory,
  type SupplierAuditClaim,
  type SupplierAuditImage,
  type SupplierAuditListing,
} from "../src/lib/supplier-catalogue-audit.ts";

const args = new Set(process.argv.slice(2));
if (!args.has("--read-only")) {
  throw new Error("Pass --read-only to acknowledge that this command performs GET requests only.");
}
if (args.has("--apply") || args.has("--write")) {
  throw new Error("This audit has no database write mode.");
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await loadEnv(path.join(root, ".env"));
await loadEnv(path.join(root, ".env.local"));
if (process.env.SUPPLIER_AUDIT_ENV_FILE) {
  await loadEnv(path.resolve(process.env.SUPPLIER_AUDIT_ENV_FILE));
}

const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

const [categories, listings, images, claims] = await Promise.all([
  fetchAll<SupplierAuditCategory>(
    "supplier_categories",
    "slug,name,plural_name,is_live,sort_order",
    "sort_order.asc",
  ),
  fetchAll<SupplierAuditListing>(
    "supplier_listings",
    "id,category_slug,name,base_town,region,summary,description,services,source_url,official_website_url,starting_price_pence,typical_price_pence,pricing_summary,pricing_unit,hero_image_url,image_permission_status,listing_status,claim_status,is_claimed",
    "category_slug.asc,name.asc",
  ),
  fetchAll<SupplierAuditImage>(
    "supplier_images",
    "supplier_id,permission_status",
    "supplier_id.asc",
  ),
  fetchAll<SupplierAuditClaim>(
    "supplier_claims",
    "supplier_id,status",
    "supplier_id.asc",
  ),
]);

const audit = buildSupplierCatalogueAudit({
  generatedAt: new Date().toISOString(),
  categories,
  listings,
  images,
  claims,
});

process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);

async function fetchAll<T>(table: string, select: string, order: string) {
  const rows: T[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
    url.searchParams.set("select", select);
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("order", order);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
    if (!response.ok) {
      throw new Error(`${table} read failed (${response.status}): ${await response.text()}`);
    }
    const page = await response.json() as T[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

async function loadEnv(filePath: string) {
  try {
    const text = await readFile(filePath, "utf8");
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const index = line.indexOf("=");
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      process.env[key] ??= value;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the complete protected catalogue audit.`);
  return value;
}
