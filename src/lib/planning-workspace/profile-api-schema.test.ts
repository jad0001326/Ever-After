import { describe, expect, it } from "vitest";
import {
  planningProfileResourceJsonSchema,
  planningProfileResourceSchema,
  planningProfileUpdateRequestJsonSchema,
  planningProfileUpdateRequestSchema,
} from "./profile-api-schema";
import checkedResourceSchema from "../../../docs/planning-hub/contracts/planning-profile-resource.v1.schema.json";
import checkedRequestSchema from "../../../docs/planning-hub/contracts/planning-profile-update-request.v1.schema.json";

describe("Planning Profile API contracts", () => {
  it("accepts create and update requests with explicit expected versions", () => {
    const create = updateRequest(null);
    const update = updateRequest("2026-07-29T12:00:00.000Z");

    expect(planningProfileUpdateRequestSchema.parse(create)).toEqual(create);
    expect(planningProfileUpdateRequestSchema.parse(update)).toEqual(update);
  });

  it("rejects client timestamps, unknown fields and duplicate choices", () => {
    expect(planningProfileUpdateRequestSchema.safeParse({
      ...updateRequest(null),
      overwrite: true,
    }).success).toBe(false);
    expect(planningProfileUpdateRequestSchema.safeParse({
      ...updateRequest(null),
      profile: {
        ...profileContent(),
        updatedAt: "2026-07-29T12:00:00.000Z",
      },
    }).success).toBe(false);
    expect(planningProfileUpdateRequestSchema.safeParse({
      ...updateRequest(null),
      profile: {
        ...profileContent(),
        priorities: ["venue", "venue"],
      },
    }).success).toBe(false);
  });

  it("accepts strict nullable profile resources", () => {
    const missing = {
      schemaVersion: 1,
      workspaceId: "60000000-0000-4000-8000-000000000006",
      profile: null,
    };
    const saved = {
      ...missing,
      profile: {
        ...profileContent(),
        updatedAt: "2026-07-29T12:00:00.001Z",
      },
    };

    expect(planningProfileResourceSchema.parse(missing)).toEqual(missing);
    expect(planningProfileResourceSchema.parse(saved)).toEqual(saved);
    expect(planningProfileResourceSchema.safeParse({
      ...saved,
      memberRole: "partner",
    }).success).toBe(false);
  });

  it("keeps both checked language-neutral schemas current", () => {
    expect(checkedResourceSchema).toEqual(planningProfileResourceJsonSchema);
    expect(checkedRequestSchema).toEqual(
      planningProfileUpdateRequestJsonSchema,
    );
    expect(checkedResourceSchema).toMatchObject({
      $id: "urn:everaft:planning-profile-resource:v1",
      additionalProperties: false,
    });
    expect(checkedRequestSchema).toMatchObject({
      $id: "urn:everaft:planning-profile-update-request:v1",
      additionalProperties: false,
    });
  });
});

function updateRequest(expectedProfileUpdatedAt: string | null) {
  return {
    schemaVersion: 1 as const,
    expectedProfileUpdatedAt,
    profile: profileContent(),
  };
}

function profileContent() {
  return {
    schemaVersion: 1 as const,
    weddingDate: "2027-08-21",
    guestCount: 80,
    location: "Edinburgh",
    dateFlexibility: "fixed" as const,
    locationFlexible: false,
    priorities: ["venue", "photography"] as const,
    venueStyles: ["Castle"],
    photographyStyles: ["Documentary"],
    vision: "A relaxed day with our favourite people.",
  };
}
