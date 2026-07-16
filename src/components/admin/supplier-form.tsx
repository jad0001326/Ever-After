import { saveSupplierListing } from "@/app/actions/suppliers";
import { photographerStyles, supplierDirectoryCategories } from "@/data/supplier-directory";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { Database } from "@/types/database";

type Supplier = Database["public"]["Tables"]["supplier_listings"]["Row"];
type Photographer = Database["public"]["Tables"]["photographer_profiles"]["Row"];
type OutreachContact = Database["public"]["Tables"]["supplier_outreach_contacts"]["Row"];

export function SupplierForm({ supplier, photographer, outreachContact }: { supplier?: Supplier | null; photographer?: Photographer | null; outreachContact?: OutreachContact | null }) {
  return (
    <form action={saveSupplierListing} className="grid gap-6">
      {supplier ? <input name="id" type="hidden" value={supplier.id} /> : null}
      <section className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-7">
        <h2 className="font-display text-3xl font-semibold">Core profile</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="Business name"><Input defaultValue={supplier?.name ?? ""} maxLength={160} name="name" required /></Field>
          <Field label="URL slug"><Input defaultValue={supplier?.slug ?? ""} name="slug" placeholder="Generated from the name" /></Field>
          <Field label="Category"><Select defaultValue={supplier?.category_slug ?? "photographer"} name="categorySlug" required>{supplierDirectoryCategories.map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}</Select></Field>
          <Field label="Listing status"><Select defaultValue={supplier?.listing_status ?? "draft"} name="listingStatus"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></Select></Field>
          <Field label="Base town"><Input defaultValue={supplier?.base_town ?? ""} name="baseTown" required /></Field>
          <Field label="Region"><Input defaultValue={supplier?.region ?? ""} name="region" required /></Field>
          <Field label="Country"><Input defaultValue={supplier?.country ?? "Scotland"} name="country" required /></Field>
          <Field label="Travel radius (miles)"><Input defaultValue={supplier?.travel_radius_miles ?? ""} min="0" name="travelRadiusMiles" type="number" /></Field>
          <label className="flex items-center gap-3 text-sm font-medium sm:col-span-2"><input defaultChecked={supplier?.travels_nationwide ?? false} className="size-4 accent-[#334235]" name="travelsNationwide" type="checkbox" />Available throughout Scotland</label>
          <div className="sm:col-span-2"><Field label="Service areas (one per line)"><Textarea defaultValue={supplier?.service_areas.join("\n") ?? ""} name="serviceAreas" /></Field></div>
          <div className="sm:col-span-2"><Field label="Summary"><Textarea defaultValue={supplier?.summary ?? ""} maxLength={500} name="summary" required /></Field></div>
          <div className="sm:col-span-2"><Field label="Full description"><Textarea className="min-h-56" defaultValue={supplier?.description ?? ""} maxLength={5000} name="description" required /></Field></div>
          <div className="sm:col-span-2"><Field label="Services (one per line)"><Textarea defaultValue={supplier?.services.join("\n") ?? ""} name="services" /></Field></div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#d7c6aa] bg-[#fffaf0] p-5 sm:p-7">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">Private admin data</p>
        <h2 className="mt-2 font-display text-3xl font-semibold">Invitation eligibility</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#665b4b]">These fields are never shown on the public profile. An address is only eligible for an invitation after its source and legal basis have been reviewed. Sole traders and unincorporated partnerships are not eligible for cold email without recorded consent or soft opt-in evidence.</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="Invitation email"><Input defaultValue={outreachContact?.email ?? ""} maxLength={254} name="outreachEmail" type="email" /></Field>
          <Field label="Official contact source URL"><Input defaultValue={outreachContact?.contact_source_url ?? ""} name="contactSourceUrl" placeholder="Page on the official website" type="url" /></Field>
          <Field label="Business structure"><Select defaultValue={outreachContact?.business_structure ?? "unknown"} name="businessStructure"><option value="unknown">Unknown / not checked</option><option value="limited_company">Limited company</option><option value="limited_liability_partnership">Limited liability partnership</option><option value="scottish_partnership">Scottish partnership</option><option value="other_corporate">Other corporate body</option><option value="sole_trader">Sole trader</option><option value="unincorporated_partnership">Unincorporated partnership</option></Select></Field>
          <Field label="Companies House number"><Input defaultValue={outreachContact?.company_number ?? ""} maxLength={32} name="companyNumber" /></Field>
          <Field label="Legal basis"><Select defaultValue={outreachContact?.legal_basis ?? "unreviewed"} name="legalBasis"><option value="unreviewed">Unreviewed — not eligible</option><option value="corporate_subscriber">Corporate subscriber</option><option value="consent">Recorded consent</option><option value="soft_opt_in">Recorded soft opt-in</option><option value="not_eligible">Not eligible</option></Select></Field>
          <Field label="Consent / soft opt-in evidence URL"><Input defaultValue={outreachContact?.consent_evidence_url ?? ""} name="consentEvidenceUrl" placeholder="Required for consent or soft opt-in" type="url" /></Field>
          <div className="sm:col-span-2"><Field label="Eligibility notes"><Textarea defaultValue={outreachContact?.eligibility_notes ?? ""} maxLength={2000} name="eligibilityNotes" placeholder="What was checked, when, and why this basis applies" /></Field></div>
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.15em] text-[#715622]">Invite status: {outreachContact?.invite_status?.replaceAll("_", " ") ?? "not sent"}</p>
      </section>

      <section className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-7">
        <h2 className="font-display text-3xl font-semibold">Links and pricing</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="Official website"><Input defaultValue={supplier?.official_website_url ?? ""} name="officialWebsiteUrl" placeholder="https://" type="url" /></Field>
          <Field label="Direct enquiry URL"><Input defaultValue={supplier?.enquiry_url ?? ""} name="enquiryUrl" placeholder="https://" type="url" /></Field>
          <Field label="Instagram URL"><Input defaultValue={supplier?.instagram_url ?? ""} name="instagramUrl" placeholder="https://" type="url" /></Field>
          <Field label="Facebook URL"><Input defaultValue={supplier?.facebook_url ?? ""} name="facebookUrl" placeholder="https://" type="url" /></Field>
          <Field label="Research source URL"><Input defaultValue={supplier?.source_url ?? ""} name="sourceUrl" placeholder="https://" type="url" /></Field>
          <Field label="Pricing basis"><Select defaultValue={supplier?.pricing_unit ?? "package"} name="pricingUnit"><option value="package">Package</option><option value="hour">Per hour</option><option value="person">Per person</option><option value="item">Per item</option><option value="event">Per event</option><option value="quote">Quote required</option></Select></Field>
          <Field label="Starting price (£)"><Input defaultValue={supplier?.starting_price_pence == null ? "" : supplier.starting_price_pence / 100} min="0" name="startingPrice" step="0.01" type="number" /></Field>
          <Field label="Typical package price (£)"><Input defaultValue={supplier?.typical_price_pence == null ? "" : supplier.typical_price_pence / 100} min="0" name="typicalPrice" step="0.01" type="number" /></Field>
          <div className="sm:col-span-2"><Field label="Pricing explanation"><Textarea defaultValue={supplier?.pricing_summary ?? ""} maxLength={1000} name="pricingSummary" /></Field></div>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-7">
        <h2 className="font-display text-3xl font-semibold">Photographer details</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <fieldset className="sm:col-span-2"><legend className="text-sm font-medium text-[#4a443c]">Styles</legend><div className="mt-3 flex flex-wrap gap-2">{photographerStyles.map((style) => <label className="flex items-center gap-2 rounded-full bg-[#f4efe7] px-3 py-2 text-sm" key={style}><input defaultChecked={photographer?.styles.includes(style) ?? false} className="accent-[#334235]" name="styles" type="checkbox" value={style} />{style}</label>)}</div></fieldset>
          <Field label="Minimum coverage hours"><Input defaultValue={photographer?.coverage_hours_min ?? ""} min="0" name="coverageHoursMin" step="0.5" type="number" /></Field>
          <Field label="Maximum coverage hours"><Input defaultValue={photographer?.coverage_hours_max ?? ""} min="0" name="coverageHoursMax" step="0.5" type="number" /></Field>
          <Field label="Minimum turnaround (weeks)"><Input defaultValue={photographer?.turnaround_weeks_min ?? ""} min="0" name="turnaroundWeeksMin" type="number" /></Field>
          <Field label="Maximum turnaround (weeks)"><Input defaultValue={photographer?.turnaround_weeks_max ?? ""} min="0" name="turnaroundWeeksMax" type="number" /></Field>
          <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">{[
            ["secondPhotographerAvailable", "Second photographer available", photographer?.second_photographer_available],
            ["engagementShootAvailable", "Engagement shoots", photographer?.engagement_shoot_available],
            ["droneAvailable", "Drone coverage", photographer?.drone_available],
            ["filmPhotographyAvailable", "Film photography", photographer?.film_photography_available],
            ["albumsAvailable", "Albums available", photographer?.albums_available]
          ].map(([name, label, checked]) => <label className="flex items-center gap-3 text-sm" key={String(name)}><input defaultChecked={Boolean(checked)} className="size-4 accent-[#334235]" name={String(name)} type="checkbox" />{label}</label>)}</div>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-7">
        <h2 className="font-display text-3xl font-semibold">Approved cover image</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2"><Field label="Image URL"><Input defaultValue={supplier?.hero_image_url ?? ""} name="heroImageUrl" placeholder="Approved Supabase image URL" type="url" /></Field><Field label="Photo credit"><Input defaultValue={supplier?.image_credit ?? ""} name="imageCredit" /></Field><label className="flex items-start gap-3 text-sm leading-6 sm:col-span-2"><input defaultChecked={supplier?.image_permission_status === "approved"} className="mt-1 size-4 accent-[#334235]" name="imageRightsApproved" type="checkbox" /><span>I have confirmed that EverAft may display this image and its subjects have been handled appropriately.</span></label><label className="flex items-center gap-3 text-sm font-medium"><input defaultChecked={supplier?.is_featured ?? false} className="size-4 accent-[#334235]" name="isFeatured" type="checkbox" />Feature this supplier</label></div>
      </section>

      <div className="flex justify-end"><Button type="submit">Save supplier profile</Button></div>
    </form>
  );
}
