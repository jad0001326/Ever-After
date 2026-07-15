import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { GoogleAnalyticsController } from "@/components/analytics/google-analytics-controller";
import { CookieBanner } from "@/components/privacy/cookie-banner";
import { socialProfileUrls } from "@/lib/social";
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
    "Discover thoughtful wedding venues and help shape a trusted supplier directory for celebrations across the UK.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "EverAft",
    description: "A growing wedding directory for couples planning celebrations across the UK.",
    url: absoluteUrl(),
    siteName: "EverAft",
    type: "website",
    locale: "en_GB",
    images: [{ url: absoluteUrl("/images/everaft-wedding-reception.png"), width: 1536, height: 1024, alt: "Wedding breakfast in a light-filled country house" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "EverAft | Trusted UK wedding suppliers",
    description: "A growing wedding directory for couples planning celebrations across the UK.",
    images: [absoluteUrl("/images/everaft-wedding-reception.png")]
  }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="en-GB">
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
                  areaServed: "United Kingdom",
                  ...(socialProfileUrls.length > 0 ? { sameAs: socialProfileUrls } : {})
                }
              ]
            })
          }}
        />
        <main id="main-content">{children}</main>
        <Footer />
        <GoogleAnalyticsController measurementId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        <CookieBanner />
      </body>
    </html>
  );
}
