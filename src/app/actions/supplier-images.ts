"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { requireAdmin } from "@/lib/auth";
import {
  MAX_PENDING_IMAGES_PER_SUPPLIER,
  SUPPLIER_IMAGE_SUBMISSIONS_BUCKET,
  SUPPLIER_IMAGES_BUCKET,
  validateSupplierRegistrationInput,
  type RegisterSupplierImagesInput,
  type SupplierImageActionState,
  type SupplierImageMimeType
} from "@/lib/supplier-image-submissions";
import { publicSupplierCategoryPath, publicSupplierProfilePath } from "@/lib/supplier-public-routes";
import { createClient } from "@/lib/supabase/server";
import { detectImageMimeType, extensionForMimeType, safeImageFileStem } from "@/lib/venue-image-submissions";
import type { SupplierCategorySlug } from "@/types/supplier";

type StorageListItem = { name: string; metadata?: { mimetype?: string; size?: number | string } | null };

export async function registerSupplierImageSubmissions(input: RegisterSupplierImagesInput): Promise<SupplierImageActionState> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Supplier photo uploads are not configured yet." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in again before uploading photos." };

  const validationError = validateSupplierRegistrationInput(input, user.id);
  if (validationError) return { ok: false, message: validationError };

  const [{ data: supplier }, pendingResult] = await Promise.all([
    supabase
      .from("supplier_listings")
      .select("id, vendor_id, name, slug, category_slug, is_claimed, claim_status")
      .eq("id", input.supplierId)
      .eq("is_claimed", true)
      .eq("claim_status", "approved")
      .maybeSingle(),
    supabase
      .from("supplier_image_submissions")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", input.supplierId)
      .eq("status", "pending")
  ]);
  if (!supplier?.vendor_id) return { ok: false, message: "Only an approved claimed supplier can upload photos for this listing." };

  const { data: membership } = await supabase
    .from("vendor_users")
    .select("vendor_id")
    .eq("vendor_id", supplier.vendor_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) return { ok: false, message: "You do not have access to manage this supplier." };
  if ((pendingResult.count ?? 0) + input.items.length > MAX_PENDING_IMAGES_PER_SUPPLIER) {
    return { ok: false, message: `This supplier can have up to ${MAX_PENDING_IMAGES_PER_SUPPLIER} photos awaiting review. Remove older submissions or wait for review first.` };
  }

  const folder = `${user.id}/${input.supplierId}`;
  const { data: listedObjects, error: listError } = await supabase.storage
    .from(SUPPLIER_IMAGE_SUBMISSIONS_BUCKET)
    .list(folder, { limit: 100 });
  if (listError) return { ok: false, message: "The uploaded photos could not be verified. Please try again." };

  const objectsByName = new Map((listedObjects as StorageListItem[] | null ?? []).map((item) => [item.name, item]));
  const confirmedAt = new Date().toISOString();
  const rows = input.items.map((item) => {
    const fileName = item.storagePath.split("/").at(-1) ?? "";
    const storedObject = objectsByName.get(fileName);
    return {
      supplier_id: input.supplierId,
      submitted_by: user.id,
      storage_path: item.storagePath,
      original_file_name: item.originalFileName.trim(),
      mime_type: item.mimeType,
      file_size: Number(storedObject?.metadata?.size ?? item.fileSize),
      alt_text: item.altText.trim(),
      credit_text: item.creditText?.trim() || null,
      is_preferred: item.isPreferred,
      permission_confirmed: true,
      permission_confirmed_at: confirmedAt,
      status: "pending" as const
    };
  });

  if (rows.some((row) => !objectsByName.has(row.storage_path.split("/").at(-1) ?? ""))) {
    return { ok: false, message: "At least one uploaded photo is missing. Please choose the files and try again." };
  }
  const invalidStoredMetadata = rows.some((row) => {
    const original = input.items.find((item) => item.storagePath === row.storage_path);
    const storedMime = objectsByName.get(row.storage_path.split("/").at(-1) ?? "")?.metadata?.mimetype;
    return !original || row.file_size !== original.fileSize || storedMime !== original.mimeType;
  });
  if (invalidStoredMetadata) {
    await supabase.storage.from(SUPPLIER_IMAGE_SUBMISSIONS_BUCKET).remove(input.items.map((item) => item.storagePath));
    return { ok: false, message: "A photo did not pass the upload verification check. Please try it again." };
  }

  const { data: submissions, error: insertError } = await supabase
    .from("supplier_image_submissions")
    .insert(rows)
    .select("id");
  if (insertError || !submissions?.length) {
    await supabase.storage.from(SUPPLIER_IMAGE_SUBMISSIONS_BUCKET).remove(input.items.map((item) => item.storagePath));
    return { ok: false, message: insertError?.message ?? "The photos could not be added to the review queue." };
  }

  revalidateSupplierImagePaths(supplier.category_slug as SupplierCategorySlug, supplier.slug);
  return { ok: true, message: `${submissions.length} photo${submissions.length === 1 ? " is" : "s are"} safely uploaded and awaiting EverAft review.` };
}

