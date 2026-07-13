export const VENUE_IMAGE_SUBMISSIONS_BUCKET = "venue-image-submissions";
export const VENUE_IMAGES_BUCKET = "venue-images";

export const MAX_IMAGE_FILES_PER_BATCH = 8;
export const MAX_PENDING_IMAGES_PER_VENUE = 24;
export const MAX_ORIGINAL_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_STAGED_IMAGE_BYTES = 10 * 1024 * 1024;

export const allowedVenueImageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export type VenueImageMimeType = (typeof allowedVenueImageMimeTypes)[number];
export type VenueImageSubmissionStatus = "pending" | "approved" | "rejected";

export type RegisterVenueImageItem = {
  storagePath: string;
  originalFileName: string;
  mimeType: VenueImageMimeType;
  fileSize: number;
  altText: string;
  creditText: string | null;
  isPreferred: boolean;
};

export type RegisterVenueImagesInput = {
  venueId: string;
  permissionConfirmed: boolean;
  items: RegisterVenueImageItem[];
};

export type VenueImageActionState = {
  ok: boolean;
  message: string;
};

export function isVenueImageMimeType(value: string): value is VenueImageMimeType {
  return allowedVenueImageMimeTypes.includes(value as VenueImageMimeType);
}

export function isValidSubmissionPath(path: string, userId: string, venueId: string) {
  const escapedUserId = escapeRegExp(userId);
  const escapedVenueId = escapeRegExp(venueId);
  return new RegExp(`^${escapedUserId}/${escapedVenueId}/[0-9a-f-]{36}\\.(?:jpe?g|png|webp)$`, "i").test(path);
}

export function validateRegistrationInput(input: RegisterVenueImagesInput, userId: string): string | null {
  if (!input.permissionConfirmed) return "Confirm that you have permission to display these photos.";
  if (!input.venueId) return "Choose a venue before uploading photos.";
  if (input.items.length < 1 || input.items.length > MAX_IMAGE_FILES_PER_BATCH) {
    return `Choose between 1 and ${MAX_IMAGE_FILES_PER_BATCH} photos at a time.`;
  }
  if (input.items.filter((item) => item.isPreferred).length > 1) return "Choose only one preferred main photo.";

  for (const item of input.items) {
    if (!isValidSubmissionPath(item.storagePath, userId, input.venueId)) return "One of the uploaded file paths is invalid.";
    if (!item.originalFileName.trim() || item.originalFileName.length > 240) return "Each photo needs a valid file name.";
    if (!isVenueImageMimeType(item.mimeType)) return "Only JPEG, PNG and WebP images are supported.";
    if (!Number.isInteger(item.fileSize) || item.fileSize < 1 || item.fileSize > MAX_STAGED_IMAGE_BYTES) {
      return "Each prepared photo must be 10 MB or smaller.";
    }
    const altText = item.altText.trim();
    if (altText.length < 3 || altText.length > 300) return "Add descriptive alt text between 3 and 300 characters for every photo.";
    if (item.creditText && item.creditText.trim().length > 200) return "Photo credits must be 200 characters or fewer.";
  }

  return null;
}

export function detectImageMimeType(bytes: Uint8Array): VenueImageMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function extensionForMimeType(mimeType: VenueImageMimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export function safeImageFileStem(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "venue-photo";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
