import { describe, expect, it } from "vitest";
import {
  detectImageMimeType,
  isValidSubmissionPath,
  safeImageFileStem,
  validateRegistrationInput,
  type RegisterVenueImagesInput
} from "./venue-image-submissions";

const userId = "c5e6c787-47dd-4588-8aec-380c4efc9ae6";
const venueId = "51fdbc32-c29c-4d5c-b517-5710fe367a55";
const fileId = "3cf73f00-26c9-4a0e-b833-0811e7bfcd7d";

function validInput(): RegisterVenueImagesInput {
  return {
    venueId,
    permissionConfirmed: true,
    items: [{
      storagePath: `${userId}/${venueId}/${fileId}.jpg`,
      originalFileName: "Ceremony room.jpg",
      mimeType: "image/jpeg",
      fileSize: 256_000,
      altText: "Ceremony room with a floral aisle",
      creditText: "Venue team",
      isPreferred: true
    }]
  };
}

describe("venue image submission validation", () => {
  it("accepts an owner-scoped, rights-confirmed upload", () => {
    expect(validateRegistrationInput(validInput(), userId)).toBeNull();
  });

  it("rejects a path belonging to another user", () => {
    const input = validInput();
    input.items[0].storagePath = `another-user/${venueId}/${fileId}.jpg`;
    expect(validateRegistrationInput(input, userId)).toMatch(/path.*invalid/i);
  });

  it("requires display permission and useful alt text", () => {
    const permissionInput = validInput();
    permissionInput.permissionConfirmed = false;
    expect(validateRegistrationInput(permissionInput, userId)).toMatch(/permission/i);

    const altInput = validInput();
    altInput.items[0].altText = "x";
    expect(validateRegistrationInput(altInput, userId)).toMatch(/alt text/i);
  });

  it("allows only one preferred main image", () => {
    const input = validInput();
    input.items.push({ ...input.items[0], storagePath: `${userId}/${venueId}/7430512a-49d8-43ff-a9e1-f08d67b06bc1.jpg` });
    expect(validateRegistrationInput(input, userId)).toMatch(/only one preferred/i);
  });
});

describe("venue image file checks", () => {
  it("recognises JPEG, PNG and WebP signatures", () => {
    expect(detectImageMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectImageMimeType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectImageMimeType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
    expect(detectImageMimeType(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });

  it("normalises names for public storage paths", () => {
    expect(safeImageFileStem("Hôtel Ceremony Room (Final).JPG")).toBe("hotel-ceremony-room-final");
    expect(isValidSubmissionPath(`${userId}/${venueId}/${fileId}.jpg`, userId, venueId)).toBe(true);
  });
});
