import { LIMITS, type ChangeItem, type ChangeSetResult } from "@sustantix/grid";
import { comparable, importSheetRows, Resolver, specForSheet, type Registry, type Vocabulary } from "@sustantix/schema";
import { z } from "zod";
import registry from "../../../../schema/aip-data-model.json";
import vocabulary from "../../../../schema/reference/vocabulary.json";
import { ApiError } from "../http";
import type { Membership } from "../tenant";
import type { ChangeStore } from "./service";

/**
 * A workbook import made in the runtime while it shows governed data, written back as one change set.
 *
 * The runtime host sends, per sheet, the rows the import added or changed (`after`) and the governed rows they
 * replaced (`before`). Rows map back to records through the sheet's own spec; only fields whose value actually differs
 * from the database are written. A field someone else changed since the runtime loaded it (the database no longer
 * holds the `before` value) is a conflict, never overwritten. Sheets the model has not normalized, time series and
 * rows an import removed are reported and left untouched.
 */

const REG = registry as unknown as Registry;
const VOCAB = vocabulary as unknown as Vocabulary;
const RESOLVER = new Resolver(VOCAB);

type Row = Record<string, unknown>;

export interface CurrentReader {
  /** Current rows of an entity's code view, by business code. */
  rows(entity: string, codes: string[], tenantId: string): Promise<Row[]>;
}

const sheetRows = z.array(z.record(z.string(), z.unknown())).max(20_000);
const importSchema = z
  .object({
    id: z.string().uuid(),
    sheets: z.record(z.string().max(120), z.object({ after: sheetRows, before: sheetRows.default([]) }).strict()),
  })
  .strict();

export interface ImportSummary {
  changeSet: ChangeSetResult | null;
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: Array<{ sheet: string; reason: string; rows: number }>;
}

export async function governedImport(body: unknown, m: Membership, reader: CurrentReader, store: ChangeStore): Promise<ImportSummary> {
  if (m.role === "viewer") throw new ApiError(403, "forbidden", "viewers cannot import data");
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "invalid_import", parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  const items: ChangeItem[] = [];
  const skipped: ImportSummary["skipped"] = [];
  const conflicts: Array<{ sheet: string; code: string; field: string; yours: unknown; current: unknown }> = [];
  const problems: string[] = [];
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const [sheet, { after, before }] of Object.entries(parsed.data.sheets)) {
    const spec = specForSheet(REG, sheet);
    if (!spec) {
      skipped.push({ sheet, reason: "this sheet is maintained in its master grid, not by workbook import", rows: after.length });
      continue;
    }
    if (spec.layer === "series") {
      skipped.push({ sheet, reason: "time series are loaded by integrations, not by workbook import", rows: after.length });
      continue;
    }
    let mapped, prior;
    try {
      mapped = importSheetRows(REG, VOCAB, sheet, after, RESOLVER);
      prior = importSheetRows(REG, VOCAB, sheet, before, RESOLVER);
    } catch (e) {
      throw new ApiError(422, "invalid_import", `${sheet}: ${e instanceof Error ? e.message : "rows could not be read"}`);
    }
    for (const i of mapped.issues) problems.push(`${sheet} ${i.code}: ${i.column} "${i.value}" is not in the vocabulary`);
    const kinds = new Map(mapped.def.columns.map((c) => [c.name, c.kind as string]));
    const beforeByCode = new Map(prior.records.map((r) => [r.code, r.values]));
    const codes = [...new Set(mapped.records.map((r) => r.code))];
    const current = new Map<string, Row>();
    for (let i = 0; i < codes.length; i += 200) for (const r of await reader.rows(spec.name, codes.slice(i, i + 200), m.tenantId)) current.set(String(r.code), r);

    for (const rec of mapped.records) {
      const cur = current.get(rec.code);
      if (!cur) {
        const values = Object.fromEntries(Object.entries(rec.values).filter(([, v]) => v !== null).map(([k, v]) => [k, wire(kinds.get(k)!, v)]));
        items.push({ entity: spec.name, op: "insert", code: rec.code, values });
        inserted++;
        continue;
      }
      const was = beforeByCode.get(rec.code);
      const changed: Record<string, unknown> = {};
      for (const [field, v] of Object.entries(rec.values)) {
        const kind = kinds.get(field)!;
        if (comparable(kind, v) === comparable(kind, cur[field])) continue;
        if (was && comparable(kind, was[field]) !== comparable(kind, cur[field])) {
          conflicts.push({ sheet, code: rec.code, field, yours: v, current: cur[field] });
          continue;
        }
        changed[field] = wire(kind, v);
      }
      if (!Object.keys(changed).length) {
        unchanged++;
        continue;
      }
      items.push({ entity: spec.name, op: "update", code: rec.code, baseVersion: Number(cur.row_version), values: changed });
      updated++;
    }
    const removed = prior.records.filter((r) => !mapped.records.some((a) => a.code === r.code)).length;
    if (removed) skipped.push({ sheet, reason: "rows an import removes are kept; delete records in their grid", rows: removed });
  }

  if (problems.length) throw new ApiError(422, "unmapped_values", `${problems.length} value(s) are not in the vocabulary`, { problems: problems.slice(0, 50) });
  if (conflicts.length) throw new ApiError(409, "import_conflict", `${conflicts.length} field(s) were changed by someone else since this data was loaded; reload and import again`, { conflicts: conflicts.slice(0, 50) });
  if (items.length > LIMITS.changeItemsMax) {
    throw new ApiError(413, "import_too_large", `this import changes ${items.length} records; one governed change holds at most ${LIMITS.changeItemsMax}. Import in smaller parts.`);
  }
  const changeSet = items.length ? await store.apply({ id: parsed.data.id, source: "import", items }, m.tenantId) : null;
  return { changeSet, inserted, updated, unchanged, skipped };
}

/** Values as a change set carries them: amounts and decimals as exact strings, integers as numbers. */
function wire(kind: string, v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (kind === "decimal" || kind === "money") return comparable(kind, v);
  if (kind === "integer") return Math.round(Number(v));
  return v;
}
