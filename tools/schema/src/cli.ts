/**
 * Regenerates every derived schema artefact from the governed workbook:
 *   schema/aip-data-model.json               registry (source of truth for all backends)
 *   supabase/migrations/*_aip_platform.sql   tenancy, RLS helpers, audit, FX, license memory
 *   supabase/migrations/*_aip_data_model.sql one RLS-protected table per sheet
 *   powerplatform/schema/*.json              Dataverse metadata payloads
 * Usage: tsx src/cli.ts [workbook.xlsx]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dataModelPlan, platformPlan } from "./dataverse.ts";
import { inferRegistry } from "./infer.ts";
import { dataModelSql, platformSql } from "./postgres.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const workbook = process.argv[2] ?? join(root, "reference/AIP_Data_v732.xlsx");
const reg = inferRegistry(readFileSync(workbook), basename(workbook));

mkdirSync(join(root, "schema"), { recursive: true });
writeFileSync(join(root, "schema/aip-data-model.json"), JSON.stringify(reg, null, 1) + "\n");

mkdirSync(join(root, "supabase/migrations"), { recursive: true });
writeFileSync(join(root, "supabase/migrations/20260925000100_aip_platform.sql"), platformSql(reg.defaultCurrency));
writeFileSync(join(root, "supabase/migrations/20260925000200_aip_data_model.sql"), dataModelSql(reg));

mkdirSync(join(root, "powerplatform/schema"), { recursive: true });
writeFileSync(join(root, "powerplatform/schema/platform-tables.json"), JSON.stringify(platformPlan(), null, 1) + "\n");
writeFileSync(join(root, "powerplatform/schema/data-model-tables.json"), JSON.stringify(dataModelPlan(reg).map(({ source, ...p }) => ({ ...p, sheet: source?.sheet })), null, 1) + "\n");

const cols = reg.tables.reduce((n, t) => n + t.columns.length, 0);
const rows = reg.tables.reduce((n, t) => n + t.rowCount, 0);
console.log(`schema: ${reg.tables.length} tables · ${cols} columns · ${rows} seed rows · money columns ${reg.tables.flatMap((t) => t.columns).filter((c) => c.kind === "money").length}`);
