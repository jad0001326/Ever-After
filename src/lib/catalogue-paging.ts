export const PUBLIC_CATALOGUE_ERROR = "This directory is temporarily unavailable. Please try again shortly.";

type RangeError = {
  code?: string;
  message?: string;
  details?: string | null;
};

export function normaliseCataloguePage(value: string | undefined, maxPage = 1_000) {
  const page = Number(value);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(Math.floor(page), maxPage);
}

export function isUnsatisfiableRangeError(error: RangeError | null | undefined) {
  if (!error) return false;
  return error.code === "PGRST103" || /requested range not satisfiable/i.test(error.message ?? "");
}

export function totalFromRangeError(error: RangeError | null | undefined) {
  const match = (error?.details ?? "").match(/only\s+(\d+)\s+rows?/i);
  if (!match) return null;
  const total = Number(match[1]);
  return Number.isInteger(total) && total >= 0 ? total : null;
}

export function catalogueTotalPages(total: number, pageSize: number) {
  if (pageSize < 1) return 1;
  return Math.max(Math.ceil(Math.max(total, 0) / pageSize), 1);
}
