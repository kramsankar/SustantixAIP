import { bundleOrder, type BundleRecord } from "@sustantix/bundle";
import { isNumeric, type ChangeModel, type ColumnKind } from "@sustantix/grid";
import { ApiError } from "./http";

/**
 * Bundle export on the Vercel edition: one page of an entity's records for this tenant, in the shape every edition
 * loads (business codes, decimals as text). Platform vocabulary is never carried: it ships with every edition.
 */
export const EXPORT_PAGE_MAX = 5000;

export interface ExportReader {
  /**
   * Rows of the entity's code view for the tenant, ordered by code, and how many there are in all. The database may
   * return fewer rows than asked (its own page cap); the caller continues from where the rows end.
   */
  page(view: string, select: string, offset: number, limit: number): Promise<{ rows: Array<Record<string, unknown>>; total: number }>;
}

export function exportEntity(model: ChangeModel, name: string) {
  if (!bundleOrder(model).some((e) => e.name === name)) throw new ApiError(404, "not_found", `${name} is not carried in a bundle`);
  const e = model.entities.find((x) => x.name === name)!;
  const cols = e.columns.filter((c) => c.name !== "source_ordinal");
  const select = cols.map((c) => (isNumeric(c.kind as ColumnKind) && c.kind !== "integer" ? `${c.name}:${c.name}::text` : c.name)).join(",");
  return { view: `v_${e.name}`, select, columns: cols.map((c) => c.name).filter((c) => c !== "code") };
}

export async function exportPage(model: ChangeModel, name: string, offset: number, limit: number, reader: ExportReader): Promise<{ records: BundleRecord[]; more: boolean; total: number }> {
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > EXPORT_PAGE_MAX) throw new ApiError(400, "invalid_page", `offset ≥ 0 and 1 ≤ limit ≤ ${EXPORT_PAGE_MAX}`);
  const x = exportEntity(model, name);
  const { rows, total } = await reader.page(x.view, x.select, offset, limit);
  const records = rows.slice(0, limit).map((r) => ({ code: String(r.code), values: Object.fromEntries(x.columns.filter((c) => r[c] !== null && r[c] !== undefined).map((c) => [c, r[c]])) }));
  return { records, more: offset + records.length < total, total };
}
