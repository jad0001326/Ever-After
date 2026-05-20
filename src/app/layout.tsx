import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
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
    default: "Scottish Wedding Venues | EverAft",
    template: "%s | EverAft"
  },
  description:
    "Discover premium Scottish wedding venues, compare capacity and pricing, and enquire directly with venue teams across Scotland.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "Scottish Wedding Venues | EverAft",
    description: "A premium wedding venue discovery platform for couples planning weddings in Scotland.",
    url: absoluteUrl(),
    siteName: "EverAft",
    type: "website",
    locale: "en_GB"
  },
  twitter: {
    card: "summary_large_image",
    title: "Scottish Wedding Venues | EverAft",
    description: "Browse castles, estates, barns, and luxury hotels for your Scottish wedding day."
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
                  areaServed: "Scotland"
                }
              ]
            })
          }}
        />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
