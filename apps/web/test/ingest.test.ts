import type { ChangeSetRequest, ChangeSetResult } from "@sustantix/grid";
import { describe, expect, it } from "vitest";
import { guardRequest, requirementFor } from "../lib/gate";
import { CHANGE_MODEL } from "../lib/grid/catalogue";
import { authenticate, bearerKey, createIntegration, hashKey, KEY_PATTERN, newKey, type Integration, type IntegrationDirectory } from "../lib/ingest/integrations";
import { ingest, type IngestStore, type InboundRecord, type Outcome } from "../lib/ingest/pipeline";
import { deliver, discard, replay, RULES, type Ledger } from "../lib/ingest/service";
import type { StagedRow } from "../lib/ingest/store";
import type { Membership } from "../lib/tenant";

type Row = Record<string, unknown>;
let seq = 0;
const newId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

/** A tenant as the pipeline sees it: some sites, assets and work orders, and the platform vocabulary. */
class MemoryStore implements IngestStore {
  sets: ChangeSetRequest[] = [];
  refuse = new Set<string>();
  rows: Record<string, Row[]> = {
    site: [{ code: "SP-01" }, { code: "SP-02" }],
    asset: [{ code: "AST-1" }],
    work_order: [{ code: "WO-1", site: "SP-01", asset: "AST-1", description: "Fan", sla_hours: 4, status: "OPEN", source_record: "EAM", row_version: 3 }],
  };
  async current(entity: string, codes: string[]) {
    return (this.rows[entity] ?? []).filter((r) => codes.includes(String(r.code)));
  }
  async existing(entity: string, codes: string[]) {
    return new Set((this.rows[entity] ?? []).map((r) => String(r.code)).filter((c) => codes.includes(c)));
  }
  async vocabulary(ref: string, _scope: string | null, codes: string[]) {
    const known: Record<string, string[]> = { status: ["OPEN", "IN_PROGRESS", "COMPLETED"], priority: ["HIGH", "LOW"] };
    return new Set(codes.filter((c) => (known[ref] ?? []).includes(c)));
  }
  async apply(req: ChangeSetRequest): Promise<ChangeSetResult> {
    if (req.items.some((i) => this.refuse.has(i.code))) throw new Error(`refused ${req.items.map((i) => i.code).join(",")}`);
    this.sets.push(req);
    return { id: req.id, items: req.items.map((i) => ({ entity: i.entity, op: i.op, code: i.code, rowVersion: 1 })), replayed: false };
  }
}

class MemoryLedger implements Ledger {
  batches: Array<{ batch: unknown; records: InboundRecord[]; outcomes: Outcome[] }> = [];
  staged: Array<StagedRow & { status: string }> = [];
  async record(batch: { entity: string }, records: InboundRecord[], outcomes: Outcome[]) {
    this.batches.push({ batch, records, outcomes });
    records.forEach((r, i) => this.staged.push({ id: this.staged.length + 1, entity: batch.entity, code: r.code, sourceRecordId: r.sourceRecordId ?? null, values: r.values, status: outcomes[i]!.status }));
  }
  async quarantined(ids: number[]) {
    return this.staged.filter((s) => ids.includes(s.id) && s.status === "quarantined");
  }
  async settle(id: number, o: { status: string }) {
    this.staged.find((s) => s.id === id)!.status = o.status;
  }
}

const planner = { role: "planner", actor: "u1", source: "upload", integrationId: null };
const wo = (code: string | null, values: Row): InboundRecord => ({ code, values });

