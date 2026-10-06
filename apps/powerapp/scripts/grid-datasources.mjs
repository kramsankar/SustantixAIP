// Phase 4: the Dataverse tables the governed grids read, as the pac commands that register them with the code app.
//   node scripts/grid-datasources.mjs            prints the commands
//   node scripts/grid-datasources.mjs --run      runs them (pac must be signed in to the environment)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const model = JSON.parse(readFileSync(join(here, "../../../powerplatform/schema/change-model.json"), "utf8"));

/** Governed tables (masters, registers, transactions, vocabulary); time series stay with the integrations. */
export function gridTables(m = model) {
  return [...new Set(m.entities.filter((e) => e.layer !== "series").map((e) => e.table))].sort();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const tables = gridTables();
  for (const t of tables) {
    const args = ["code", "add-data-source", "-a", "dataverse", "-t", t];
    if (process.argv.includes("--run")) execFileSync("pac", args, { cwd: join(here, ".."), stdio: "inherit" });
    else console.log(`pac ${args.join(" ")}`);
  }
  console.error(`${tables.length} governed table(s)`);
}
