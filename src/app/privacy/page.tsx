import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description: "How EverAft collects, uses and protects personal information.",
  alternates: { canonical: "/privacy" }
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Notice" intro="This notice explains how EverAft uses personal information when you browse the site, create an account, send an enquiry, apply to list a business or subscribe to updates." updated="9 July 2026">
      <LegalSection title="Information we collect"><p>We collect the information you choose to provide, such as your name, email address, phone number, wedding details, messages, supplier application details and newsletter preferences. We also process limited technical information needed to keep the site secure and signed-in sessions working.</p></LegalSection>
      <LegalSection title="Why we use it"><p>We use your information to provide the feature you requested: saving venues, delivering an enquiry, reviewing a supplier application, responding to a message or sending newsletters you have confirmed. We may also use limited records to prevent fraud, secure the service and meet legal obligations.</p></LegalSection>
      <LegalSection title="Who receives it"><p>Venue teams receive the enquiry information you send to them. We use carefully selected processors for hosting, authentication, data storage and transactional email. We do not sell personal information.</p></LegalSection>
      <LegalSection title="How long we keep it"><p>We retain enquiry, account and supplier-application records only for as long as needed for the relevant relationship, operational records, dispute handling and legal obligations. Newsletter subscribers can unsubscribe at any time.</p></LegalSection>
      <LegalSection title="Cookies"><p>Essential cookies help us provide sign-in, session security and site functionality. Optional analytics are not currently enabled. If analytics are introduced, we will update this notice and ask for the appropriate consent before setting non-essential cookies.</p></LegalSection>
      <LegalSection title="Your rights"><p>Depending on your circumstances, you may have rights to access, correct, erase, restrict or object to the use of your personal information, and to ask for a portable copy. To make a request, use our <Link className="font-semibold text-[var(--brand)] underline underline-offset-2" href="/contact">contact form</Link>.</p></LegalSection>
    </LegalPage>
  );
}
