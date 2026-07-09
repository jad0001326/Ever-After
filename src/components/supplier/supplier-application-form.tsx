"use client";

import { useActionState } from "react";
import { submitSupplierApplication } from "@/app/actions/supplier-application";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { supplierCategories } from "@/data/supplier-categories";

export function SupplierApplicationForm() {
  const [state, action, pending] = useActionState(submitSupplierApplication, null);

  return (
    <form action={action} className="rounded-[2rem] border border-[var(--line)] bg-white p-5 shadow-[0_24px_70px_rgba(25,23,19,0.07)] sm:p-7">
      <input aria-hidden="true" autoComplete="off" className="hidden" name="companyWebsite" tabIndex={-1} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Business name">
          <Input name="companyName" required placeholder="Your business name" />
        </Field>
        <Field label="Your name">
          <Input name="ownerName" required placeholder="Owner or primary contact" />
        </Field>
        <Field label="Business email">
          <Input name="email" required type="email" placeholder="hello@yourbusiness.co.uk" />
        </Field>
        <Field label="Phone">
          <Input name="phone" required type="tel" placeholder="+44…" />
        </Field>
        <Field label="Category">
          <Select defaultValue="" name="category" required>
            <option disabled value="">Choose a category</option>
            {supplierCategories.map((category) => <option key={category} value={category}>{category}</option>)}
          </Select>
        </Field>
        <Field label="Based in">
          <Input name="location" required placeholder="Town, city or region" />
        </Field>
        <Field label="Coverage radius (miles)">
          <Input min="0" max="500" name="coverageRadius" required type="number" placeholder="50" />
        </Field>
        <Field label="Starting price or price guide">
          <Input name="pricing" placeholder="From £1,500 or pricing on request" />
        </Field>
      </div>
      <div className="mt-5 grid gap-5">
        <Field label="Website">
          <Input name="website" type="url" placeholder="https://yourbusiness.co.uk" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Instagram">
            <Input name="instagram" placeholder="@yourbusiness" />
          </Field>
          <Field label="Facebook page">
            <Input name="facebook" type="url" placeholder="https://facebook.com/…" />
          </Field>
        </div>
        <Field label="About your business">
          <Textarea minLength={40} name="description" required placeholder="Tell couples what makes your work distinctive…" />
        </Field>
        <Field label="Services you offer">
          <Textarea className="min-h-24" name="services" required placeholder="For example: full-day photography, engagement shoots, albums…" />
        </Field>
        <Field label="Gallery links (optional)">
          <Textarea className="min-h-24" name="galleryUrls" placeholder="Add links to a gallery, portfolio, Drive folder or Dropbox folder." />
        </Field>
      </div>
      <label className="mt-6 flex gap-3 rounded-2xl bg-[#f7f3eb] p-4 text-sm leading-6 text-[#4c463e]">
        <input className="mt-1 size-4 shrink-0 accent-[var(--brand)]" name="termsAccepted" required type="checkbox" />
        <span>I confirm that I can represent this business and that EverAft may review the information I provide in line with the <a className="font-semibold text-[var(--brand)] underline underline-offset-2" href="/supplier-terms">Supplier Terms</a>.</span>
      </label>
      {state?.message ? <p aria-live="polite" className={state.ok ? "mt-5 text-sm text-[#285237]" : "mt-5 text-sm text-[#9e341f]"}>{state.message}</p> : null}
      <Button className="mt-6 w-full" disabled={pending || state?.ok} type="submit">
        {pending ? "Sending application…" : state?.ok ? "Application received" : "Send my application"}
      </Button>
    </form>
  );
}
