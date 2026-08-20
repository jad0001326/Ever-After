export function hasUnresolvedTaxLabel(taxLabel: string | null | undefined) {
  if (!taxLabel?.trim()) return false;
  return !/\b(?:included|inclusive|inc\.?|exempt|zero[-\s]?rated|not\s+applicable)\b/i.test(taxLabel);
}

export function formatPriceValidity(validFrom: string | null, validTo: string | null) {
  const from = formatDateOnly(validFrom);
  const to = formatDateOnly(validTo);
  if (from && to) return `Valid ${from} to ${to}`;
  if (from) return `Valid from ${from}`;
  if (to) return `Valid until ${to}`;
  return null;
}

function formatDateOnly(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