describe("ingest pipeline", () => {
  it("applies good records, leaves identical ones unchanged and quarantines the rest with their reasons", async () => {
    const store = new MemoryStore();
    const out = await ingest(
      "work_order",
      [
        wo("WO-1", { site: "SP-01", asset: "AST-1", description: "Fan", sla_hours: 4, status: "OPEN", source_record: "EAM" }), // same as stored
        wo("WO-1b", { site: "SP-01", asset: "AST-1", status: "OPEN", source_record: "EAM" }), // new
        wo("WO-2", { site: "SP-99", asset: "AST-1", source_record: "EAM" }), // unknown site
        wo("WO-3", { site: "SP-01", source_record: "EAM" }), // DQ-002: asset missing
        wo("WO-4", { site: "SP-01", asset: "AST-1", status: "PARKED", source_record: "EAM" }), // outside vocabulary
        wo("WO-5", { site: "SP-01", asset: "AST-1", estimated_cost: 1250.5, source_record: "EAM" }), // float amount
        wo("WO-1b", { site: "SP-02", asset: "AST-1", source_record: "EAM" }), // DQ-003 duplicate in delivery
        wo("WO-6", { site: "SP-01", asset: "AST-1" }), // DQ-008 lineage: warn only
      ],
      { model: CHANGE_MODEL, rules: RULES, role: "planner", store, newId },
    );
    expect(out.map((o) => o.status)).toEqual(["unchanged", "applied", "quarantined", "quarantined", "quarantined", "quarantined", "quarantined", "applied"]);
    expect(out[2]!.issues[0]).toMatchObject({ rule: "REF", message: 'Plant ID "SP-99" does not exist' });
    expect(out[3]!.issues[0]).toMatchObject({ rule: "DQ-002", field: "asset" });
    expect(out[4]!.issues[0]!.message).toMatch(/PARKED.*vocabulary/);
    expect(out[5]!.issues[0]!.message).toMatch(/decimal strings/);
    expect(out[6]!.issues.map((i) => i.rule)).toContain("DQ-003");
    expect(out[7]!.issues).toEqual([expect.objectContaining({ rule: "DQ-008", severity: "warn" })]);
    expect(store.sets).toHaveLength(1);
    expect(store.sets[0]!.source).toBe("import");
    expect(store.sets[0]!.items.map((i) => [i.op, i.code])).toEqual([["insert", "WO-1b"], ["insert", "WO-6"]]);
  });

  it("writes only the fields that differ, at the stored version", async () => {
    const store = new MemoryStore();
    await ingest("work_order", [wo("WO-1", { site: "SP-01", asset: "AST-1", sla_hours: 8, source_record: "EAM" })], { model: CHANGE_MODEL, rules: RULES, role: "planner", store, newId });
    expect(store.sets[0]!.items[0]).toEqual({ entity: "work_order", op: "update", code: "WO-1", baseVersion: 3, values: { sla_hours: 8 } });
  });

  it("isolates a record the database refuses, so the rest of its change set still loads", async () => {
    const store = new MemoryStore();
    store.refuse.add("WO-8");
    const out = await ingest("work_order", ["WO-7", "WO-8", "WO-9"].map((c) => wo(c, { site: "SP-01", asset: "AST-1", source_record: "EAM" })), { model: CHANGE_MODEL, rules: RULES, role: "planner", store, newId });
    expect(out.map((o) => o.status)).toEqual(["applied", "quarantined", "applied"]);
    expect(out[1]!.issues[0]).toMatchObject({ rule: "APPLY" });
    expect(store.sets.map((s) => s.items.length)).toEqual([1, 1]);
  });

  it("lets only the series' writers load time series, and keeps integrations to their scope", async () => {
    const store = new MemoryStore();
    const reading = [{ code: "2026-10-06 12:00 | SP-01", values: { at: "2026-10-06T12:00:00", site: "SP-01", actual_ac_mw: "42.5", data_provenance: "SCADA" } }];
    await expect(ingest("plant_telemetry", reading, { model: CHANGE_MODEL, rules: RULES, role: "planner", store, newId })).rejects.toMatchObject({ status: 403 });
    const out = await ingest("plant_telemetry", reading, { model: CHANGE_MODEL, rules: RULES, role: "admin", store, newId });
    expect(out[0]!.status).toBe("applied");
    await expect(ingest("work_order", [wo("WO-X", {})], { model: CHANGE_MODEL, rules: RULES, role: "admin", store, newId, entities: ["plant_telemetry"] })).rejects.toMatchObject({ code: "out_of_scope" });
    await expect(ingest("tenants", [wo("x", {})], { model: CHANGE_MODEL, rules: RULES, role: "admin", store, newId })).rejects.toMatchObject({ status: 422 });
  });
});

