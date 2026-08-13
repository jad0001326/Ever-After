"use server";

import { revalidatePath } from "next/cache";
import { parseSupplierOwnerUpdate, type SupplierOwnerUpdateInput } from "@/lib/supplier-owner-update";
import { publicSupplierProfilePath } from "@/lib/supplier-public-routes";
import { createClient } from "@/lib/supabase/server";
import type { SupplierCategorySlug } from "@/types/supplier";

export type SupplierOwnerUpdateState = { ok: boolean; message: string } | null;

export async function requestSupplierUpdate(_: SupplierOwnerUpdateState, formData: FormData): Promise<SupplierOwnerUpdateState> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Supplier updates are not configured yet." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in to request supplier listing updates." };

  const supplierId = value(formData, "supplierId");
  if (!supplierId) return { ok: false, message: "Choose a supplier listing to update." };

  const parsed = parseSupplierOwnerUpdate({
    baseTown: value(formData, "baseTown"),
    region: value(formData, "region"),
    serviceAreas: value(formData, "serviceAreas"),
    travelsNationwide: formData.get("travelsNationwide") === "on",
    summary: value(formData, "summary"),
    description: value(formData, "description"),
    services: value(formData, "services"),
    officialWebsiteUrl: value(formData, "officialWebsiteUrl"),
    instagramUrl: value(formData, "instagramUrl"),
    facebookUrl: value(formData, "facebookUrl"),
    enquiryUrl: value(formData, "enquiryUrl"),
    startingPrice: value(formData, "startingPrice"),
    typicalPrice: value(formData, "typicalPrice"),
    pricingSummary: value(formData, "pricingSummary"),
    pricingUnit: value(formData, "pricingUnit"),
    requestedMessage: value(formData, "requestedMessage")
  } satisfies SupplierOwnerUpdateInput);
  if (!parsed.ok) return parsed;

  const { data: supplier } = await supabase
    .from("supplier_listings")
    .select("id, vendor_id, slug, category_slug, is_claimed, claim_status")
    .eq("id", supplierId)
    .maybeSingle();
  if (!supplier?.vendor_id || !supplier.is_claimed || supplier.claim_status !== "approved") {
    return { ok: false, message: "Only an approved claimed supplier can request updates." };
  }

  const { data: membership } = await supabase
    .from("vendor_users")
    .select("vendor_id")
    .eq("vendor_id", supplier.vendor_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) return { ok: false, message: "You do not have access to manage this supplier." };

  const { error } = await supabase.from("supplier_update_requests").insert({
    supplier_id: supplier.id,
    submitted_by: user.id,
    ...parsed.proposal
  });
  if (error?.code === "23505") return { ok: false, message: "This supplier already has an update waiting for review." };
  if (error) return { ok: false, message: error.message };

  revalidatePath("/vendor");
  revalidatePath("/admin/supplier-updates");
  revalidatePath(publicSupplierProfilePath(supplier.category_slug as SupplierCategorySlug, supplier.slug));
  return { ok: true, message: "Your supplier profile update has been sent for review." };
}

function value(formData: FormData, key: string) {
  return formData.get(key)?.toString().trim() ?? "";
}