export async function deleteSupplierImageSubmission(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirectWithVendorMessage("Supplier photo uploads are not configured yet.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?message=Sign+in+again+to+manage+your+photos&redirectTo=%2Fvendor");

  const submissionId = formData.get("submissionId")?.toString() ?? "";
  const { data: submission } = await supabase
    .from("supplier_image_submissions")
    .select("id, storage_path, status")
    .eq("id", submissionId)
    .eq("submitted_by", user.id)
    .in("status", ["pending", "rejected"])
    .maybeSingle();
  if (!submission) redirectWithVendorMessage("That supplier photo can no longer be removed from this queue.");

  const { error: deleteError } = await supabase.from("supplier_image_submissions").delete().eq("id", submission.id);
  if (deleteError) redirectWithVendorMessage(deleteError.message);
  const { error: storageError } = await supabase.storage.from(SUPPLIER_IMAGE_SUBMISSIONS_BUCKET).remove([submission.storage_path]);
  if (storageError) console.error("Could not remove discarded supplier image object", storageError);

  revalidatePath("/vendor");
  revalidatePath("/admin");
  revalidatePath("/admin/supplier-images");
  redirectWithVendorMessage("Supplier photo removed.");
}

export async function approveSupplierImageSubmission(formData: FormData) {
  const { user: adminUser } = await requireAdmin();
  const supabase = await createClient();
  if (!supabase) redirectWithAdminMessage("Supplier photo review is not configured yet.");

  const submissionId = formData.get("submissionId")?.toString() ?? "";
  const makePrimary = formData.get("makePrimary") === "on";
  const adminNotes = cleanAdminNotes(formData);
  const { data: submission } = await supabase.from("supplier_image_submissions").select("*").eq("id", submissionId).eq("status", "pending").maybeSingle();
  if (!submission) redirectWithAdminMessage("That supplier photo is no longer awaiting review.");

  const reviewStartedAt = new Date().toISOString();
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: reviewLock, error: reviewLockError } = await supabase
    .from("supplier_image_submissions")
    .update({ reviewed_at: reviewStartedAt, reviewed_by: adminUser.id })
    .eq("id", submission.id)
    .eq("status", "pending")
    .or(`reviewed_at.is.null,reviewed_at.lt.${staleBefore}`)
    .select("id")
    .maybeSingle();
  if (reviewLockError || !reviewLock) redirectWithAdminMessage("Another admin is already reviewing that supplier photo. Refresh before trying again.");

  const failApproval = async (message: string): Promise<never> => {
    await supabase.from("supplier_image_submissions").update({ reviewed_at: null, reviewed_by: null })
      .eq("id", submission.id).eq("status", "pending").eq("reviewed_by", adminUser.id).eq("reviewed_at", reviewStartedAt);
    redirectWithAdminMessage(message);
  };

  const [{ data: supplier }, { data: existingImages }] = await Promise.all([
    supabase.from("supplier_listings").select("id, name, slug, category_slug, hero_image_url, image_credit, image_permission_status, reviewed_at, reviewed_by").eq("id", submission.supplier_id).single(),
    supabase.from("supplier_images").select("id, sort_order").eq("supplier_id", submission.supplier_id).eq("permission_status", "approved").order("sort_order")
  ]);
  if (!supplier) return failApproval("The supplier linked to this photo could not be found.");

  const { data: stagedFile, error: downloadError } = await supabase.storage.from(SUPPLIER_IMAGE_SUBMISSIONS_BUCKET).download(submission.storage_path);
  if (downloadError || !stagedFile) return failApproval("The private supplier photo could not be opened for review.");
  const bytes = new Uint8Array(await stagedFile.arrayBuffer());
  const detectedMime = detectImageMimeType(bytes);
  if (!detectedMime || detectedMime !== submission.mime_type || bytes.byteLength !== submission.file_size) {
    return failApproval("This file failed its final image safety check and was not published.");
  }

  const publishableBytes = await preparePublicSupplierImage(bytes).catch(() => null);
  if (!publishableBytes) return failApproval("This file could not be safely processed as a normal supplier photograph and was not published.");
  const publicMime: SupplierImageMimeType = "image/jpeg";
  const publicPath = `${submission.supplier_id}/${submission.id}-${safeImageFileStem(submission.original_file_name)}.${extensionForMimeType(publicMime)}`;
  const { error: uploadError } = await supabase.storage.from(SUPPLIER_IMAGES_BUCKET).upload(publicPath, publishableBytes, {
    cacheControl: "31536000", contentType: publicMime, upsert: false
  });
  if (uploadError) return failApproval(`The approved supplier photo could not be published: ${uploadError.message}`);

  const { data: publicUrlData } = supabase.storage.from(SUPPLIER_IMAGES_BUCKET).getPublicUrl(publicPath);
  const shouldBecomePrimary = makePrimary || supplier.image_permission_status !== "approved" || !supplier.hero_image_url || (existingImages?.length ?? 0) === 0;
  const sortOrders = (existingImages ?? []).map((image) => image.sort_order);
  const sortOrder = shouldBecomePrimary ? Math.min(0, ...(sortOrders.length ? sortOrders : [0])) - 1 : Math.max(0, ...(sortOrders.length ? sortOrders : [0])) + 1;
  const { data: publishedImage, error: imageInsertError } = await supabase.from("supplier_images").insert({
    supplier_id: submission.supplier_id,
    url: publicUrlData.publicUrl,
    alt: submission.alt_text,
    credit_text: submission.credit_text,
    permission_status: "approved",
    sort_order: sortOrder
  }).select("id").single();
  if (imageInsertError || !publishedImage) {
    await supabase.storage.from(SUPPLIER_IMAGES_BUCKET).remove([publicPath]);
    return failApproval(imageInsertError?.message ?? "The supplier gallery record could not be created.");
  }

  if (shouldBecomePrimary) {
    const { error: supplierUpdateError } = await supabase.from("supplier_listings").update({
      hero_image_url: publicUrlData.publicUrl,
      image_permission_status: "approved",
      image_credit: submission.credit_text,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUser.id
    }).eq("id", supplier.id);
    if (supplierUpdateError) {
      await rollbackPublishedImage(supabase, publishedImage.id, publicPath);
      return failApproval(supplierUpdateError.message);
    }
  }

  const { data: reviewedSubmission, error: submissionUpdateError } = await supabase.from("supplier_image_submissions").update({
    status: "approved",
    admin_notes: adminNotes,
    published_url: publicUrlData.publicUrl,
    published_image_id: publishedImage.id,
    reviewed_at: new Date().toISOString(),
    reviewed_by: adminUser.id
  }).eq("id", submission.id).eq("status", "pending").eq("reviewed_by", adminUser.id).eq("reviewed_at", reviewStartedAt).select("id").maybeSingle();
  if (submissionUpdateError || !reviewedSubmission) {
    if (shouldBecomePrimary) {
      await supabase.from("supplier_listings").update({
        hero_image_url: supplier.hero_image_url,
        image_permission_status: supplier.image_permission_status,
        image_credit: supplier.image_credit,
        reviewed_at: supplier.reviewed_at,
        reviewed_by: supplier.reviewed_by
      }).eq("id", supplier.id);
    }
    await rollbackPublishedImage(supabase, publishedImage.id, publicPath);
    return failApproval(submissionUpdateError?.message ?? "The supplier photo review changed before publishing completed. No duplicate was created.");
  }

  const { error: stagedDeleteError } = await supabase.storage.from(SUPPLIER_IMAGE_SUBMISSIONS_BUCKET).remove([submission.storage_path]);
  if (stagedDeleteError) console.error("Could not remove approved private supplier image object", stagedDeleteError);
  revalidateSupplierImagePaths(supplier.category_slug as SupplierCategorySlug, supplier.slug);
  redirectWithAdminMessage("Supplier photo approved and published.");
}

