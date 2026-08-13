import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { GoogleAnalyticsController } from "@/components/analytics/google-analytics-controller";
import { CookieBanner } from "@/components/privacy/cookie-banner";
import { socialProfileUrls } from "@/lib/social";
import { absoluteUrl } from "@/lib/utils";

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl()),
  title: {
    default: "EverAft | Plan a Scottish Wedding",
    template: "%s | EverAft"
  },
  description:
    "Discover Scottish wedding venues and photographers, then turn the decisions into a practical budget, guest list and table plan.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "EverAft",
    description: "Scottish wedding discovery and practical planning tools in one considered experience.",
    url: absoluteUrl(),
    siteName: "EverAft",
    type: "website",
    locale: "en_GB",
    images: [{ url: absoluteUrl("/images/everaft-wedding-reception.png"), width: 1536, height: 1024, alt: "Wedding breakfast in a light-filled country house" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "EverAft | Plan a Scottish Wedding",
    description: "Scottish wedding discovery and practical planning tools in one considered experience.",
    images: [absoluteUrl("/images/everaft-wedding-reception.png")]
  }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="en-GB">
      <body className="antialiased">
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
                  areaServed: "Scotland",
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
