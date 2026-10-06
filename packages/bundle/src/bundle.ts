import { createHash } from "node:crypto";
import type { ChangeModel } from "@sustantix/grid";

/**
 * A Sustantix AIP data bundle: one tenant's governed data, keyed on business codes, in the shape both editions share
 * (references as codes, amounts as decimal strings, dates as ISO strings). It moves a tenant between the Vercel and
 * Power Platform editions, or into a fresh environment, and re-imports idempotently: a record that is already there
 * unchanged stays unchanged.
 *
 * The file is gzipped NDJSON:
 *   line 1        {"format":"sustantix-aip-bundle","version":1,"exportedAt",…,"source":{edition, tenant}}
 *   then          {"e":"<entity>","code":"<business code>","values":{…}}   (entities in dependency order)
 *   last line     {"end":true,"entities":[{"entity","count","sha256"}]}
 * The trailer proves the file is complete and each entity's records are exactly what was exported.
 */

export const BUNDLE_FORMAT = "sustantix-aip-bundle";
export const BUNDLE_VERSION = 1;

type Entity = ChangeModel["entities"][number];

export interface BundleRecord {
  code: string;
  values: Record<string, unknown>;
}

export interface BundleHeader {
  format: typeof BUNDLE_FORMAT;
  version: number;
  exportedAt: string;
  source: { edition: "vercel" | "powerplatform"; tenant: string };
  modelVersion: number;
}

export interface BundleTrailer {
  end: true;
  entities: Array<{ entity: string; count: number; sha256: string }>;
}

export interface Bundle {
  header: BundleHeader;
  entities: Map<string, BundleRecord[]>;
}

export class BundleError extends Error {}

/** One planned entity: its name, and the columns that refer to its own records (loaded in a second pass). */
export interface PlannedEntity {
  name: string;
  selfRefs: string[];
}

/**
 * Entities a bundle carries, in an order every reference can be resolved in: vocabulary first, then masters before
 * the records that refer to them. Read-only entities (computed in the platform) are not carried.
 */
export function bundleOrder(model: ChangeModel): PlannedEntity[] {
  const carried = model.entities.filter((e) => e.editable || e.layer === "series");
  const byName = new Map(carried.map((e) => [e.name, e]));
  const deps = (e: Entity) => [...new Set(e.columns.filter((c) => c.kind === "fk" && c.fk && c.fk !== e.name && byName.has(c.fk)).map((c) => c.fk!))];
  const out: PlannedEntity[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (e: Entity, path: string[]) => {
    if (state.get(e.name) === "done") return;
    if (state.get(e.name) === "visiting") throw new BundleError(`reference cycle: ${[...path, e.name].join(" → ")}`);
    state.set(e.name, "visiting");
    for (const d of deps(e)) visit(byName.get(d)!, [...path, e.name]);
    state.set(e.name, "done");
    out.push({ name: e.name, selfRefs: e.columns.filter((c) => c.kind === "fk" && c.fk === e.name).map((c) => c.name) });
  };
  // Vocabulary first, then the model's own order (stable), each after what it refers to.
  for (const e of [...carried.filter((x) => x.layer === "reference"), ...carried.filter((x) => x.layer !== "reference")]) visit(e, []);
  return out;
}

/** Canonical JSON (sorted keys), so a checksum does not depend on how an edition happened to order a record's fields. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

/** A decimal without its storage scale ("2.5000" and 2.5 are both "2.5"), so editions agree byte for byte. */
export function decimalText(v: number | string): string {
  const t = typeof v === "number" ? String(v) : v.trim();
  if (!/^-?\d+(\.\d+)?$/.test(t)) return t;
  const [int, frac = ""] = t.split(".");
  const f = frac.replace(/0+$/, "");
  const i = int!.replace(/^(-?)0+(?=\d)/, "$1");
  return f ? `${i}.${f}` : i === "-0" ? "0" : i;
}

/**
 * One record in the shape every edition loads: only the entity's columns, no empties, decimals and amounts as strings,
 * dates as YYYY-MM-DD and instants as UTC YYYY-MM-DDTHH:MM:SS (each edition reads them with its own zone suffix).
 */
export function normalizeRecord(e: Entity, r: BundleRecord): BundleRecord {
  // In the model's column order, so the same data makes the same bytes whichever edition exported it.
  const values: Record<string, unknown> = {};
  for (const c of e.columns) {
    if (c.name === "code" || c.name === "source_ordinal") continue;
    const kind = c.kind as string;
    const v = r.values[c.name];
    if (v === null || v === undefined || v === "") continue;
    if ((kind === "decimal" || kind === "money") && (typeof v === "number" || typeof v === "string")) values[c.name] = decimalText(v);
    else if (kind === "date" && typeof v === "string") values[c.name] = v.slice(0, 10);
    else if (kind === "datetime" && typeof v === "string") {
      const t = Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(v) ? v : `${v.replace(" ", "T")}Z`);
      values[c.name] = Number.isNaN(t) ? v : new Date(t).toISOString().slice(0, 19);
    } else values[c.name] = v;
  }
  return { code: String(r.code), values };
}

