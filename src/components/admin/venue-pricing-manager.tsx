import { deleteVenuePriceDraft, saveVenuePriceOption, supersedeVenuePriceOption } from "@/app/actions/pricing";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

export type AdminVenuePriceOption = {
  id: string;
  kind: string;
  label: string;
  amount_from_pence: number | string | null;
  amount_to_pence: number | string | null;
  pricing_unit: string;
  price_qualifier: string;
  included_guests: number | null;
  season_label: string | null;
  day_label: string | null;
  description: string | null;
  tax_label: string | null;
  minimum_nights: number | null;
  valid_from: string | null;
  valid_to: string | null;
  source_type: string;
  source_url: string | null;
  source_title: string | null;
  evidence_text: string | null;
  verified_at: string | null;
  status: string;
  display_priority: number;
};

const KIND_OPTIONS = [
  ["venue_hire", "Venue hire"],
  ["exclusive_use", "Exclusive use"],
  ["wedding_package", "Wedding package"],
  ["per_person", "Per-person wedding package"],
  ["ceremony_fee", "Ceremony fee"],
  ["minimum_spend", "Minimum spend"],
  ["catering", "Catering"],
  ["accommodation", "Accommodation"],
  ["quote_required", "Contact for pricing"],
  ["other", "Other pricing"]
] as const;

const UNIT_OPTIONS = [
  ["total", "Total"],
  ["per_person", "Per person"],
  ["per_event", "Per event"],
  ["per_night", "Per night"],
  ["per_room", "Per room"],
  ["per_hour", "Per hour"],
  ["unspecified", "Basis not stated"],
  ["quote", "Quote required"]
] as const;

export function VenuePricingManager({ venueId, venueSlug, options }: { venueId: string; venueSlug: string; options: AdminVenuePriceOption[] }) {
  return (
    <section className="mt-8 rounded-3xl border border-[var(--line)] bg-white p-5">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9d7b45]">Verified pricing</p>
        <h2 className="mt-2 font-display text-3xl font-semibold">Public price options</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Publish only an exact venue price with a source or direct venue confirmation. Per-person, accommodation and ceremony prices stay clearly labelled and are never presented as the total venue cost.
        </p>
      </div>

      <div className="mt-6 grid gap-5">
        {options.map((option) => (
          <PriceOptionEditor key={option.id} venueId={venueId} venueSlug={venueSlug} option={option} />
        ))}
        <PriceOptionEditor venueId={venueId} venueSlug={venueSlug} />
      </div>
    </section>
  );
}

