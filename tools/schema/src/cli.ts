/**
 * Regenerates every derived schema artefact from the governed workbook:
 *   schema/aip-data-model.json               registry (source of truth for all backends)
 *   supabase/migrations/*_aip_platform.sql   tenancy, RLS helpers, audit, FX, license memory
 *   supabase/migrations/*_aip_data_model.sql one RLS-protected table per sheet
 *   supabase/migrations/*_aip_reference.sql  controlled vocabulary (schema/reference/vocabulary.json)
 *   powerplatform/schema/*.json              Dataverse metadata payloads
 * Usage: tsx src/cli.ts [workbook.xlsx]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dataModelPlan, platformPlan } from "./dataverse.ts";
import { inferRegistry, runtimeDeclaredKeys } from "./infer.ts";
import { dataModelSql, platformSql } from "./postgres.ts";
import { correctionLogPlan, correctionLogSql, applyCorrections, loadCorrections } from "./corrections.ts";
import { loadVocabulary, referencePlan, referenceSql, validateVocabulary } from "./reference.ts";
import { readSheets } from "./rows.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const workbook = process.argv[2] ?? join(root, "reference/AIP_Data_v915.xlsx");
const reg = inferRegistry(readFileSync(workbook), basename(workbook), "INR", runtimeDeclaredKeys(root));

mkdirSync(join(root, "schema"), { recursive: true });
writeFileSync(join(root, "schema/aip-data-model.json"), JSON.stringify(reg, null, 1) + "\n");

mkdirSync(join(root, "supabase/migrations"), { recursive: true });
writeFileSync(join(root, "supabase/migrations/20260925000100_aip_platform.sql"), platformSql(reg.defaultCurrency));
writeFileSync(join(root, "supabase/migrations/20260925000200_aip_data_model.sql"), dataModelSql(reg));

const vocab = loadVocabulary(root);
const problems = validateVocabulary(vocab, reg);
if (problems.length) throw new Error(`schema/reference/vocabulary.json is invalid:\n  ${problems.join("\n  ")}`);
writeFileSync(join(root, "supabase/migrations/20261001000100_aip_reference.sql"), referenceSql(vocab));
// Corrections must derive cleanly from the current workbook before the log table is (re)generated.
const derived = applyCorrections(reg, readSheets(readFileSync(workbook)), loadCorrections(root)).entries;
writeFileSync(join(root, "supabase/migrations/20261001000200_aip_data_correction.sql"), correctionLogSql());

mkdirSync(join(root, "powerplatform/schema"), { recursive: true });
writeFileSync(join(root, "powerplatform/schema/platform-tables.json"), JSON.stringify(platformPlan(), null, 1) + "\n");
writeFileSync(join(root, "powerplatform/schema/reference-tables.json"), JSON.stringify([...referencePlan(vocab), correctionLogPlan()], null, 1) + "\n");
writeFileSync(join(root, "powerplatform/schema/data-model-tables.json"), JSON.stringify(dataModelPlan(reg).map(({ source, ...p }) => ({ ...p, sheet: source?.sheet })), null, 1) + "\n");

const cols = reg.tables.reduce((n, t) => n + t.columns.length, 0);
const rows = reg.tables.reduce((n, t) => n + t.rowCount, 0);
console.log(`corrections: ${derived.length} corrected row(s)`);
console.log(`reference: ${vocab.tables.length} tables · ${vocab.tables.reduce((n, t) => n + t.values.length, 0)} codes · ${vocab.bindings.length} governed columns`);
console.log(`schema: ${reg.tables.length} tables · ${cols} columns · ${rows} seed rows · money columns ${reg.tables.flatMap((t) => t.columns).filter((c) => c.kind === "money").length}`);
