import {
  allowedVenueImageMimeTypes,
  isValidSubmissionPath,
  MAX_IMAGE_FILES_PER_BATCH,
  MAX_ORIGINAL_IMAGE_BYTES,
  MAX_STAGED_IMAGE_BYTES,
  type RegisterVenueImageItem,
  type VenueImageActionState,
  type VenueImageMimeType,
  type VenueImageSubmissionStatus
} from "@/lib/venue-image-submissions";

export const SUPPLIER_IMAGE_SUBMISSIONS_BUCKET = "supplier-image-submissions";
export const SUPPLIER_IMAGES_BUCKET = "supplier-images";
export const MAX_PENDING_IMAGES_PER_SUPPLIER = 24;

export {
  allowedVenueImageMimeTypes as allowedSupplierImageMimeTypes,
  MAX_IMAGE_FILES_PER_BATCH,
  MAX_ORIGINAL_IMAGE_BYTES,
  MAX_STAGED_IMAGE_BYTES
};

export type SupplierImageMimeType = VenueImageMimeType;
export type SupplierImageSubmissionStatus = VenueImageSubmissionStatus;
export type SupplierImageActionState = VenueImageActionState;

export type RegisterSupplierImagesInput = {
  supplierId: string;
  permissionConfirmed: boolean;
  items: RegisterVenueImageItem[];
};

export function validateSupplierRegistrationInput(input: RegisterSupplierImagesInput, userId: string): string | null {
  if (!input.permissionConfirmed) return "Confirm that you have permission to display these photos.";
  if (!input.supplierId) return "Choose a supplier before uploading photos.";
  if (input.items.length < 1 || input.items.length > MAX_IMAGE_FILES_PER_BATCH) {
    return `Choose between 1 and ${MAX_IMAGE_FILES_PER_BATCH} photos at a time.`;
  }
  if (input.items.filter((item) => item.isPreferred).length > 1) return "Choose only one preferred main photo.";

  for (const item of input.items) {
    if (!isValidSubmissionPath(item.storagePath, userId, input.supplierId)) return "One of the uploaded file paths is invalid.";
    if (!item.originalFileName.trim() || item.originalFileName.length > 240) return "Each photo needs a valid file name.";
    if (!allowedVenueImageMimeTypes.includes(item.mimeType)) return "Only JPEG, PNG and WebP images are supported.";
    if (!Number.isInteger(item.fileSize) || item.fileSize < 1 || item.fileSize > MAX_STAGED_IMAGE_BYTES) {
      return "Each prepared photo must be 10 MB or smaller.";
    }
    const altText = item.altText.trim();
    if (altText.length < 3 || altText.length > 300) return "Add descriptive alt text between 3 and 300 characters for every photo.";
    if (item.creditText && item.creditText.trim().length > 240) return "Photo credits must be 240 characters or fewer.";
  }

  return null;
}
