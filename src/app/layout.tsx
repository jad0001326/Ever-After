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
    default: "EverAft | Scottish wedding venue search",
    template: "%s | EverAft"
  },
  description:
    "Discover premium Scottish wedding venues, from castles and country estates to barns and luxury hotels.",
  openGraph: {
    title: "EverAft",
    description: "A modern wedding venue discovery platform for Scotland.",
    url: absoluteUrl(),
    siteName: "EverAft",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-GB">
      <body className={`${sans.variable} ${display.variable} antialiased`}>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
