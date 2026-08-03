import { describe, expect, it } from "vitest";
import {
  followUpHistoryMatchesStage,
  normalizeOutreachFollowUpStage,
  outreachFollowUpStageLabel
} from "./outreach-sequence";

describe("outreach follow-up sequence", () => {
  it("allows only one 7-day reminder and one final reminder", () => {
    expect(followUpHistoryMatchesStage("first", 0)).toBe(true);
    expect(followUpHistoryMatchesStage("first", 1)).toBe(false);
    expect(followUpHistoryMatchesStage("final", 0)).toBe(false);
    expect(followUpHistoryMatchesStage("final", 1)).toBe(true);
    expect(followUpHistoryMatchesStage("final", 2)).toBe(false);
  });

  it("treats missing or invalid stages as the first reminder", () => {
    expect(normalizeOutreachFollowUpStage(undefined)).toBe("first");
    expect(normalizeOutreachFollowUpStage("anything-else")).toBe("first");
    expect(normalizeOutreachFollowUpStage("final")).toBe("final");
    expect(outreachFollowUpStageLabel("first")).toBe("7-day reminder");
    expect(outreachFollowUpStageLabel("final")).toBe("final reminder");
  });
});