/** Where a bundle's records come from: one edition, one tenant, pages of an entity's records. */
export interface BundleSource {
  edition: BundleHeader["source"]["edition"];
  tenant: string;
  read(entity: string): AsyncIterable<BundleRecord[]>;
}

/** Writes a bundle as NDJSON lines (the caller gzips and stores them). */
export async function* exportBundle(source: BundleSource, model: ChangeModel, now = () => new Date()): AsyncGenerator<string> {
  const header: BundleHeader = { format: BUNDLE_FORMAT, version: BUNDLE_VERSION, exportedAt: now().toISOString(), source: { edition: source.edition, tenant: source.tenant }, modelVersion: model.version ?? 1 };
  yield JSON.stringify(header);
  const trailer: BundleTrailer = { end: true, entities: [] };
  for (const { name } of bundleOrder(model)) {
    const entity = model.entities.find((x) => x.name === name)!;
    const hash = createHash("sha256");
    let count = 0;
    const seen = new Set<string>();
    for await (const page of source.read(name)) {
      for (const raw of page) {
        const r = normalizeRecord(entity, raw);
        if (seen.has(r.code)) throw new BundleError(`${name}: business code ${r.code} appears twice`);
        seen.add(r.code);
        const line = canonical({ code: r.code, values: r.values });
        hash.update(line).update("\n");
        count++;
        yield JSON.stringify({ e: name, code: r.code, values: r.values });
      }
    }
    if (count) trailer.entities.push({ entity: name, count, sha256: hash.digest("hex") });
  }
  yield JSON.stringify(trailer);
}

/** Reads and verifies a bundle: format, completeness, and each entity's checksum. */
export async function readBundle(lines: AsyncIterable<string> | Iterable<string>, model: ChangeModel): Promise<Bundle> {
  let header: BundleHeader | null = null;
  let trailer: BundleTrailer | null = null;
  const entities = new Map<string, BundleRecord[]>();
  const known = new Set(bundleOrder(model).map((e) => e.name));
  let n = 0;
  for await (const raw of lines as AsyncIterable<string>) {
    n++;
    if (!raw.trim()) continue;
    if (trailer) throw new BundleError(`line ${n}: data after the end of the bundle`);
    let v: Record<string, unknown>;
    try {
      v = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new BundleError(`line ${n}: not JSON`);
    }
    if (!header) {
      if (v.format !== BUNDLE_FORMAT) throw new BundleError("not a Sustantix AIP bundle");
      if (v.version !== BUNDLE_VERSION) throw new BundleError(`bundle version ${String(v.version)} is not supported (expected ${BUNDLE_VERSION})`);
      header = v as unknown as BundleHeader;
      continue;
    }
    if (v.end === true) {
      trailer = v as unknown as BundleTrailer;
      continue;
    }
    const e = String(v.e ?? "");
    if (!known.has(e)) throw new BundleError(`line ${n}: ${e || "a record"} is not an entity this platform carries`);
    if (typeof v.code !== "string" || !v.code || !v.values || typeof v.values !== "object" || Array.isArray(v.values)) throw new BundleError(`line ${n}: a record needs a code and values`);
    const list = entities.get(e) ?? [];
    list.push({ code: v.code, values: v.values as Record<string, unknown> });
    entities.set(e, list);
  }
  if (!header) throw new BundleError("empty bundle");
  if (!trailer) throw new BundleError("the bundle is incomplete (no end record): it was cut off while being written or copied");
  const listed = new Map(trailer.entities.map((x) => [x.entity, x]));
  for (const [e, records] of entities) {
    const t = listed.get(e);
    if (!t) throw new BundleError(`${e}: records not listed at the end of the bundle`);
    const hash = createHash("sha256");
    for (const r of records) hash.update(canonical({ code: r.code, values: r.values })).update("\n");
    if (t.count !== records.length || t.sha256 !== hash.digest("hex")) throw new BundleError(`${e}: records do not match the bundle's checksum (altered or incomplete)`);
  }
  for (const t of trailer.entities) if (!entities.has(t.entity)) throw new BundleError(`${t.entity}: listed but missing from the bundle`);
  return { header, entities };
}

