import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/contact-form";

export const metadata: Metadata = {
  title: "Contact EverAft",
  description: "Get in touch with the EverAft team about wedding supplier discovery or listing a business.",
  alternates: { canonical: "/contact" }
};

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:grid lg:grid-cols-[0.8fr_1.2fr] lg:gap-14 lg:px-8 lg:py-20">
      <div>
        <p className="text-sm font-semibold tracking-[0.16em] text-[#95502b]">Contact EverAft</p>
        <h1 className="mt-4 font-display text-6xl font-semibold leading-[0.9] tracking-[-0.05em] sm:text-7xl">Let’s make it useful.</h1>
        <p className="mt-7 max-w-md text-lg leading-8 text-[var(--muted)]">Ask about the directory, a supplier application or a listing you manage. We’ll make sure your message reaches the right person.</p>
      </div>
      <div className="mt-10 lg:mt-0"><ContactForm /></div>
    </section>
  );
}
