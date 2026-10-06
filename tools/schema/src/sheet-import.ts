/**
 * Phase 4: a workbook import in governed mode becomes change sets. Rows of a sheet the normalized model replaced are
 * mapped back through the same SheetSpec that built the table: carried columns, references by business code,
 * controlled values resolved to vocabulary codes, re-typed dates and flags. Copies of master attributes (asset tag,
 * plant name) are not stored on the record, so an import cannot change them; it changes the master instead.
 */
import { MasterContext, resolveControlled, type MasterDef, type MasterIssue } from "./masters.ts";
import { Resolver, type Vocabulary } from "./reference.ts";
import type { Registry } from "./registry.ts";
import type { SourceRow } from "./rows.ts";
import { SHEET_SPECS, specDef, type SheetSpec } from "./sheet-model.ts";

export interface ImportedRecord {
  code: string;
  values: Record<string, unknown>;
}

export interface SheetImport {
  sheet: string;
  spec: SheetSpec;
  def: MasterDef;
  records: ImportedRecord[];
  issues: MasterIssue[];
}

/** The spec that replaced a workbook sheet (by the sheet's own name), or null when the sheet is not normalized. */
export function specForSheet(reg: Registry, sheetName: string): SheetSpec | null {
  const t = reg.tables.find((x) => x.sheet === sheetName);
  return (t && SHEET_SPECS.find((s) => s.sheet === t.name)) ?? null;
}

/**
 * Maps workbook rows of one sheet to records of its normalized entity. Row values arrive in workbook form (headers
 * as in the workbook, values as a workbook import reads them); system columns (source_ordinal) are not carried.
 */
export function importSheetRows(reg: Registry, vocab: Vocabulary, sheetName: string, rows: SourceRow[], resolver = new Resolver(vocab)): SheetImport {
  const spec = specForSheet(reg, sheetName);
  if (!spec) throw new Error(`${sheetName} is not a normalized sheet`);
  const def = specDef(reg, spec);
  const ctx = new MasterContext(reg, { [sheetName]: rows });
  const issues: MasterIssue[] = [];
  const records = def.build(ctx).map((row) => {
    issues.push(...resolveControlled(def, row, resolver));
    const { source_ordinal: _ordinal, ...values } = row.values;
    return { code: row.code, values };
  });
  return { sheet: sheetName, spec, def, records, issues };
}

/** Comparable form of a stored or imported value: amounts as exact decimals, times to the second, empty as null. */
export function comparable(kind: string, v: unknown): string | null {
  if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return null;
  switch (kind) {
    case "integer":
    case "decimal":
    case "money": {
      const s = String(v).trim();
      if (!/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(s)) return s;
      const n = /e/i.test(s) ? Number(s).toFixed(10) : s;
      const [w, f = ""] = n.replace(/^-/, "").split(".");
      const frac = f.replace(/0+$/, "");
      const whole = w!.replace(/^0+(?=\d)/, "");
      const neg = n.startsWith("-") && (whole !== "0" || frac !== "");
      return `${neg ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
    }
    case "datetime": {
      const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::(\d{2}))?)?/.exec(String(v).trim());
      return m ? `${m[1]}T${m[2] ?? "00:00"}:${m[3] ?? "00"}` : String(v).trim();
    }
    case "date":
      return String(v).slice(0, 10);
    case "boolean":
      return v === true || /^(true|yes|y|1)$/i.test(String(v)) ? "true" : "false";
    default:
      return String(v).trim();
  }
}
