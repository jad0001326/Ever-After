import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0
});

export function formatCapacity(min: number, max: number) {
  return `${min}-${max} guests`;
}

export function formatPriceRange(from: number | null | undefined, to: number | null | undefined) {
  if (from == null && to == null) return null;
  if (from != null && to != null && to > from) return `${gbp.format(from)} - ${gbp.format(to)}`;
  return gbp.format(from ?? to ?? 0);
}

export function absoluteUrl(path = "") {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${siteUrl}${path.startsWith("/") || !path ? path : `/${path}`}`;
}
