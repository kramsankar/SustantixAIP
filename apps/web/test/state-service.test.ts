import { describe, expect, it } from "vitest";
import { ApiError } from "../lib/http";
import { fromByteaHex, gunzip, sha256Hex } from "../lib/state/codec";
import {
  clearState,
  loadState,
  MAX_STATE_BYTES,
  saveState,
  type AuditEntry,
  type AuditSink,
  type StateContext,
  type StateMeta,
  type StateRepo,
  type StoredState,
} from "../lib/state/service";
import type { Role } from "../lib/tenant";

const TENANT = "11111111-1111-4111-8111-111111111111";

class MemoryRepo implements StateRepo {
  rows = new Map<string, StoredState>();
  async read(t: string) {
    return this.rows.get(t) ?? null;
  }
  async meta(t: string): Promise<StateMeta | null> {
    const r = this.rows.get(t);
    return r ? { bytes: r.bytes, sha256: r.sha256 } : null;
  }
  async write(t: string, row: StoredState) {
    this.rows.set(t, row);
  }
  async remove(t: string) {
    this.rows.delete(t);
  }
}

class MemoryAudit implements AuditSink {
  entries: AuditEntry[] = [];
  fail = false;
  async append(e: AuditEntry) {
    if (this.fail) throw new Error("audit down");
    this.entries.push(e);
  }
}

function ctx(role: Role = "admin", repo = new MemoryRepo(), audit = new MemoryAudit()) {
  const logs: unknown[] = [];
  const c: StateContext = {
    userId: "user-1",
    membership: { tenantId: TENANT, role, createdAt: "2026-01-01T00:00:00Z" },
    repo,
    audit,
    log: (...a) => logs.push(a),
  };
  return { c, repo, audit, logs };
}

const state = { data: { Assets: [{ id: "A1", secret: "confidential-value" }] }, lastImport: null, mode: "Uploaded data" };
const body = (v: unknown) => Buffer.from(JSON.stringify(v));

describe("runtime state service", () => {
  it("stores gzip bytea with size and hash, and reads it back", async () => {
    const { c, repo } = ctx();
    const meta = await saveState(c, body(state));
    const row = repo.rows.get(TENANT)!;
    expect(row.payloadHex.startsWith("\\x1f8b")).toBe(true);
    const json = await gunzip(fromByteaHex(row.payloadHex), MAX_STATE_BYTES);
    expect(JSON.parse(json.toString())).toEqual(state);
    expect(meta).toEqual({ bytes: json.byteLength, sha256: sha256Hex(json) });

    const loaded = await loadState(c);
    expect(JSON.parse(loaded!.json.toString())).toEqual(state);
    expect(loaded!.gz[0]).toBe(0x1f);
  });

  it("returns null when nothing is stored", async () => {
    expect(await loadState(ctx().c)).toBeNull();
  });

  it("audits save and clear with {bytes, sha256} only — never the payload", async () => {
    const { c, audit } = ctx();
    const first = await saveState(c, body(state));
    const second = await saveState(c, body({ ...state, mode: "Demo data" }));
    await clearState(c);
    expect(audit.entries.map((e) => e.action)).toEqual(["runtime_state.save", "runtime_state.save", "runtime_state.clear"]);
    expect(audit.entries[0]).toMatchObject({ tenantId: TENANT, actor: "user-1", entity: "runtime_state", before: null, after: first });
    expect(audit.entries[1]).toMatchObject({ before: first, after: second });
    expect(audit.entries[2]).toMatchObject({ before: second, after: null });
    expect(JSON.stringify(audit.entries)).not.toContain("confidential-value");
    for (const e of audit.entries) for (const side of [e.before, e.after]) if (side) expect(Object.keys(side).sort()).toEqual(["bytes", "sha256"]);
  });

  it("clears state", async () => {
    const { c, repo } = ctx();
    await saveState(c, body(state));
    await clearState(c);
    expect(repo.rows.size).toBe(0);
    expect(await loadState(c)).toBeNull();
  });

  for (const role of ["viewer", "planner"] as const) {
    it(`${role} can read but not write or clear`, async () => {
      const repo = new MemoryRepo();
      await saveState(ctx("admin", repo).c, body(state));
      const { c } = ctx(role, repo);
      expect(await loadState(c)).not.toBeNull();
      await expect(saveState(c, body(state))).rejects.toMatchObject({ status: 403 });
      await expect(clearState(c)).rejects.toMatchObject({ status: 403 });
    });
  }

  it("rejects invalid JSON and invalid shapes with 400", async () => {
    const { c, repo } = ctx();
    await expect(saveState(c, Buffer.from("{not json"))).rejects.toMatchObject({ status: 400, code: "invalid_json" });
    const err = await saveState(c, body({ data: { A: [1] }, mode: "x" })).catch((e: ApiError) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(400);
    expect((err as ApiError).extra.issues).toBeDefined();
    expect(repo.rows.size).toBe(0);
  });

  it("detects a corrupted stored payload", async () => {
    const { c, repo } = ctx();
    await saveState(c, body(state));
    const row = repo.rows.get(TENANT)!;
    repo.rows.set(TENANT, { ...row, sha256: "0".repeat(64) });
    await expect(loadState(c)).rejects.toMatchObject({ status: 500, code: "state_integrity" });
  });

  it("keeps the save when the audit append fails, and logs it", async () => {
    const { c, repo, audit, logs } = ctx();
    audit.fail = true;
    await saveState(c, body(state));
    expect(repo.rows.size).toBe(1);
    expect(JSON.stringify(logs)).toContain("audit append failed");
  });
});
