"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { requestVenueUpdate } from "@/app/actions/vendor";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";

type VendorVenue = {
  id: string;
  name: string;
  summary: string;
  description: string;
  official_website_url: string | null;
  official_gallery_url: string | null;
};

export function VendorUpdateForm({ venue }: { venue: VendorVenue }) {
  const [state, formAction, pending] = useActionState(requestVenueUpdate, null);

  return (
    <form action={formAction} className="mt-5 rounded-2xl bg-[#fbf8f3] p-4">
      <input name="venueId" type="hidden" value={venue.id} />
      <div className="grid gap-4">
        <Field label="Venue name">
          <Input name="name" defaultValue={venue.name} />
        </Field>
        <Field label="Official website URL">
          <Input name="officialWebsiteUrl" type="url" defaultValue={venue.official_website_url ?? ""} />
        </Field>
        <Field label="Official gallery URL">
          <Input name="officialGalleryUrl" type="url" defaultValue={venue.official_gallery_url ?? ""} />
        </Field>
        <Field label="Summary">
          <Textarea name="summary" defaultValue={venue.summary} />
        </Field>
        <Field label="Description">
          <Textarea name="description" defaultValue={venue.description} />
        </Field>
        <Field label="Review note">
          <Textarea name="requestedMessage" required placeholder="Tell the EverAft team what changed and what photos/content you want reviewed." />
        </Field>
      </div>
      {state?.message ? (
        <p className={state.ok ? "mt-4 text-sm text-[var(--brand)]" : "mt-4 text-sm text-red-700"}>{state.message}</p>
      ) : null}
      <Button className="mt-4" disabled={pending} type="submit">
        <Send size={16} />
        {pending ? "Sending..." : "Request review"}
      </Button>
    </form>
  );
}
