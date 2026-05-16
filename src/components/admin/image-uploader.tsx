import { UploadCloud } from "lucide-react";
import { uploadVenueImage } from "@/app/actions/images";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function ImageUploader({ venueId }: { venueId: string }) {
  return (
    <form action={uploadVenueImage} className="mt-8 grid gap-4 rounded-3xl border border-[var(--line)] bg-white p-5">
      <input name="venueId" type="hidden" value={venueId} />
      <div>
        <h2 className="font-display text-3xl font-semibold">Upload venue images</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Stores files in the Supabase `venue-images` bucket and records gallery metadata.</p>
      </div>
      <Field label="Image">
        <Input accept="image/*" name="image" required type="file" className="rounded-2xl py-3" />
      </Field>
      <Field label="Alt text">
        <Input name="alt" required placeholder="Describe the image for accessibility" />
      </Field>
      <Button type="submit">
        <UploadCloud size={16} /> Upload image
      </Button>
    </form>
  );
}
