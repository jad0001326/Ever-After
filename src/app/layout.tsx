import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CookieBanner } from "@/components/privacy/cookie-banner";
import { absoluteUrl } from "@/lib/utils";

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap"
});

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap"
});

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl()),
  title: {
    default: "EverAft | Trusted UK wedding suppliers",
    template: "%s | EverAft"
  },
  description:
    "Discover thoughtful, trusted wedding suppliers across the UK, from beautiful venues to the people who bring a celebration to life.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "EverAft",
    description: "Thoughtful wedding supplier discovery for couples planning celebrations across the UK.",
    url: absoluteUrl(),
    siteName: "EverAft",
    type: "website",
    locale: "en_GB",
    images: [{ url: absoluteUrl("/images/everaft-wedding-reception.png"), width: 1536, height: 1024, alt: "Wedding breakfast in a light-filled country house" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "EverAft | Trusted UK wedding suppliers",
    description: "Thoughtful wedding supplier discovery for couples planning celebrations across the UK.",
    images: [absoluteUrl("/images/everaft-wedding-reception.png")]
  }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-GB">
      <body className={`${sans.variable} ${display.variable} antialiased`}>
        <Header />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  name: "EverAft",
                  url: absoluteUrl(),
                  potentialAction: {
                    "@type": "SearchAction",
                    target: `${absoluteUrl("/venues")}?location={location}&guests={guests}&type={type}`,
                    "query-input": ["required name=location"]
                  }
                },
                {
                  "@type": "Organization",
                  name: "EverAft",
                  url: absoluteUrl(),
                  areaServed: "United Kingdom"
                }
              ]
            })
          }}
        />
        <main id="main-content">{children}</main>
        <Footer />
        <CookieBanner />
      </body>
    </html>
  );
}