describe("deliveries, quarantine and replay", () => {
  it("records every record in the ledger, and maps workbook sheets through their spec", async () => {
    const store = new MemoryStore();
    const ledger = new MemoryLedger();
    const r = await deliver({ entity: "work_order", records: [wo("WO-20", { site: "SP-01", asset: "AST-1", source_record: "EAM" }), wo("WO-21", { site: "SP-99", asset: "AST-1" })] }, planner, CHANGE_MODEL, store, ledger, newId);
    expect(r).toMatchObject({ entity: "work_order", total: 2, applied: 1, quarantined: 1 });
    expect(ledger.staged.map((s) => s.status)).toEqual(["applied", "quarantined"]);
    const sheet = await deliver({ sheet: "Work Orders", rows: [{ Work_Order_ID: "WO-30", Plant_ID: "SP-01", Asset_ID: "AST-1", Priority: "Whenever", Status: "Open" }] }, planner, CHANGE_MODEL, store, ledger, newId);
    expect(sheet).toMatchObject({ entity: "work_order", quarantined: 1, issues: [expect.objectContaining({ rule: "VOCAB" })] });
    await expect(deliver({ sheet: "Sites", rows: [{ Plant_ID: "X" }] }, planner, CHANGE_MODEL, store, ledger, newId)).rejects.toMatchObject({ status: 422 });
    await expect(deliver({ entity: "work_order", records: [] }, planner, CHANGE_MODEL, store, ledger, newId)).rejects.toMatchObject({ status: 400 });
  });

  it("replays quarantined records once their master exists, and discards on request", async () => {
    const store = new MemoryStore();
    const ledger = new MemoryLedger();
    await deliver({ entity: "work_order", records: [wo("WO-40", { site: "SP-03", asset: "AST-1", source_record: "EAM" }), wo("WO-41", { site: "SP-04", asset: "AST-1", source_record: "EAM" })] }, planner, CHANGE_MODEL, store, ledger, newId);
    store.rows.site!.push({ code: "SP-03" });
    expect(await replay([1, 2], planner, CHANGE_MODEL, store, ledger, newId)).toEqual({ applied: 1, unchanged: 0, quarantined: 1, missing: 0 });
    expect(ledger.staged.map((s) => s.status)).toEqual(["applied", "quarantined"]);
    expect(await discard([1, 2], ledger)).toEqual({ discarded: 1, missing: 1 });
    expect(ledger.staged[1]!.status).toBe("discarded");
  });
});

describe("integrations", () => {
  const dir = (found: Integration | null): IntegrationDirectory & { created: unknown[] } => {
    const created: unknown[] = [];
    return {
      created,
      byHash: async (h) => (found && h === hashKey(KEY) ? found : null),
      create: async (tenantId, _by, v, keyHash) => (created.push({ v, keyHash }), { id: "i1", tenantId, name: v.name, actor: "a1", role: v.role, entities: v.entities }),
    };
  };
  const KEY = newKey();
  const headers = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });

  it("creates keys that are shown once and stored only as a hash, by administrators only", async () => {
    expect(KEY).toMatch(KEY_PATTERN);
    const admin: Membership = { tenantId: "t", role: "admin", createdAt: "" };
    const d = dir(null);
    const r = await createIntegration({ name: "EAM Connector", role: "planner", entities: ["work_order"] }, admin, "u", d);
    expect(r.key).toMatch(KEY_PATTERN);
    expect(d.created[0]).toMatchObject({ keyHash: hashKey(r.key) });
    expect(JSON.stringify(d.created)).not.toContain(r.key);
    await expect(createIntegration({ name: "X" }, { ...admin, role: "planner" }, "u", d)).rejects.toMatchObject({ status: 403 });
    await expect(createIntegration({ name: "<bad>" }, admin, "u", d)).rejects.toMatchObject({ status: 400 });
  });

  it("authenticates a delivery by its key, and refuses an unknown or disabled one", async () => {
    const found: Integration = { id: "i1", tenantId: "t", name: "EAM", actor: "a1", role: "planner", entities: [] };
    expect(await authenticate(headers({ authorization: `Bearer ${KEY}` }), dir(found))).toEqual(found);
    await expect(authenticate(headers({ authorization: `Bearer ${newKey()}` }), dir(found))).rejects.toMatchObject({ status: 401 });
    expect(await authenticate(headers({}), dir(found))).toBeNull();
    expect(bearerKey(headers({ authorization: "Bearer not-a-key" }))).toBeNull();
  });

  it("exempts only key-carrying deliveries from the same-origin rule, and still needs a writable license", async () => {
    const verdict = async () => ({ state: "valid", access: "full", reason: "ok" }) as never;
    const ingestReq = (h: Record<string, string>) => guardRequest({ pathname: "/api/aip/ingest", method: "POST", headers: headers(h), host: "aip.example.com" }, { verdict });
    expect(await ingestReq({ authorization: `Bearer ${KEY}` })).toBeNull();
    expect((await ingestReq({}))?.status).toBe(403);
    const other = await guardRequest({ pathname: "/api/aip/changes", method: "POST", headers: headers({ authorization: `Bearer ${KEY}` }), host: "aip.example.com" }, { verdict });
    expect(other?.status).toBe(403);
    const readOnly = await guardRequest({ pathname: "/api/aip/ingest", method: "POST", headers: headers({ authorization: `Bearer ${KEY}` }), host: "aip.example.com" }, { verdict: async () => ({ state: "grace", access: "read_only", reason: "grace" }) as never });
    expect(readOnly?.status).toBe(402);
    expect(requirementFor("/api/aip/grid/data-quarantine/actions/replay", "POST")).toBe("writable");
    expect(requirementFor("/api/aip/integrations", "POST")).toBe("writable");
  });
});
