"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, ImagePlus, LoaderCircle, ShieldCheck, Star, Trash2, UploadCloud, XCircle } from "lucide-react";
import { deleteVenueImageSubmission, registerVenueImageSubmissions } from "@/app/actions/vendor-images";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { createClient } from "@/utils/supabase/client";
import {
  allowedVenueImageMimeTypes,
  MAX_IMAGE_FILES_PER_BATCH,
  MAX_ORIGINAL_IMAGE_BYTES,
  MAX_STAGED_IMAGE_BYTES,
  VENUE_IMAGE_SUBMISSIONS_BUCKET,
  type VenueImageSubmissionStatus
} from "@/lib/venue-image-submissions";

type SelectedPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  altText: string;
  creditText: string;
};

export type VendorImageSubmissionView = {
  id: string;
  venueId: string;
  altText: string;
  creditText: string | null;
  isPreferred: boolean;
  status: VenueImageSubmissionStatus;
  adminNotes: string | null;
  previewUrl: string | null;
  createdAt: string;
};

export function VendorImageUploader({
  venueId,
  venueName,
  userId,
  submissions
}: {
  venueId: string;
  venueName: string;
  userId: string;
  submissions: VendorImageSubmissionView[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef<string[]>([]);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [preferredId, setPreferredId] = useState<string | null>(null);
  const [permissionConfirmed, setPermissionConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => () => previewsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

  function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const incoming = Array.from(fileList);
    if (photos.length + incoming.length > MAX_IMAGE_FILES_PER_BATCH) {
      setFeedback({ ok: false, message: `Choose no more than ${MAX_IMAGE_FILES_PER_BATCH} photos in one batch.` });
      return;
    }

    const invalidType = incoming.find((file) => !allowedVenueImageMimeTypes.includes(file.type as (typeof allowedVenueImageMimeTypes)[number]));
    if (invalidType) {
      setFeedback({ ok: false, message: `${invalidType.name} is not a JPEG, PNG or WebP image.` });
      return;
    }
    const oversized = incoming.find((file) => file.size > MAX_ORIGINAL_IMAGE_BYTES);
    if (oversized) {
      setFeedback({ ok: false, message: `${oversized.name} is larger than 20 MB. Choose a smaller original.` });
      return;
    }

    const next = incoming.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      previewsRef.current.push(previewUrl);
      return { id: crypto.randomUUID(), file, previewUrl, altText: "", creditText: "" };
    });
    setPhotos((current) => [...current, ...next]);
    setPreferredId((current) => current ?? next[0]?.id ?? null);
    setFeedback(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function updatePhoto(id: string, values: Partial<Pick<SelectedPhoto, "altText" | "creditText">>) {
    setPhotos((current) => current.map((photo) => (photo.id === id ? { ...photo, ...values } : photo)));
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const removed = current.find((photo) => photo.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
        previewsRef.current = previewsRef.current.filter((url) => url !== removed.previewUrl);
      }
      const next = current.filter((photo) => photo.id !== id);
      setPreferredId((preferred) => (preferred === id ? next[0]?.id ?? null : preferred));
      return next;
    });
  }

  async function submitPhotos() {
    setFeedback(null);
    if (photos.length === 0) {
      setFeedback({ ok: false, message: "Choose at least one venue photo." });
      return;
    }
    if (photos.some((photo) => photo.altText.trim().length < 3)) {
      setFeedback({ ok: false, message: "Add a short visual description for every photo." });
      return;
    }
    if (!permissionConfirmed) {
      setFeedback({ ok: false, message: "Confirm that you have permission to display these photos." });
      return;
    }

    setBusy(true);
    setProgress(0);
    const supabase = createClient();
    const uploadedPaths: string[] = [];
    let registrationAttempted = false;

    try {
      const items = [];
      for (let index = 0; index < photos.length; index += 1) {
        const photo = photos[index];
        const prepared = await prepareVenueImage(photo.file);
        if (prepared.size > MAX_STAGED_IMAGE_BYTES) throw new Error(`${photo.file.name} is still larger than 10 MB after preparation.`);

        const path = `${userId}/${venueId}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from(VENUE_IMAGE_SUBMISSIONS_BUCKET).upload(path, prepared, {
          cacheControl: "3600",
          contentType: "image/jpeg",
          upsert: false
        });
        if (error) throw new Error(error.message);

        uploadedPaths.push(path);
        items.push({
          storagePath: path,
          originalFileName: photo.file.name,
          mimeType: "image/jpeg" as const,
          fileSize: prepared.size,
          altText: photo.altText.trim(),
          creditText: photo.creditText.trim() || null,
          isPreferred: preferredId === photo.id
        });
        setProgress(index + 1);
      }

      registrationAttempted = true;
      const result = await registerVenueImageSubmissions({ venueId, permissionConfirmed: true, items });
      if (!result.ok) {
        await supabase.storage.from(VENUE_IMAGE_SUBMISSIONS_BUCKET).remove(uploadedPaths);
        setFeedback(result);
        return;
      }

      photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      previewsRef.current = [];
      setPhotos([]);
      setPreferredId(null);
      setPermissionConfirmed(false);
      setFeedback(result);
      router.refresh();
    } catch (error) {
      // Once registration has started, a lost response may still mean the
      // database rows were created. Keep the private objects intact so the
      // review queue cannot be left pointing at deleted files.
      if (uploadedPaths.length && !registrationAttempted) {
        await supabase.storage.from(VENUE_IMAGE_SUBMISSIONS_BUCKET).remove(uploadedPaths);
      }
      setFeedback({ ok: false, message: error instanceof Error ? error.message : "The photos could not be uploaded." });
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-[#dfd2bd] bg-[#fbf8f3]">
      <div className="border-b border-[#e8dece] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-[#4a443c]"><ImagePlus size={17} /> Add venue photography</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Upload your own venue photos here. EverAft checks each one before it replaces the Venue Passport or appears in the public gallery.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#4f5e46] ring-1 ring-[#d8cfbf]"><ShieldCheck size={14} /> Private until approved</span>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <input
          ref={inputRef}
          aria-hidden="true"
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(event) => addFiles(event.target.files)}
          disabled={busy}
          tabIndex={-1}
        />
        <button
          aria-label="Choose venue photos"
          className="focus-ring group grid w-full place-items-center rounded-3xl border-2 border-dashed border-[#cdbb9f] bg-white px-5 py-8 text-center transition hover:border-[#9d7b45] hover:bg-[#fffdf9] disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy || photos.length >= MAX_IMAGE_FILES_PER_BATCH}
        >
          <span className="grid size-12 place-items-center rounded-full bg-[#f4efe7] text-[#846438] transition group-hover:bg-[#eee3d2]"><UploadCloud size={21} /></span>
          <span className="mt-3 font-semibold text-[#3f3a33]">Choose venue photos</span>
          <span className="mt-1 text-sm text-[var(--muted)]">JPEG, PNG or WebP · up to {MAX_IMAGE_FILES_PER_BATCH} photos · 20 MB each</span>
        </button>

        {photos.length ? (
          <div className="mt-5 grid gap-4">
            {photos.map((photo, index) => (
              <article className="grid gap-4 rounded-3xl border border-[var(--line)] bg-white p-4 md:grid-cols-[180px_1fr]" key={photo.id}>
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#eee8de]">
                  {/* A local object URL is deliberately rendered directly; it never leaves this browser before upload. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="h-full w-full object-cover" src={photo.previewUrl} alt="Selected venue photo preview" />
                  <button className="focus-ring absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-white/95 text-[#5b5146] shadow-sm" type="button" onClick={() => removePhoto(photo.id)} disabled={busy} aria-label={`Remove ${photo.file.name}`}><Trash2 size={15} /></button>
                </div>
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0"><p className="truncate text-sm font-semibold text-[#413b34]">{photo.file.name}</p><p className="mt-1 text-xs text-[var(--muted)]">Photo {index + 1} · {formatFileSize(photo.file.size)}</p></div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#fff9ef] px-3 py-1.5 text-xs font-semibold text-[#72572b]">
                      <input className="size-4 accent-[#846438]" type="radio" name={`preferred-${venueId}`} checked={preferredId === photo.id} onChange={() => setPreferredId(photo.id)} disabled={busy} />
                      <Star size={13} /> Preferred main
                    </label>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <label className="grid gap-2 text-sm font-medium text-[#4a443c]">What is shown? <span className="text-xs font-normal text-[var(--muted)]">Used as accessible image description</span><Input value={photo.altText} onChange={(event) => updatePhoto(photo.id, { altText: event.target.value })} maxLength={300} placeholder={`e.g. ${venueName} ceremony room with floral aisle`} disabled={busy} required /></label>
                    <label className="grid gap-2 text-sm font-medium text-[#4a443c]">Photo credit <span className="text-xs font-normal text-[var(--muted)]">Optional photographer or venue credit</span><Input value={photo.creditText} onChange={(event) => updatePhoto(photo.id, { creditText: event.target.value })} maxLength={200} placeholder="e.g. Photograph courtesy of the venue" disabled={busy} /></label>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {photos.length ? (
          <div className="mt-5 rounded-2xl border border-[#d8cfbf] bg-white p-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-[#4a443c]">
              <input className="mt-1 size-4 shrink-0 accent-[#334235]" type="checkbox" checked={permissionConfirmed} onChange={(event) => setPermissionConfirmed(event.target.checked)} disabled={busy} />
              <span><strong>I have permission to display these photos on EverAft.</strong> I own them, represent the venue, or have the photographer/rightsholder&apos;s consent, and any people shown have been handled appropriately.</span>
            </label>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-[var(--muted)]">Files are resized for the website and held privately until EverAft approves them.</p>
              <Button type="button" onClick={submitPhotos} disabled={busy || !permissionConfirmed} className="shrink-0">
                {busy ? <LoaderCircle className="animate-spin" size={17} /> : <UploadCloud size={17} />}
                {busy ? `Uploading ${progress}/${photos.length}` : `Submit ${photos.length} for review`}
              </Button>
            </div>
          </div>
        ) : null}

        {feedback ? <p aria-live="polite" className={feedback.ok ? "mt-4 rounded-2xl bg-[#eef4ea] px-4 py-3 text-sm text-[#31543a]" : "mt-4 rounded-2xl bg-[#fff3ed] px-4 py-3 text-sm text-[#913d24]"}>{feedback.message}</p> : null}

        <div className="mt-6 border-t border-[#e8dece] pt-5">
          <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-[#4a443c]">Submitted photos</p><p className="text-xs text-[var(--muted)]">{submissions.length} total</p></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {submissions.map((submission) => <SubmissionCard submission={submission} key={submission.id} />)}
            {submissions.length === 0 ? <p className="text-sm text-[var(--muted)]">No venue photos submitted yet.</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function SubmissionCard({ submission }: { submission: VendorImageSubmissionView }) {
  const status = submissionStatus(submission.status);
  const StatusIcon = status.icon;
  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
      <div className="relative aspect-[16/10] bg-[#eee8de]">
        {submission.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="h-full w-full object-cover" src={submission.previewUrl} alt={submission.altText} />
        ) : <div className="grid h-full place-items-center text-[#9a8e7d]"><ImagePlus size={24} /></div>}
        <span className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${status.classes}`}><StatusIcon size={13} /> {status.label}</span>
        {submission.isPreferred ? <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-[#72572b] shadow-sm"><Star size={12} /> Preferred</span> : null}
      </div>
      <div className="p-4">
        <p className="text-sm font-medium leading-5 text-[#433d35]">{submission.altText}</p>
        {submission.creditText ? <p className="mt-1 text-xs text-[var(--muted)]">Credit: {submission.creditText}</p> : null}
        <p className="mt-2 text-xs text-[var(--muted)]">Submitted {formatDate(submission.createdAt)}</p>
        {submission.adminNotes ? <p className="mt-3 rounded-xl bg-[#f7f3eb] px-3 py-2 text-xs leading-5 text-[#5d5246]">EverAft note: {submission.adminNotes}</p> : null}
        {submission.status !== "approved" ? (
          <form action={deleteVenueImageSubmission} className="mt-3">
            <input name="submissionId" type="hidden" value={submission.id} />
            <Button className="min-h-9 px-3 text-xs" type="submit" variant="ghost"><Trash2 size={13} /> Remove</Button>
          </form>
        ) : null}
      </div>
    </article>
  );
}

function submissionStatus(status: VenueImageSubmissionStatus) {
  if (status === "approved") return { label: "Live", classes: "bg-[#eef4ea] text-[#31543a]", icon: CheckCircle2 };
  if (status === "rejected") return { label: "Needs changes", classes: "bg-[#fff3ed] text-[#8b3f27]", icon: XCircle };
  return { label: "In review", classes: "bg-[#fff9ef] text-[#72572b]", icon: Clock3 };
}

async function prepareVenueImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const maxDimension = 2400;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("This browser could not prepare the selected image.");
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("A selected image could not be prepared."))), "image/jpeg", 0.86);
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}
