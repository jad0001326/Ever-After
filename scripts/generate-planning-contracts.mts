import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  planningBudgetUpdateRequestJsonSchema,
  planningBudgetUpdateSuccessJsonSchema,
} from "../src/lib/planning-workspace/budget-api-schema.ts";
import { planningDashboardSnapshotJsonSchema } from "../src/lib/planning-workspace/snapshot-schema.ts";
import {
  planningProfileResourceJsonSchema,
  planningProfileUpdateRequestJsonSchema,
} from "../src/lib/planning-workspace/profile-api-schema.ts";
import {
  planningTablePlanResourceJsonSchema,
  planningTablePlanUpdateRequestJsonSchema,
  planningTablePlanUpdateSuccessJsonSchema,
} from "../src/lib/planning-workspace/table-plan-api-schema.ts";
import {
  planningTaskCollectionJsonSchema,
  planningTaskCreateRequestJsonSchema,
  planningTaskDeleteRequestJsonSchema,
  planningTaskDeleteSuccessJsonSchema,
  planningTaskResourceJsonSchema,
  planningTaskUpdateRequestJsonSchema,
} from "../src/lib/planning-workspace/task-api-schema.ts";

const contracts = [
  {
    file: "planning-dashboard-snapshot.v1.schema.json",
    schema: planningDashboardSnapshotJsonSchema,
  },
  {
    file: "planning-budget-update-request.v1.schema.json",
    schema: planningBudgetUpdateRequestJsonSchema,
  },
  {
    file: "planning-budget-update-success.v1.schema.json",
    schema: planningBudgetUpdateSuccessJsonSchema,
  },
  {
    file: "planning-table-plan-resource.v1.schema.json",
    schema: planningTablePlanResourceJsonSchema,
  },
  {
    file: "planning-table-plan-update-request.v1.schema.json",
    schema: planningTablePlanUpdateRequestJsonSchema,
  },
  {
    file: "planning-table-plan-update-success.v1.schema.json",
    schema: planningTablePlanUpdateSuccessJsonSchema,
  },
  {
    file: "planning-profile-resource.v1.schema.json",
    schema: planningProfileResourceJsonSchema,
  },
  {
    file: "planning-profile-update-request.v1.schema.json",
    schema: planningProfileUpdateRequestJsonSchema,
  },
  {
    file: "planning-task-resource.v1.schema.json",
    schema: planningTaskResourceJsonSchema,
  },
  {
    file: "planning-task-collection.v1.schema.json",
    schema: planningTaskCollectionJsonSchema,
  },
  {
    file: "planning-task-create-request.v1.schema.json",
    schema: planningTaskCreateRequestJsonSchema,
  },
  {
    file: "planning-task-update-request.v1.schema.json",
    schema: planningTaskUpdateRequestJsonSchema,
  },
  {
    file: "planning-task-delete-request.v1.schema.json",
    schema: planningTaskDeleteRequestJsonSchema,
  },
  {
    file: "planning-task-delete-success.v1.schema.json",
    schema: planningTaskDeleteSuccessJsonSchema,
  },
];
let stale = false;

for (const contract of contracts) {
  const schemaPath = fileURLToPath(new URL(
    `../docs/planning-hub/contracts/${contract.file}`,
    import.meta.url,
  ));
  const generated = `${JSON.stringify(contract.schema, null, 2)}\n`;
  if (process.argv.includes("--write")) {
    await writeFile(schemaPath, generated, "utf8");
    console.log(`Wrote ${schemaPath}`);
    continue;
  }
  const current = await readFile(schemaPath, "utf8").catch(() => "");
  if (current !== generated) {
    stale = true;
    console.error(`Planning contract is stale: ${contract.file}`);
  } else {
    console.log(`Planning contract is current: ${contract.file}`);
  }
}

if (stale) {
  console.error("Run npm run planning-contract:write after an intentional contract change.");
  process.exitCode = 1;
}
