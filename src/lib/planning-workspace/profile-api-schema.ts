import { z } from "zod";
import {
  weddingProfileContentSchema,
  weddingProfileSchema,
} from "./validation.ts";

export const planningProfileContentSchema = weddingProfileContentSchema;

export const planningProfileResourceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  workspaceId: z.string().uuid(),
  profile: weddingProfileSchema.nullable(),
}).meta({
  title: "EverAft Planning Profile Resource v1",
  description: "Versioned wedding profile for web, iOS and Android Planning Hub clients.",
});

export const planningProfileUpdateRequestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  expectedProfileUpdatedAt: z.string().datetime({ offset: true }).nullable(),
  profile: planningProfileContentSchema,
}).meta({
  title: "EverAft Planning Profile Update Request v1",
  description: "Conflict-safe wedding profile creation or replacement.",
});

export const planningProfileResourceJsonSchema = jsonSchema(
  planningProfileResourceSchema,
  "urn:everaft:planning-profile-resource:v1",
);
export const planningProfileUpdateRequestJsonSchema = jsonSchema(
  planningProfileUpdateRequestSchema,
  "urn:everaft:planning-profile-update-request:v1",
);

function jsonSchema(schema: z.ZodType, id: string) {
  const generated = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io: "output",
  }) as Record<string, unknown>;
  return Object.freeze({
    $schema: generated.$schema,
    $id: id,
    ...Object.fromEntries(
      Object.entries(generated).filter(([key]) => key !== "$schema"),
    ),
  });
}
