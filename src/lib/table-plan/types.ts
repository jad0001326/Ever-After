export type SeatingRuleType = "must_next_to" | "prefer_next_to" | "must_not_next_to" | "must_separate";

export type TablePlanGuest = {
  id: string;
  name: string;
  tableId: string | null;
  seatIndex: number | null;
};

export type TablePlanTable = {
  id: string;
  name: string;
  capacity: number;
  locked: boolean;
};

export type SeatingRule = {
  id: string;
  personAId: string;
  personBId: string;
  type: SeatingRuleType;
};

export type TablePlan = {
  schemaVersion: 1;
  id: string;
  name: string;
  guests: TablePlanGuest[];
  tables: TablePlanTable[];
  rules: SeatingRule[];
  updatedAt: string;
};

export type RuleConflict = {
  ruleId: string | null;
  message: string;
};

export type ArrangementResult = {
  plan: TablePlan;
  conflicts: RuleConflict[];
  preferenceScore: number;
};
