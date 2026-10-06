import { DATASET_BINDINGS, DATASET_MASTERS, DATASET_TABLES, referenceResolver, type TenantSource } from "@sustantix/analytics";

/**
 * Loads a tenant's analytics inputs: masters through their code views (aip.v_<master>), history and time series
 * from the workbook-shaped tables, and the vocabulary from the reference tables. Everything is read with the
 * caller's client, so row-level security decides what the engines see.
 */

export type Row = Record<string, unknown>;

/** Reads every row of a table or view, page by page (PostgREST caps each response). */
export interface TableReader {
  readAll(table: string): Promise<Row[]>;
}

const REF_TABLES = [...new Set(Object.values(DATASET_BINDINGS))];

export async function loadTenantSource(reader: TableReader, currency: string): Promise<TenantSource> {
  const [masters, tables, refs, aliases] = await Promise.all([
    Promise.all(DATASET_MASTERS.map(async (m) => [m, await reader.readAll(`v_${m}`)] as const)),
    Promise.all(DATASET_TABLES.map(async (t) => [t, await reader.readAll(t)] as const)),
    Promise.all(REF_TABLES.map(async (t) => (await reader.readAll(`ref_${t}`)).map((r) => ({ table: t, scope: (r.scope as string | null) ?? null, code: String(r.code), label: String(r.label) })))),
    reader.readAll("ref_alias"),
  ]);
  const masterRows = new Map(
    masters.map(([name, rows]) => [
      name as string,
      rows.map((r) => {
        const { id: _id, tenant_id: _t, code, is_active: _a, row_version: _v, updated_at: _u, ...values } = r;
        return { code: String(code), values };
      }),
    ]),
  );
  const tableRows = new Map(tables.map(([t, rows]) => [t as string, rows]));
  const resolve = referenceResolver(
    refs.flat(),
    aliases.map((a) => ({ table: String(a.ref_table), scope: (a.scope as string | null) ?? null, alias: String(a.alias), code: String(a.code) })),
  );
  return {
    currency,
    master: (name) => {
      const rows = masterRows.get(name);
      if (!rows) throw new Error(`master ${name} was not loaded`);
      return rows;
    },
    rows: (table) => {
      const rows = tableRows.get(table);
      if (!rows) throw new Error(`table ${table} was not loaded`);
      return rows;
    },
    resolve: (column, ref, value) => resolve(DATASET_BINDINGS[column] ?? ref, value),
  };
}
