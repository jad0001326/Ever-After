"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { requireAdmin } from "@/lib/auth";
import { notifyVenueImageReviewed, notifyVenueImagesSubmitted } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import {
  detectImageMimeType,
  extensionForMimeType,
  MAX_PENDING_IMAGES_PER_VENUE,
  safeImageFileStem,
  validateRegistrationInput,
  VENUE_IMAGE_SUBMISSIONS_BUCKET,
  VENUE_IMAGES_BUCKET,
  type RegisterVenueImagesInput,
  type VenueImageActionState,
  type VenueImageMimeType
} from "@/lib/venue-image-submissions";

type StorageListItem = {
  name: string;
  metadata?: { mimetype?: string; size?: number | string } | null;
};

export async function registerVenueImageSubmissions(input: RegisterVenueImagesInput): Promise<VenueImageActionState> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Photo uploads are not configured yet." };

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in again before uploading photos." };

  const validationError = validateRegistrationInput(input, user.id);
  if (validationError) return { ok: false, message: validationError };

  const [{ data: venue }, pendingResult] = await Promise.all([
    supabase
      .from("venues")
      .select("id, name, slug, claimed_by, is_claimed, claim_status")
      .eq("id", input.venueId)
      .eq("claimed_by", user.id)
      .eq("is_claimed", true)
      .eq("claim_status", "approved")
      .maybeSingle(),
    supabase
      .from("venue_image_submissions")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", input.venueId)
      .eq("status", "pending")
  ]);

  if (!venue) return { ok: false, message: "Only the approved venue owner can upload photos for this listing." };
  if ((pendingResult.count ?? 0) + input.items.length > MAX_PENDING_IMAGES_PER_VENUE) {
    return { ok: false, message: `This venue can have up to ${MAX_PENDING_IMAGES_PER_VENUE} photos awaiting review. Remove older submissions or wait for review first.` };
  }

  const folder = `${user.id}/${input.venueId}`;
  const { data: listedObjects, error: listError } = await supabase.storage
    .from(VENUE_IMAGE_SUBMISSIONS_BUCKET)
    .list(folder, { limit: 100 });

  if (listError) return { ok: false, message: "The uploaded photos could not be verified. Please try again." };

  const objectsByName = new Map((listedObjects as StorageListItem[] | null ?? []).map((item) => [item.name, item]));
  const confirmedAt = new Date().toISOString();
  const rows = input.items.map((item) => {
    const fileName = item.storagePath.split("/").at(-1) ?? "";
    const storedObject = objectsByName.get(fileName);
    const storedSize = Number(storedObject?.metadata?.size ?? item.fileSize);
    const storedMime = storedObject?.metadata?.mimetype ?? item.mimeType;
    return {
      venue_id: input.venueId,
      submitted_by: user.id,
      storage_path: item.storagePath,
      original_file_name: item.originalFileName.trim(),
      mime_type: item.mimeType,
      file_size: storedSize,
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
    return !original || row.file_size !== original.fileSize || row.mime_type !== original.mimeType;
  });
  if (invalidStoredMetadata) {
    await supabase.storage.from(VENUE_IMAGE_SUBMISSIONS_BUCKET).remove(input.items.map((item) => item.storagePath));
    return { ok: false, message: "A photo did not pass the upload verification check. Please try it again." };
  }

  const { data: submissions, error: insertError } = await supabase
    .from("venue_image_submissions")
    .insert(rows)
    .select("id");

  if (insertError || !submissions?.length) {
    await supabase.storage.from(VENUE_IMAGE_SUBMISSIONS_BUCKET).remove(input.items.map((item) => item.storagePath));
    return { ok: false, message: insertError?.message ?? "The photos could not be added to the review queue." };
  }

  await notifyVenueImagesSubmitted({
    submissionId: submissions[0].id,
    venueName: venue.name,
    venueSlug: venue.slug,
    requesterEmail: user.email ?? null,
    imageCount: submissions.length
  });

  revalidatePath("/vendor");
  revalidatePath("/admin");
  revalidatePath("/admin/images");
  return { ok: true, message: `${submissions.length} photo${submissions.length === 1 ? " is" : "s are"} safely uploaded and awaiting EverAft review.` };
}

export async function deleteVenueImageSubmission(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirectWithVendorMessage("Photo uploads are not configured yet.");

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?message=Sign+in+again+to+manage+your+photos&redirectTo=%2Fvendor");

  const submissionId = formData.get("submissionId")?.toString() ?? "";
  const { data: submission } = await supabase
    .from("venue_image_submissions")
    .select("id, storage_path, status")
    .eq("id", submissionId)
    .eq("submitted_by", user.id)
    .in("status", ["pending", "rejected"])
    .maybeSingle();

  if (!submission) redirectWithVendorMessage("That photo can no longer be removed from this queue.");

  const { error: deleteError } = await supabase.from("venue_image_submissions").delete().eq("id", submission.id);
  if (deleteError) redirectWithVendorMessage(deleteError.message);

  const { error: storageError } = await supabase.storage.from(VENUE_IMAGE_SUBMISSIONS_BUCKET).remove([submission.storage_path]);
  if (storageError) console.error("Could not remove discarded venue image object", storageError);

  revalidatePath("/vendor");
  revalidatePath("/admin");
  revalidatePath("/admin/images");
  redirectWithVendorMessage("Photo removed.");
}

