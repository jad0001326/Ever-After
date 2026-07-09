import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Supplier Terms", description: "Terms for wedding businesses applying to list on EverAft.", alternates: { canonical: "/supplier-terms" } };

export default function SupplierTermsPage() {
  return (
    <LegalPage title="Supplier Terms" intro="These terms apply when a wedding business submits an application or manages a listing through EverAft." updated="9 July 2026">
      <LegalSection title="Review before publication"><p>Submitting an application does not guarantee a listing. We review applications to help keep the directory useful, accurate and safe for couples and businesses.</p></LegalSection>
      <LegalSection title="Your information and content"><p>You confirm that submitted details are accurate, that you are authorised to represent the business, and that you own or have permission to use any text, imagery, links or other material you provide. You remain responsible for keeping published information current.</p></LegalSection>
      <LegalSection title="Enquiries"><p>Enquiries are introductions from couples, not guaranteed bookings. Responding promptly, handling personal information responsibly and agreeing bookings directly with the couple remain your responsibility.</p></LegalSection>
      <LegalSection title="Listing standards"><p>We may refuse, edit for clarity with your agreement, suspend or remove content that is inaccurate, deceptive, unsafe, unlawful, discriminatory, infringing or inconsistent with a useful directory experience.</p></LegalSection>
      <LegalSection title="Questions"><p>For questions about an application or listing, use the <Link className="font-semibold text-[var(--brand)] underline underline-offset-2" href="/contact">contact form</Link>.</p></LegalSection>
    </LegalPage>
  );
}