function PriceOptionEditor({ venueId, venueSlug, option }: { venueId: string; venueSlug: string; option?: AdminVenuePriceOption }) {
  const isPublished = option?.status === "published";
  const isSuperseded = option?.status === "superseded";
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-[#fbf8f3] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold text-[#3f392f]">{option?.label || "Add a price"}</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isPublished ? "bg-[#e5efe6] text-[#36533b]" : isSuperseded ? "bg-[#eeeae3] text-[#6e675e]" : "bg-[#fff3d8] text-[#73501e]"}`}>
          {isPublished ? "Published" : isSuperseded ? "Superseded" : "Private draft"}
        </span>
      </div>

      {!isSuperseded ? (
        <form action={saveVenuePriceOption} className="grid gap-4">
          <input name="venueId" type="hidden" value={venueId} />
          <input name="venueSlug" type="hidden" value={venueSlug} />
          {option ? <input name="optionId" type="hidden" value={option.id} /> : null}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Price type">
              <Select name="kind" defaultValue={option?.kind ?? "venue_hire"}>
                {KIND_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </Field>
            <Field label="Public label">
              <Input name="label" required maxLength={160} defaultValue={option?.label ?? ""} placeholder="Winter wedding package" />
            </Field>
            <Field label="Price from (£)">
              <Input name="amountFrom" type="number" min="0.01" max="1000000" step="0.01" defaultValue={penceToPounds(option?.amount_from_pence)} />
            </Field>
            <Field label="Price to (£, optional)">
              <Input name="amountTo" type="number" min="0.01" max="1000000" step="0.01" defaultValue={penceToPounds(option?.amount_to_pence)} />
            </Field>
            <Field label="Amount wording">
              <Select name="priceQualifier" defaultValue={option?.price_qualifier ?? "from"}>
                <option value="from">Starting from</option>
                <option value="fixed">Fixed amount</option>
                <option value="range">Price range</option>
                <option value="quote" disabled>Quote required</option>
              </Select>
            </Field>
            <Field label="Charged as">
              <Select name="pricingUnit" defaultValue={option?.pricing_unit ?? "total"}>
                {UNIT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </Field>
            <Field label="Guests included">
              <Input name="includedGuests" type="number" min="1" max="10000" defaultValue={option?.included_guests ?? undefined} />
            </Field>
            <Field label="Minimum nights">
              <Input name="minimumNights" type="number" min="1" max="365" defaultValue={option?.minimum_nights ?? undefined} />
            </Field>
            <Field label="Tax qualifier">
              <Input name="taxLabel" maxLength={80} defaultValue={option?.tax_label ?? ""} placeholder="VAT included or VAT additional" />
            </Field>
            <Field label="Valid from">
              <Input name="validFrom" type="date" defaultValue={option?.valid_from ?? ""} />
            </Field>
            <Field label="Valid until">
              <Input name="validTo" type="date" defaultValue={option?.valid_to ?? ""} />
            </Field>
            <Field label="Season or date qualifier">
              <Input name="seasonLabel" maxLength={120} defaultValue={option?.season_label ?? ""} placeholder="October to March" />
            </Field>
            <Field label="Day qualifier">
              <Input name="dayLabel" maxLength={120} defaultValue={option?.day_label ?? ""} placeholder="Monday to Thursday" />
            </Field>
            <Field label="Source type">
              <Select name="sourceType" defaultValue={option?.source_type ?? "official_website"}>
                <option value="official_website">Official website</option>
                <option value="official_brochure">Official brochure</option>
                <option value="venue_confirmed">Confirmed directly by venue</option>
                <option value="admin_verified">Admin verified</option>
                <option value="other">Other review source</option>
              </Select>
            </Field>
            <Field label="Display order">
              <Input name="displayPriority" type="number" min="0" max="10000" defaultValue={option?.display_priority ?? 100} />
            </Field>
          </div>
          <Field label="Exact source URL">
            <Input name="sourceUrl" type="url" maxLength={2000} defaultValue={option?.source_url ?? ""} placeholder="https://venue.co.uk/weddings/pricing" />
          </Field>
          <Field label="Source title">
            <Input name="sourceTitle" maxLength={300} defaultValue={option?.source_title ?? ""} placeholder="2026 wedding packages" />
          </Field>
          <Field label="What the price includes">
            <Textarea name="description" maxLength={4000} defaultValue={option?.description ?? ""} placeholder="Exclusive venue hire for three days, including accommodation..." />
          </Field>
          <Field label="Evidence excerpt or confirmation note">
            <Textarea name="evidenceText" maxLength={4000} defaultValue={option?.evidence_text ?? ""} placeholder="Official page states: 3-day wedding venue from £5,500." />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Visibility">
              <Select name="status" defaultValue={option?.status === "published" ? "published" : "draft"}>
                <option value="draft">Private draft</option>
                <option value="published">Publish as verified</option>
              </Select>
            </Field>
            <Button type="submit">{option ? "Save price" : "Add price"}</Button>
          </div>
          {option?.verified_at ? <p className="text-xs text-[var(--muted)]">Last verified {new Date(option.verified_at).toLocaleDateString("en-GB")}</p> : null}
        </form>
      ) : null}

      {option && !isSuperseded ? (
        <div className="mt-3 flex justify-end">
          {isPublished ? (
            <form action={supersedeVenuePriceOption}>
              <input name="venueId" type="hidden" value={venueId} />
              <input name="venueSlug" type="hidden" value={venueSlug} />
              <input name="optionId" type="hidden" value={option.id} />
              <Button type="submit" variant="secondary">Supersede price</Button>
            </form>
          ) : (
            <form action={deleteVenuePriceDraft}>
              <input name="venueId" type="hidden" value={venueId} />
              <input name="venueSlug" type="hidden" value={venueSlug} />
              <input name="optionId" type="hidden" value={option.id} />
              <Button type="submit" variant="secondary">Delete draft</Button>
            </form>
          )}
        </div>
      ) : null}
    </article>
  );
}

function penceToPounds(value: number | string | null | undefined) {
  if (value == null || value === "") return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount / 100 : undefined;
}
