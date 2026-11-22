import { describe, expect, it } from "vitest";
import { catalogueTotalPages, isUnsatisfiableRangeError, normaliseCataloguePage, totalFromRangeError } from "@/lib/catalogue-paging";

describe("catalogue paging", () => {
  it("keeps an in-range page and caps an absurd one", () => {
    expect(normaliseCataloguePage("2")).toBe(2);
    expect(normaliseCataloguePage("80")).toBe(80);
    expect(normaliseCataloguePage("0")).toBe(1);
    expect(normaliseCataloguePage("-4")).toBe(1);
    expect(normaliseCataloguePage("nope")).toBe(1);
    expect(normaliseCataloguePage("999999")).toBe(1000);
  });

  it("recognises PostgREST's unsatisfiable range without treating other errors as paging", () => {
    expect(isUnsatisfiableRangeError({ code: "PGRST103", message: "Requested range not satisfiable" })).toBe(true);
    expect(isUnsatisfiableRangeError({ message: "Requested range not satisfiable" })).toBe(true);
    expect(isUnsatisfiableRangeError({ code: "PGRST301", message: "JWT expired" })).toBe(false);
    expect(isUnsatisfiableRangeError(null)).toBe(false);
  });

  it("reads the real total from the range error details", () => {
    expect(totalFromRangeError({
      details: "An offset of 474 was requested, but there are only 6 rows."
    })).toBe(6);
    expect(totalFromRangeError({ details: null })).toBeNull();
    expect(catalogueTotalPages(6, 6)).toBe(1);
    expect(catalogueTotalPages(7, 6)).toBe(2);
    expect(catalogueTotalPages(0, 6)).toBe(1);
  });
});