/** One delivery's outcome, as the target edition reports it. */
export interface DeliveryOutcome {
  applied: number;
  unchanged: number;
  quarantined: number;
  /** Rejections hold their record back; warnings are reported and the record loads. */
  issues: Array<{ record: string | null; rule: string; message: string; severity?: string }>;
}

/** Where a bundle goes: deliveries of up to 5,000 records of one entity, merged by business code. */
export interface BundleSink {
  deliver(entity: string, records: BundleRecord[]): Promise<DeliveryOutcome>;
}

export interface ImportReport {
  entities: Array<{ entity: string; records: number } & Omit<DeliveryOutcome, "issues">>;
  issues: Array<{ entity: string; record: string | null; rule: string; message: string; severity?: string }>;
}

export const DELIVERY_MAX = 5000;

/**
 * Imports a bundle in dependency order. An entity whose records refer to each other (an asset and its parent) loads
 * in two passes: first without those references, then with them, so a parent need not precede its children.
 */
export async function importBundle(bundle: Bundle, model: ChangeModel, sink: BundleSink, progress: (msg: string) => void = () => undefined): Promise<ImportReport> {
  const report: ImportReport = { entities: [], issues: [] };
  for (const { name, selfRefs } of bundleOrder(model)) {
    const records = bundle.entities.get(name);
    if (!records?.length) continue;
    const total = { entity: name, records: records.length, applied: 0, unchanged: 0, quarantined: 0 };
    const quarantined = new Set<string>();
    const passes = selfRefs.length
      ? [records.map((r) => ({ code: r.code, values: Object.fromEntries(Object.entries(r.values).filter(([k]) => !selfRefs.includes(k))) })), records]
      : [records];
    for (const [p, list] of passes.entries()) {
      const second = p === 1;
      for (let i = 0; i < list.length; i += DELIVERY_MAX) {
        const chunk = second ? list.slice(i, i + DELIVERY_MAX).filter((r) => !quarantined.has(r.code)) : list.slice(i, i + DELIVERY_MAX);
        if (!chunk.length) continue;
        const out = await sink.deliver(name, chunk);
        // The first pass decides applied/unchanged; the second only adds the self-references to records already in.
        if (!second || !selfRefs.length) {
          total.applied += out.applied;
          total.unchanged += out.unchanged;
        }
        total.quarantined += out.quarantined;
        for (const x of out.issues) {
          if (x.record && x.severity !== "warn") quarantined.add(x.record);
          report.issues.push({ entity: name, ...x });
        }
      }
    }
    report.entities.push(total);
    progress(`${name}: ${total.records} records · ${total.applied} applied · ${total.unchanged} unchanged · ${total.quarantined} quarantined`);
  }
  return report;
}
