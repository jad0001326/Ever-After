"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { requestSupplierUpdate } from "@/app/actions/supplier-owner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { Database } from "@/types/database";

type Supplier = Pick<Database["public"]["Tables"]["supplier_listings"]["Row"],
  "id" | "base_town" | "region" | "service_areas" | "travels_nationwide" | "summary" | "description" | "services" |
  "official_website_url" | "instagram_url" | "facebook_url" | "enquiry_url" | "starting_price_pence" |
  "typical_price_pence" | "pricing_summary" | "pricing_unit"
>;

export function SupplierOwnerUpdateForm({ supplier, hasPendingRequest }: { supplier: Supplier; hasPendingRequest: boolean }) {
  const [state, formAction, pending] = useActionState(requestSupplierUpdate, null);

  return (
    <form action={formAction} className="mt-5 rounded-2xl bg-[#fbf8f3] p-4">
      <input name="supplierId" type="hidden" value={supplier.id} />
      <fieldset disabled={pending || hasPendingRequest}>
        <legend className="font-semibold text-[#4a443c]">Propose profile changes</legend>
        <p className="mt-1 text-sm text-[var(--muted)]">EverAft reviews changes before they appear publicly. Publication, category, ownership and imagery cannot be changed here.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Base town"><Input maxLength={120} name="baseTown" required defaultValue={supplier.base_town} /></Field>
          <Field label="Region"><Input maxLength={120} name="region" required defaultValue={supplier.region} /></Field>
          <Field label="Service areas (one per line)"><Textarea className="min-h-28" maxLength={4000} name="serviceAreas" defaultValue={supplier.service_areas.join("\n")} /></Field>
          <Field label="Services (one per line)"><Textarea className="min-h-28" maxLength={3000} name="services" required defaultValue={supplier.services.join("\n")} /></Field>
          <label className="flex items-center gap-3 text-sm font-medium text-[#4a443c] sm:col-span-2">
            <input className="size-4 accent-[#334235]" defaultChecked={supplier.travels_nationwide} name="travelsNationwide" type="checkbox" /> Available across Scotland or nationwide
          </label>
          <Field label="Summary"><Textarea className="min-h-28" maxLength={320} minLength={20} name="summary" required defaultValue={supplier.summary} /></Field>
          <Field label="Description"><Textarea className="min-h-28" maxLength={5000} minLength={40} name="description" required defaultValue={supplier.description} /></Field>
          <Field label="Official website"><Input name="officialWebsiteUrl" type="url" defaultValue={supplier.official_website_url ?? ""} /></Field>
          <Field label="Enquiry page"><Input name="enquiryUrl" type="url" defaultValue={supplier.enquiry_url ?? ""} /></Field>
          <Field label="Instagram"><Input name="instagramUrl" type="url" defaultValue={supplier.instagram_url ?? ""} /></Field>
          <Field label="Facebook"><Input name="facebookUrl" type="url" defaultValue={supplier.facebook_url ?? ""} /></Field>
          <Field label="Starting price (GBP)"><Input inputMode="decimal" name="startingPrice" defaultValue={price(supplier.starting_price_pence)} /></Field>
          <Field label="Typical price (GBP)"><Input inputMode="decimal" name="typicalPrice" defaultValue={price(supplier.typical_price_pence)} /></Field>
          <Field label="Pricing basis">
            <Select name="pricingUnit" defaultValue={supplier.pricing_unit}>
              <option value="quote">Quote</option><option value="package">Package</option><option value="hour">Hour</option>
              <option value="person">Person</option><option value="item">Item</option><option value="event">Event</option>
            </Select>
          </Field>
          <Field label="Pricing summary"><Textarea className="min-h-28" maxLength={600} name="pricingSummary" defaultValue={supplier.pricing_summary ?? ""} /></Field>
          <div className="sm:col-span-2"><Field label="Review note"><Textarea maxLength={2000} minLength={10} name="requestedMessage" required placeholder="Briefly explain what changed so the EverAft team can review it." /></Field></div>
        </div>
        <Button className="mt-4" type="submit"><Send size={16} />{pending ? "Sending..." : "Request review"}</Button>
      </fieldset>
      {hasPendingRequest ? <p className="mt-4 text-sm font-medium text-[#8a672d]">An update is already waiting for review. You can submit another after it is decided.</p> : null}
      {state?.message ? <p aria-live="polite" className={state.ok ? "mt-4 text-sm text-[var(--brand)]" : "mt-4 text-sm text-red-700"}>{state.message}</p> : null}
    </form>
  );
}

function price(value: number | null) {
  return value == null ? "" : (value / 100).toFixed(value % 100 === 0 ? 0 : 2);
}
