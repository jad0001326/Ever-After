import type { Metadata } from "next";
import { Check, FileCheck2, HeartHandshake, ShieldCheck } from "lucide-react";
import { SupplierApplicationForm } from "@/components/supplier/supplier-application-form";

export const metadata: Metadata = {
  title: "List your wedding business",
  description: "Apply to list your wedding business on EverAft and connect with couples planning celebrations across the UK.",
  alternates: { canonical: "/for-business" }
};

const reasons = [
  ["A listing that feels like your brand", "Tell your story with clear service, pricing and portfolio information."],
  ["A useful introduction", "Couples can understand your offering before they choose to enquire."],
  ["A thoughtful review", "Every new business is reviewed before it appears in the directory."]
] as const;

export default function ForBusinessPage() {
  return (
    <div className="bg-[#f2ede4]">
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 lg:grid lg:grid-cols-[0.82fr_1.18fr] lg:gap-14 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-sm font-semibold tracking-[0.16em] text-[#95502b]">For UK wedding businesses</p>
          <h1 className="mt-4 font-display text-6xl font-semibold leading-[0.88] tracking-[-0.05em] sm:text-7xl">Be found for the work you do best.</h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--muted)]">EverAft is building a considered wedding directory for brilliant independent businesses. Send your details and we’ll review your application before publication.</p>
          <div className="mt-10 grid gap-5 border-t border-[#cfc3b4] pt-7">
            {reasons.map(([title, copy]) => (
              <div className="flex gap-4" key={title}>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--brand)] text-white"><Check size={17} /></span>
                <div>
                  <h2 className="font-display text-2xl font-semibold tracking-[-0.025em]">{title}</h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{copy}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 grid gap-3 text-sm leading-6 text-[#4c463e]">
            <p className="flex gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-[#95502b]" size={17} />We use the information below to assess your application and contact you about it.</p>
            <p className="flex gap-3"><FileCheck2 className="mt-0.5 shrink-0 text-[#95502b]" size={17} />You retain ownership of your work; only approved listing content is displayed.</p>
            <p className="flex gap-3"><HeartHandshake className="mt-0.5 shrink-0 text-[#95502b]" size={17} />We’re opening the directory gradually to protect quality for couples and businesses.</p>
          </div>
        </div>
        <div className="mt-12 lg:mt-0">
          <SupplierApplicationForm />
        </div>
      </section>
    </div>
  );
}