export async function approveVenueImageSubmission(formData: FormData) {
  const { user: adminUser } = await requireAdmin();
  const supabase = await createClient();
  if (!supabase) redirectWithAdminMessage("Photo review is not configured yet.");

  const submissionId = formData.get("submissionId")?.toString() ?? "";
  const makePrimary = formData.get("makePrimary") === "on";
  const adminNotes = cleanAdminNotes(formData);

  const { data: submission } = await supabase
    .from("venue_image_submissions")
    .select("*")
    .eq("id", submissionId)
    .eq("status", "pending")
    .maybeSingle();
  if (!submission) redirectWithAdminMessage("That photo is no longer awaiting review.");

  const reviewStartedAt = new Date().toISOString();
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: reviewLock, error: reviewLockError } = await supabase
    .from("venue_image_submissions")
    .update({ reviewed_at: reviewStartedAt, reviewed_by: adminUser.id })
    .eq("id", submission.id)
    .eq("status", "pending")
    .or(`reviewed_at.is.null,reviewed_at.lt.${staleBefore}`)
    .select("id")
    .maybeSingle();
  if (reviewLockError || !reviewLock) redirectWithAdminMessage("Another admin is already reviewing that photo. Refresh the queue before trying again.");

  const failApproval = async (message: string): Promise<never> => {
    await supabase
      .from("venue_image_submissions")
      .update({ reviewed_at: null, reviewed_by: null })
      .eq("id", submission.id)
      .eq("status", "pending")
      .eq("reviewed_by", adminUser.id)
      .eq("reviewed_at", reviewStartedAt);
    redirectWithAdminMessage(message);
  };

  const [{ data: venue }, { data: existingImages }, { data: vendorProfile }] = await Promise.all([
    supabase
      .from("venues")
      .select("id, name, slug, hero_image, image_permission_status, image_is_representative, image_credit")
      .eq("id", submission.venue_id)
      .single(),
    supabase.from("venue_images").select("id, sort_order").eq("venue_id", submission.venue_id).order("sort_order"),
    supabase.from("profiles").select("email").eq("id", submission.submitted_by).maybeSingle()
  ]);
  if (!venue) return failApproval("The venue linked to this photo could not be found.");

  const { data: stagedFile, error: downloadError } = await supabase.storage
    .from(VENUE_IMAGE_SUBMISSIONS_BUCKET)
    .download(submission.storage_path);
  if (downloadError || !stagedFile) return failApproval("The private photo file could not be opened for review.");

  const bytes = new Uint8Array(await stagedFile.arrayBuffer());
  const detectedMime = detectImageMimeType(bytes);
  if (!detectedMime || detectedMime !== submission.mime_type || bytes.byteLength !== submission.file_size) {
    return failApproval("This file failed its final image safety check and was not published.");
  }

  const publishableBytes = await preparePublicVenueImage(bytes).catch(() => null);
  if (!publishableBytes) return failApproval("This file could not be safely processed as a normal venue photograph and was not published.");

  const publicMime: VenueImageMimeType = "image/jpeg";
  const extension = extensionForMimeType(publicMime);
  const publicPath = `${submission.venue_id}/${submission.id}-${safeImageFileStem(submission.original_file_name)}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(VENUE_IMAGES_BUCKET).upload(publicPath, publishableBytes, {
    cacheControl: "31536000",
    contentType: publicMime,
    upsert: false
  });
  if (uploadError) return failApproval(`The approved photo could not be published: ${uploadError.message}`);

  const { data: publicUrlData } = supabase.storage.from(VENUE_IMAGES_BUCKET).getPublicUrl(publicPath);
  const shouldBecomePrimary = makePrimary || venue.image_is_representative || (existingImages?.length ?? 0) === 0;
  const sortOrders = (existingImages ?? []).map((image) => image.sort_order);
  const sortOrder = shouldBecomePrimary
    ? Math.min(0, ...(sortOrders.length ? sortOrders : [0])) - 1
    : Math.max(0, ...(sortOrders.length ? sortOrders : [0])) + 1;

  const { data: publishedImage, error: imageInsertError } = await supabase
    .from("venue_images")
    .insert({
      venue_id: submission.venue_id,
      url: publicUrlData.publicUrl,
      alt: submission.alt_text,
      sort_order: sortOrder
    })
    .select("id")
    .single();
  if (imageInsertError || !publishedImage) {
    await supabase.storage.from(VENUE_IMAGES_BUCKET).remove([publicPath]);
    return failApproval(imageInsertError?.message ?? "The photo gallery record could not be created.");
  }

  if (shouldBecomePrimary) {
    const { error: venueUpdateError } = await supabase
      .from("venues")
      .update({
        hero_image: publicUrlData.publicUrl,
        image_permission_status: "approved",
        image_is_representative: false,
        image_credit: submission.credit_text
      })
      .eq("id", venue.id);
    if (venueUpdateError) {
      await rollbackPublishedImage(supabase, publishedImage.id, publicPath);
      return failApproval(venueUpdateError.message);
    }
  }

  const { data: reviewedSubmission, error: submissionUpdateError } = await supabase
    .from("venue_image_submissions")
    .update({
      status: "approved",
      admin_notes: adminNotes,
      published_url: publicUrlData.publicUrl,
      published_image_id: publishedImage.id,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUser.id
    })
    .eq("id", submission.id)
    .eq("status", "pending")
    .eq("reviewed_by", adminUser.id)
    .eq("reviewed_at", reviewStartedAt)
    .select("id")
    .maybeSingle();

  if (submissionUpdateError || !reviewedSubmission) {
    if (shouldBecomePrimary) {
      await supabase.from("venues").update({
        hero_image: venue.hero_image,
        image_permission_status: venue.image_permission_status,
        image_is_representative: venue.image_is_representative,
        image_credit: venue.image_credit
      }).eq("id", venue.id);
    }
    await rollbackPublishedImage(supabase, publishedImage.id, publicPath);
    return failApproval(submissionUpdateError?.message ?? "The photo review changed before publishing completed. No duplicate was created.");
  }

  const { error: stagedDeleteError } = await supabase.storage.from(VENUE_IMAGE_SUBMISSIONS_BUCKET).remove([submission.storage_path]);
  if (stagedDeleteError) console.error("Could not remove approved private venue image object", stagedDeleteError);

  await notifyVenueImageReviewed({
    submissionId: submission.id,
    venueName: venue.name,
    venueSlug: venue.slug,
    vendorEmail: vendorProfile?.email ?? null,
    status: "approved",
    adminNotes
  });

  revalidateImagePaths(venue.slug);
  redirectWithAdminMessage("Photo approved and published.");
}

export async function rejectVenueImageSubmission(formData: FormData) {
  const { user: adminUser } = await requireAdmin();
  const supabase = await createClient();
  if (!supabase) redirectWithAdminMessage("Photo review is not configured yet.");

  const submissionId = formData.get("submissionId")?.toString() ?? "";
  const adminNotes = cleanAdminNotes(formData);
  if (!adminNotes) redirectWithAdminMessage("Add a short reason so the venue owner knows what to change.");

  const { data: submission } = await supabase
    .from("venue_image_submissions")
    .select("id, venue_id, submitted_by, status")
    .eq("id", submissionId)
    .eq("status", "pending")
    .maybeSingle();
  if (!submission) redirectWithAdminMessage("That photo is no longer awaiting review.");

  const [{ data: venue }, { data: vendorProfile }] = await Promise.all([
    supabase.from("venues").select("name, slug").eq("id", submission.venue_id).single(),
    supabase.from("profiles").select("email").eq("id", submission.submitted_by).maybeSingle()
  ]);
  if (!venue) redirectWithAdminMessage("The venue linked to this photo could not be found.");

  const { error } = await supabase
    .from("venue_image_submissions")
    .update({
      status: "rejected",
      admin_notes: adminNotes,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUser.id
    })
    .eq("id", submission.id)
    .eq("status", "pending");
  if (error) redirectWithAdminMessage(error.message);

  await notifyVenueImageReviewed({
    submissionId: submission.id,
    venueName: venue.name,
    venueSlug: venue.slug,
    vendorEmail: vendorProfile?.email ?? null,
    status: "rejected",
    adminNotes
  });

  revalidateImagePaths(venue.slug);
  redirectWithAdminMessage("Photo declined and returned to the venue owner with your note.");
}

async function rollbackPublishedImage(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, imageId: string, path: string) {
  await Promise.allSettled([
    supabase.from("venue_images").delete().eq("id", imageId),
    supabase.storage.from(VENUE_IMAGES_BUCKET).remove([path])
  ]);
}

async function preparePublicVenueImage(bytes: Uint8Array) {
  const output = await sharp(bytes, {
    animated: false,
    failOn: "warning",
    limitInputPixels: 40_000_000
  })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();

  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
}

function cleanAdminNotes(formData: FormData) {
  return formData.get("adminNotes")?.toString().trim().slice(0, 1000) || null;
}

function revalidateImagePaths(venueSlug: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/images");
  revalidatePath("/vendor");
  revalidatePath("/venues");
  revalidatePath(`/venues/${venueSlug}`);
}

function redirectWithVendorMessage(message: string): never {
  redirect(`/vendor?message=${encodeURIComponent(message)}`);
}

function redirectWithAdminMessage(message: string): never {
  redirect(`/admin/images?message=${encodeURIComponent(message)}`);
}
