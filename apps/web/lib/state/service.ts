import { ApiError, parseJson } from "../http";
import { canRead, canWrite, type Membership } from "../tenant";
import { fromByteaHex, gunzip, gzip, sha256Hex, toByteaHex } from "./codec";
import { validateRuntimeState } from "./schema";

/** Tenant runtime-state persistence: validation, compression, integrity and audit. */

export const MAX_STATE_BYTES = 50 * 1024 * 1024;

export interface StateMeta {
  /** Size of the canonical JSON document (uncompressed). */
  bytes: number;
  /** SHA-256 (hex) of the canonical JSON document. */
  sha256: string;
}

export interface StoredState extends StateMeta {
  /** gzip(JSON) as a Postgres bytea hex literal. */
  payloadHex: string;
}

export interface StateRepo {
  read(tenantId: string): Promise<StoredState | null>;
  meta(tenantId: string): Promise<StateMeta | null>;
  write(tenantId: string, row: StoredState, userId: string): Promise<void>;
  remove(tenantId: string): Promise<void>;
}

export type AuditAction = "runtime_state.save" | "runtime_state.clear";

export interface AuditEntry {
  tenantId: string;
  actor: string;
  action: AuditAction;
  entity: "runtime_state";
  entityKey: string;
  before: StateMeta | null;
  after: StateMeta | null;
}

export interface AuditSink {
  append(entry: AuditEntry): Promise<void>;
}

export interface StateContext {
  userId: string;
  membership: Membership;
  repo: StateRepo;
  audit: AuditSink;
  log?: (message: string, detail?: unknown) => void;
}

export interface LoadedState {
  json: Buffer;
  gz: Buffer;
  meta: StateMeta;
}

export async function loadState(ctx: StateContext): Promise<LoadedState | null> {
  if (!canRead(ctx.membership)) throw new ApiError(403, "forbidden", "no read access to this tenant");
  const row = await ctx.repo.read(ctx.membership.tenantId);
  if (!row) return null;
  const gz = fromByteaHex(row.payloadHex);
  const json = await gunzip(gz, MAX_STATE_BYTES);
  if (json.byteLength !== row.bytes || sha256Hex(json) !== row.sha256) {
    throw new ApiError(500, "state_integrity", "stored runtime state failed its integrity check");
  }
  return { json, gz, meta: { bytes: row.bytes, sha256: row.sha256 } };
}

/** Encodes a validated state document into its stored form. */
export async function encodeState(value: unknown): Promise<StoredState> {
  const json = Buffer.from(JSON.stringify(value), "utf8");
  if (json.byteLength > MAX_STATE_BYTES) {
    throw new ApiError(413, "payload_too_large", `runtime state exceeds ${MAX_STATE_BYTES} bytes`, { limit: MAX_STATE_BYTES });
  }
  const gz = await gzip(json);
  return { payloadHex: toByteaHex(gz), bytes: json.byteLength, sha256: sha256Hex(json) };
}

export async function saveState(ctx: StateContext, body: Buffer): Promise<StateMeta> {
  if (!canWrite(ctx.membership)) throw new ApiError(403, "forbidden", "saving runtime state requires the admin role");
  const checked = validateRuntimeState(parseJson(body));
  if (!checked.ok) throw new ApiError(400, "invalid_state", "runtime state failed validation", { issues: checked.issues });

  const tenantId = ctx.membership.tenantId;
  const before = await ctx.repo.meta(tenantId);
  const row = await encodeState(checked.value);
  await ctx.repo.write(tenantId, row, ctx.userId);
  const after = { bytes: row.bytes, sha256: row.sha256 };
  await appendAudit(ctx, { action: "runtime_state.save", before, after });
  return after;
}

export async function clearState(ctx: StateContext): Promise<void> {
  if (!canWrite(ctx.membership)) throw new ApiError(403, "forbidden", "clearing runtime state requires the admin role");
  const tenantId = ctx.membership.tenantId;
  const before = await ctx.repo.meta(tenantId);
  await ctx.repo.remove(tenantId);
  await appendAudit(ctx, { action: "runtime_state.clear", before, after: null });
}

async function appendAudit(ctx: StateContext, e: Pick<AuditEntry, "action" | "before" | "after">): Promise<void> {
  const entry: AuditEntry = {
    tenantId: ctx.membership.tenantId,
    actor: ctx.userId,
    entity: "runtime_state",
    entityKey: ctx.membership.tenantId,
    ...e,
  };
  try {
    await ctx.audit.append(entry);
  } catch (err) {
    // The state change has already committed; surface the gap loudly in logs rather than
    // report a failed save that actually succeeded.
    (ctx.log ?? console.error)("[aip-web] audit append failed", {
      action: entry.action,
      tenantId: entry.tenantId,
      actor: entry.actor,
      error: (err as Error).message,
    });
  }
}
