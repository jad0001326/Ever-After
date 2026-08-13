import { describe, expect, it } from "vitest";
import {
  isGeneratedFileCurrent,
  normalizeGeneratedFileText,
} from "./generated-file-text.mjs";

describe("generated file text comparison", () => {
  it("treats Windows and Unix line endings as equivalent", () => {
    expect(isGeneratedFileCurrent("{\r\n  \"ok\": true\r\n}\r\n", "{\n  \"ok\": true\n}\n"))
      .toBe(true);
  });

  it("continues to detect content drift", () => {
    expect(isGeneratedFileCurrent("{\r\n  \"ok\": false\r\n}\r\n", "{\n  \"ok\": true\n}\n"))
      .toBe(false);
  });

  it("does not normalize lone carriage returns", () => {
    expect(normalizeGeneratedFileText("one\rtwo")).toBe("one\rtwo");
  });
});
