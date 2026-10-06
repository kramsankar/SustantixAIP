// Shared fixtures: the change model, the quality rules, and a tenant in memory with change-set semantics.
import type { ChangeModel, ChangeSetRequest, ChangeSetResult } from "@sustantix/grid";
import type { QualityRules } from "@sustantix/schema";
import { readFileSync } from "node:fs";
import type { BundleSink, BundleSource } from "../src/bundle.ts";
import { ingest, summarize, type IngestStore } from "../src/merge.ts";

export const json = (rel: string) => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8")) as unknown;
export const MODEL = json("../../../schema/aip-change-model.json") as ChangeModel;
export const RULES = json("../../../schema/quality/rules.json") as QualityRules;

export type Row = Record<string, unknown>;

/** A tenant in memory, with the change-set semantics both editions apply (versions, refusals). */
export class Tenant implements IngestStore {
  rows = new Map<string, Map<string, Row>>();
  sets = 0;
  constructor(private readonly vocab: Record<string, string[]> = { region: ["IN", "AE"], asset_class: ["INVERTER", "TRANSFORMER", "BLOCK"], "status/asset_operating": ["OPERATING"], risk_band: ["LOW", "HIGH"] }) {}
  table(e: string) {
    let t = this.rows.get(e);
    if (!t) this.rows.set(e, (t = new Map()));
    return t;
  }
  async current(e: string, codes: string[]) {
    return codes.map((c) => this.table(e).get(c)).filter((r): r is Row => !!r);
  }
  async existing(e: string, codes: string[]) {
    return new Set(codes.filter((c) => this.table(e).has(c)));
  }
  async vocabulary(ref: string, scope: string | null, codes: string[]) {
    const own = [...this.table(`ref_${ref}`).keys()].map((k) => (scope ? k.replace(`${scope}:`, "") : k));
    const known = new Set([...(this.vocab[scope ? `${ref}/${scope}` : ref] ?? []), ...own]);
    return new Set(codes.filter((c) => known.has(c)));
  }
  async apply(req: ChangeSetRequest): Promise<ChangeSetResult> {
    this.sets++;
    // Atomic: check every item first.
    for (const i of req.items) {
      const cur = this.table(i.entity).get(i.code);
      if (i.op === "insert" && cur) throw new Error(`${i.code} exists`);
      if (i.op === "update" && (!cur || cur.row_version !== i.baseVersion)) throw new Error(`${i.code} changed`);
    }
    for (const i of req.items) {
      const cur = this.table(i.entity).get(i.code);
      this.table(i.entity).set(i.code, { ...(cur ?? {}), ...i.values, code: i.code, row_version: Number(cur?.row_version ?? 0) + 1 });
    }
    return { id: req.id, items: req.items.map((i) => ({ entity: i.entity, op: i.op, code: i.code, rowVersion: 1 })), replayed: false };
  }
  /** The tenant as a bundle source (what each edition's reader yields). */
  source(tenant: string): BundleSource {
    return {
      edition: "vercel",
      tenant,
      read: async function* (this: Tenant, e: string) {
        const rows = [...this.table(e).values()].sort((a, b) => String(a.code).localeCompare(String(b.code)));
        if (rows.length) yield rows.map(({ code, row_version: _v, ...values }) => ({ code: String(code), values }));
      }.bind(this),
    };
  }
  sink(): BundleSink {
    let n = 0;
    return {
      deliver: async (entity, records) => {
        const out = await ingest(entity, records, { model: MODEL, rules: RULES, role: "admin", store: this, newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` });
        const s = summarize("", entity, records, out);
        return { applied: s.applied, unchanged: s.unchanged, quarantined: s.quarantined, issues: s.issues };
      },
    };
  }
}

export async function collect(it: AsyncIterable<string>) {
  const out: string[] = [];
  for await (const l of it) out.push(l);
  return out;
}

/** A small tenant: own vocabulary, two sites, a block with two child inverters (the child sorts before its parent). */
export function seeded() {
  const t = new Tenant();
  t.table("ref_asset_class").set("BLOCK", { code: "BLOCK", label: "Block", sort_order: 9, is_active: true, row_version: 1 });
  t.table("site").set("SP-01", { code: "SP-01", name: "Solar Park 1", region: "IN", timezone: "Asia/Kolkata", capacity_mw: 50, is_active: true, row_version: 3 });
  t.table("site").set("SP-02", { code: "SP-02", name: "Solar Park 2", region: "AE", timezone: "Asia/Dubai", capacity_mw: 20, is_active: true, row_version: 1 });
  t.table("asset").set("AST-A-INV1", { code: "AST-A-INV1", site: "SP-01", parent: "AST-Z-BLOCK", tag: "INV1", name: "Inverter 1", asset_class: "INVERTER", rated_capacity_mw: 2.5, last_maintenance_date: "2026-09-30T00:00:00+00:00", is_active: true, row_version: 2 });
  t.table("asset").set("AST-A-INV2", { code: "AST-A-INV2", site: "SP-01", parent: "AST-Z-BLOCK", tag: "INV2", name: "Inverter 2", asset_class: "INVERTER", rated_capacity_mw: "2.5000", is_active: true, row_version: 1 });
  t.table("asset").set("AST-Z-BLOCK", { code: "AST-Z-BLOCK", site: "SP-01", tag: "BLK", name: "Block A", asset_class: "BLOCK", is_active: true, row_version: 1 });
  t.table("work_order").set("WO-1", { code: "WO-1", site: "SP-01", asset: "AST-A-INV1", description: "Fan", source_record: "EAM", created_date: "2026-10-01 08:30:00+05:30", sla_hours: 4, estimated_cost: 1250.5, currency: "INR", is_active: true, row_version: 1 });
  return t;
}

