"use server";

import { allowPublicFormSubmission } from "@/lib/rate-limit";
import { notifySupplierApplication } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { supplierCategories } from "@/data/supplier-categories";

export type SupplierApplicationState = { ok: boolean; message: string } | null;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function value(formData: FormData, key: string, maxLength: number) {
  return (formData.get(key)?.toString().trim() ?? "").slice(0, maxLength);
}

function optionalUrl(input: string) {
  if (!input) return null;
  try {
    const url = new URL(input);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function submitSupplierApplication(_: SupplierApplicationState, formData: FormData): Promise<SupplierApplicationState> {
  const companyName = value(formData, "companyName", 120);
  const ownerName = value(formData, "ownerName", 120);
  const email = value(formData, "email", 254).toLowerCase();
  const phone = value(formData, "phone", 40);
  const category = value(formData, "category", 60);
  const location = value(formData, "location", 120);
  const coverageRadius = Number(value(formData, "coverageRadius", 5));
  const description = value(formData, "description", 2_000);
  const services = value(formData, "services", 1_000);
  const pricing = value(formData, "pricing", 500);
  const website = value(formData, "website", 500);
  const instagram = value(formData, "instagram", 200);
  const facebook = value(formData, "facebook", 500);
  const galleryUrls = value(formData, "galleryUrls", 2_000);
  const websiteTrap = value(formData, "companyWebsite", 200);
  const termsAccepted = formData.get("termsAccepted") === "on";

  if (websiteTrap) return { ok: true, message: "Thanks — your application has been received." };
  if (!companyName || !ownerName || !email || !phone || !category || !location || !description || !services || !termsAccepted) {
    return { ok: false, message: "Please complete the required fields and accept the supplier terms." };
  }
  if (!emailPattern.test(email)) return { ok: false, message: "Use a valid business email address." };
  if (!supplierCategories.includes(category as (typeof supplierCategories)[number])) return { ok: false, message: "Choose a valid supplier category." };
  if (!Number.isInteger(coverageRadius) || coverageRadius < 0 || coverageRadius > 500) {
    return { ok: false, message: "Enter a coverage radius between 0 and 500 miles." };
  }
  if ((website && !optionalUrl(website)) || (facebook && !optionalUrl(facebook))) {
    return { ok: false, message: "Website and Facebook links must be valid web addresses." };
  }
  if (description.length < 40 || services.length < 3) return { ok: false, message: "Tell us a little more about your business and services." };
  if (!(await allowPublicFormSubmission("supplier-application", 3))) return { ok: false, message: "Please wait a few minutes before trying again." };

  const supabase = createAdminClient();
  if (!supabase) return { ok: false, message: "Applications are temporarily unavailable. Please try again shortly." };

  const { data, error } = await supabase
    .from("supplier_applications")
    .insert({
      business_name: companyName,
      owner_name: ownerName,
      email,
      phone,
      website_url: optionalUrl(website),
      instagram_handle: instagram || null,
      facebook_url: optionalUrl(facebook),
      location,
      coverage_radius_miles: coverageRadius,
      category,
      description,
      services,
      pricing: pricing || null,
      gallery_urls: galleryUrls || null,
      terms_accepted_at: new Date().toISOString(),
      status: "pending"
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, message: "We could not submit your application. Please try again." };

  await notifySupplierApplication({
    applicationId: data.id,
    businessName: companyName,
    ownerName,
    email,
    category,
    location
  });

  return { ok: true, message: "Application received. We’ll review it and email you with the next step." };
}
