import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Website Terms", description: "Terms for using the EverAft website.", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <LegalPage title="Website Terms" intro="These terms govern your use of EverAft’s wedding discovery platform." updated="9 July 2026">
      <LegalSection title="Using EverAft"><p>Use EverAft lawfully and respectfully. Do not interfere with the service, attempt to access accounts or data that are not yours, or submit misleading, unlawful or infringing content.</p></LegalSection>
      <LegalSection title="Directory information"><p>We work to keep listing information useful and current, but suppliers remain responsible for their own availability, pricing, services, imagery and contractual commitments. Couples should confirm important details directly with the supplier before booking.</p></LegalSection>
      <LegalSection title="Enquiries and bookings"><p>EverAft helps couples introduce themselves to suppliers. We are not a party to any booking, contract, payment, cancellation or dispute between a couple and a supplier.</p></LegalSection>
      <LegalSection title="Accounts"><p>Keep your sign-in details confidential and tell us through the <Link className="font-semibold text-[var(--brand)] underline underline-offset-2" href="/contact">contact form</Link> if you suspect unauthorised access. We may suspend accounts that breach these terms or put the service at risk.</p></LegalSection>
      <LegalSection title="Changes"><p>We may update these terms as the platform develops. Material changes will be reflected by the date at the top of this page.</p></LegalSection>
    </LegalPage>
  );
}
