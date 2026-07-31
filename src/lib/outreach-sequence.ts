export type OutreachFollowUpStage = "first" | "final";

export function normalizeOutreachFollowUpStage(value: unknown): OutreachFollowUpStage {
  return value === "final" ? "final" : "first";
}

export function followUpHistoryMatchesStage(stage: OutreachFollowUpStage, completedFollowUps: number) {
  return completedFollowUps === (stage === "final" ? 1 : 0);
}

export function outreachFollowUpStageLabel(stage: OutreachFollowUpStage) {
  return stage === "final" ? "final reminder" : "7-day reminder";
}
