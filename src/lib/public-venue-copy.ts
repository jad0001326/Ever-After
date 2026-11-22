const LAUNCH_REVIEW_NOTE =
  /(?:\s|^)Imported for EverAft launch review from public venue research;\s*confirm copy, pricing, imagery, and permissions before publishing\.?/gi;

export function publicVenueCopy(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(LAUNCH_REVIEW_NOTE, " ").replace(/[ \t]{2,}/g, " ").replace(/\s+\n/g, "\n").trim();
}
