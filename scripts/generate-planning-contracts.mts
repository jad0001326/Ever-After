import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { isGeneratedFileCurrent } from "./lib/generated-file-text.mjs";
import {
  planningBudgetResourceJsonSchema,
  planningBudgetUpdateRequestJsonSchema,
  planningBudgetUpdateSuccessJsonSchema,
} from "@everaft/planning-contracts/planning-workspace/budget-api-schema";
import {
  planningConnectedPlanResourceJsonSchema,
  planningSetupUpdateRequestJsonSchema,
  planningWorkspaceImportRequestJsonSchema,
} from "@everaft/planning-contracts/planning-workspace/connection-api-schema";
import { planningDashboardSnapshotJsonSchema } from "@everaft/planning-contracts/planning-workspace/snapshot-schema";
import {
  planningProfileResourceJsonSchema,
  planningProfileUpdateRequestJsonSchema,
} from "@everaft/planning-contracts/planning-workspace/profile-api-schema";
import {
  planningTablePlanResourceJsonSchema,
  planningTablePlanUpdateRequestJsonSchema,
  planningTablePlanUpdateSuccessJsonSchema,
} from "@everaft/planning-contracts/planning-workspace/table-plan-api-schema";
import {
  planningTaskCollectionJsonSchema,
  planningTaskCreateRequestJsonSchema,
  planningTaskDeleteRequestJsonSchema,
  planningTaskDeleteSuccessJsonSchema,
  planningTaskResourceJsonSchema,
  planningTaskUpdateRequestJsonSchema,
} from "@everaft/planning-contracts/planning-workspace/task-api-schema";
import {
  planningWorkspaceCollectionJsonSchema,
} from "@everaft/planning-contracts/planning-workspace/workspace-api-schema";

const contracts = [
  {
    file: "planning-workspace-collection.v1.schema.json",
    schema: planningWorkspaceCollectionJsonSchema,
  },
  {
    file: "planning-dashboard-snapshot.v1.schema.json",
    schema: planningDashboardSnapshotJsonSchema,
  },
  {
    file: "planning-budget-resource.v1.schema.json",
    schema: planningBudgetResourceJsonSchema,
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
    file: "planning-connected-plan-resource.v1.schema.json",
    schema: planningConnectedPlanResourceJsonSchema,
  },
  {
    file: "planning-workspace-import-request.v1.schema.json",
    schema: planningWorkspaceImportRequestJsonSchema,
  },
  {
    file: "planning-setup-update-request.v1.schema.json",
    schema: planningSetupUpdateRequestJsonSchema,
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
  if (!isGeneratedFileCurrent(current, generated)) {
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
