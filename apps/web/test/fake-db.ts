/**
 * Minimal in-memory stand-in for the subset of the supabase-js query builder used by
 * lib/supabase/stores.ts. Values round-trip as PostgREST would send them (bytea as `\x` hex).
 */
type Row = Record<string, unknown>;
type Result<T> = { data: T; error: { message: string } | null };

export class FakeDb {
  readonly tables = new Map<string, Row[]>();
  readonly calls: string[] = [];
  /** Tables whose writes fail, as RLS would refuse them. */
  readonly denyWrites = new Set<string>();

  table(name: string): Row[] {
    let t = this.tables.get(name);
    if (!t) this.tables.set(name, (t = []));
    return t;
  }

  from(name: string) {
    const db = this;
    const filters: Array<[string, unknown]> = [];
    let columns: string[] | null = null;
    let op: "select" | "delete" = "select";

    const matches = (r: Row) => filters.every(([c, v]) => r[c] === v);
    const project = (r: Row) => (columns ? Object.fromEntries(columns.map((c) => [c, r[c]])) : { ...r });

    const builder = {
      select(cols: string) {
        columns = cols.split(",").map((c) => c.trim());
        return builder;
      },
      eq(col: string, value: unknown) {
        filters.push([col, value]);
        return builder;
      },
      delete() {
        op = "delete";
        return builder;
      },
      async maybeSingle(): Promise<Result<Row | null>> {
        db.calls.push(`${name}.select`);
        const hits = db.table(name).filter(matches);
        return { data: hits[0] ? project(hits[0]) : null, error: null };
      },
      async upsert(row: Row, opts: { onConflict: string }): Promise<Result<null>> {
        db.calls.push(`${name}.upsert`);
        if (db.denyWrites.has(name)) return { data: null, error: { message: "new row violates row-level security policy" } };
        const keys = opts.onConflict.split(",");
        const t = db.table(name);
        const i = t.findIndex((r) => keys.every((k) => r[k] === row[k]));
        if (i >= 0) t[i] = { ...t[i], ...row };
        else t.push({ ...row });
        return { data: null, error: null };
      },
      async insert(row: Row): Promise<Result<null>> {
        db.calls.push(`${name}.insert`);
        if (db.denyWrites.has(name)) return { data: null, error: { message: "permission denied" } };
        db.table(name).push({ ...row });
        return { data: null, error: null };
      },
      then<T>(resolve: (r: Result<Row[] | null>) => T) {
        if (op === "delete") {
          db.calls.push(`${name}.delete`);
          const t = db.table(name);
          db.tables.set(name, t.filter((r) => !matches(r)));
          return Promise.resolve(resolve({ data: null, error: null }));
        }
        db.calls.push(`${name}.select`);
        return Promise.resolve(resolve({ data: db.table(name).filter(matches).map(project), error: null }));
      },
    };
    return builder;
  }
}
