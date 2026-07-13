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
    <LegalPage title="Privacy Notice" intro="This notice explains how EverAft uses personal information when you browse the site, create an account, send an enquiry, apply to list a business, receive a business-listing invitation or subscribe to updates." updated="13 July 2026">
      <LegalSection title="Information we collect"><p>We collect the information you choose to provide, such as your name, email address, phone number, wedding details, messages, supplier application details and newsletter preferences. For business-listing outreach, we may also record a business contact address visibly published on the business&apos;s official website, the source page and delivery or opt-out events. We also process limited technical information needed to keep the site secure and signed-in sessions working.</p></LegalSection>
      <LegalSection title="Why we use it"><p>We use your information to provide the feature you requested: saving venues, delivering an enquiry, reviewing a supplier application, responding to a message or sending newsletters you have confirmed. We rely on our legitimate interests to invite eligible corporate venue businesses to review or claim their EverAft listing, while respecting their reasonable expectations and right to object. This outreach route is not intended for sole traders or personal subscribers without the permission required by law. We may also use limited records to prevent fraud, secure the service and meet legal obligations.</p></LegalSection>
      <LegalSection title="Who receives it"><p>Venue teams receive the enquiry information you send to them. We use carefully selected processors for hosting, authentication, data storage, transactional email and, when you consent, website analytics. We do not sell personal information.</p></LegalSection>
      <LegalSection title="How long we keep it"><p>We retain enquiry, account, supplier-application and business-outreach records only for as long as needed for the relevant relationship, operational records, dispute handling and legal obligations. Every business invitation includes an unsubscribe option. If a recipient opts out, bounces or complains, we keep the minimum address and reason on a suppression list so that we do not contact it again. Newsletter subscribers can unsubscribe at any time.</p></LegalSection>
      <LegalSection title="Cookies and analytics"><p>Essential cookies and browser storage help us provide sign-in, session security and site functionality. If you choose “Allow analytics”, we use Google Analytics 4 to understand visitor numbers, pages viewed, approximate location, device and browser information, and selected interactions such as budget-planner use. Google Analytics may set cookies including <code>_ga</code>. Analytics remains off until you consent. You can withdraw consent at any time using “Cookie settings” in the footer; we then stop analytics and remove the analytics cookies available to EverAft.</p></LegalSection>
      <LegalSection title="Your rights"><p>Depending on your circumstances, you may have rights to access, correct, erase, restrict or object to the use of your personal information, and to ask for a portable copy. You can object to business outreach at any time by using the unsubscribe link in the email or our <Link className="font-semibold text-[var(--brand)] underline underline-offset-2" href="/contact">contact form</Link>.</p></LegalSection>
    </LegalPage>
  );
}