export async function rejectSupplierImageSubmission(formData: FormData) {
  const { user: adminUser } = await requireAdmin();
  const supabase = await createClient();
  if (!supabase) redirectWithAdminMessage("Supplier photo review is not configured yet.");
  const submissionId = formData.get("submissionId")?.toString() ?? "";
  const adminNotes = cleanAdminNotes(formData);
  if (!adminNotes) redirectWithAdminMessage("Add a short reason so the supplier member knows what to change.");

  const { data: submission } = await supabase.from("supplier_image_submissions").select("id, status").eq("id", submissionId).eq("status", "pending").maybeSingle();
  if (!submission) redirectWithAdminMessage("That supplier photo is no longer awaiting review.");
  const { error } = await supabase.from("supplier_image_submissions").update({
    status: "rejected", admin_notes: adminNotes, reviewed_at: new Date().toISOString(), reviewed_by: adminUser.id
  }).eq("id", submission.id).eq("status", "pending");
  if (error) redirectWithAdminMessage(error.message);
  revalidatePath("/admin");
  revalidatePath("/admin/supplier-images");
  revalidatePath("/vendor");
  redirectWithAdminMessage("Supplier photo declined and returned with your note.");
}

async function rollbackPublishedImage(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, imageId: string, path: string) {
  await Promise.allSettled([
    supabase.from("supplier_images").delete().eq("id", imageId),
    supabase.storage.from(SUPPLIER_IMAGES_BUCKET).remove([path])
  ]);
}

async function preparePublicSupplierImage(bytes: Uint8Array) {
  const output = await sharp(bytes, { animated: false, failOn: "warning", limitInputPixels: 40_000_000 })
    .rotate().flatten({ background: "#ffffff" })
    .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
}

function cleanAdminNotes(formData: FormData) {
  return formData.get("adminNotes")?.toString().trim().slice(0, 1000) || null;
}

function revalidateSupplierImagePaths(categorySlug: SupplierCategorySlug, supplierSlug: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/supplier-images");
  revalidatePath("/vendor");
  revalidatePath(publicSupplierCategoryPath(categorySlug));
  revalidatePath(publicSupplierProfilePath(categorySlug, supplierSlug));
  revalidatePath("/planning-hub/suppliers");
  revalidatePath(`/planning-hub/suppliers/${categorySlug}`);
}

function redirectWithVendorMessage(message: string): never {
  redirect(`/vendor?message=${encodeURIComponent(message)}`);
}

function redirectWithAdminMessage(message: string): never {
  redirect(`/admin/supplier-images?message=${encodeURIComponent(message)}`);
}
