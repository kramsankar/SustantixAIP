/**
 * Emits an idempotent SQL seed that loads the governed workbook into one tenant.
 *   tsx src/seed-sql.ts --tenant <uuid> --name "Tenant name" [--region IN] [--currency INR] [--workbook file] > seed.sql
 */
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inferRegistry } from "./infer.ts";
import type { Registry } from "./registry.ts";
import { pgRecord, readSheets } from "./rows.ts";

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function literal(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("non-finite number");
    return String(v);
  }
  if (typeof v === "boolean") return v ? "true" : "false";
  return `'${String(v).replace(/'/g, "''")}'`;
}

export function seedSql(reg: Registry, workbook: Buffer, tenant: { id: string; name: string; region: string; currency: string }): string {
  if (!GUID.test(tenant.id)) throw new Error("tenant id must be a GUID");
  if (!/^[A-Z]{3}$/.test(tenant.currency)) throw new Error("currency must be ISO-4217");
  const sheets = readSheets(workbook);
  const out: string[] = [
    `-- Sustantix AIP seed · ${reg.source} → tenant ${tenant.id}`,
    "begin;",
    `insert into aip.tenants(id, name, region, default_currency) values (${literal(tenant.id)}, ${literal(tenant.name)}, ${literal(tenant.region)}, ${literal(tenant.currency)}) on conflict (id) do nothing;`,
  ];
  for (const t of reg.tables) {
    const rows = sheets[t.sheet] ?? [];
    if (!rows.length) continue;
    const recs = rows.map((r, i) => pgRecord(t, r, i, tenant.id, tenant.currency));
    const cols = Object.keys(recs[0]!);
    const updates = cols.filter((c) => c !== "tenant_id" && c !== "row_key").map((c) => `"${c}" = excluded."${c}"`);
    for (let i = 0; i < recs.length; i += 500) {
      const values = recs.slice(i, i + 500).map((r) => `(${cols.map((c) => literal(r[c])).join(",")})`);
      out.push(
        `insert into aip."${t.name}" (${cols.map((c) => `"${c}"`).join(",")}) values\n${values.join(",\n")}\non conflict (tenant_id, row_key) do update set ${updates.join(", ")};`,
      );
    }
  }
  out.push("commit;");
  return out.join("\n") + "\n";
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const flag = (k: string, d?: string) => {
    const i = process.argv.indexOf("--" + k);
    return i > 0 ? process.argv[i + 1] : d;
  };
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const file = flag("workbook", join(root, "reference/AIP_Data_v732.xlsx"))!;
  const wb = readFileSync(file);
  const reg = inferRegistry(wb, basename(file));
  process.stdout.write(
    seedSql(reg, wb, {
      id: flag("tenant") ?? (() => { throw new Error("--tenant is required"); })(),
      name: flag("name", "Seed tenant")!,
      region: flag("region", "IN")!,
      currency: flag("currency", reg.defaultCurrency)!,
    }),
  );
}
