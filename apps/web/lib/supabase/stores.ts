import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClockRecord, ClockStore } from "../license";
import type { AuditEntry, AuditSink, StateMeta, StateRepo, StoredState } from "../state/service";
import type { Membership, MembershipSource } from "../tenant";
import { isRole } from "../tenant";

/** Supabase-backed implementations of the small persistence interfaces used by the API. */

type AipClient = SupabaseClient<any, "aip", "aip">;

export class SupabaseClockStore implements ClockStore {
  constructor(private readonly db: AipClient) {}

  async read(lid: string): Promise<ClockRecord | null> {
    const { data, error } = await this.db.from("license_clock").select("lid, first_seen, last_seen, verdict").eq("lid", lid).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return { lid: data.lid, firstSeen: Number(data.first_seen), lastSeen: Number(data.last_seen), verdict: String(data.verdict) };
  }

  async write(r: ClockRecord): Promise<void> {
    const { error } = await this.db.from("license_clock").upsert(
      { lid: r.lid, first_seen: r.firstSeen, last_seen: r.lastSeen, verdict: r.verdict, updated_at: new Date().toISOString() },
      { onConflict: "lid" },
    );
    if (error) throw new Error(error.message);
  }
}

export class SupabaseMembershipSource implements MembershipSource {
  constructor(private readonly db: AipClient) {}

  async membershipsOf(userId: string): Promise<Membership[]> {
    const { data, error } = await this.db.from("tenant_members").select("tenant_id, role, created_at").eq("user_id", userId);
    if (error) throw new Error(error.message);
    return (data ?? [])
      .filter((r) => isRole(r.role))
      .map((r) => ({ tenantId: String(r.tenant_id), role: r.role, createdAt: String(r.created_at) }));
  }
}

/** Row-level security is enforced because this repo is always built on the user-scoped client. */
export class SupabaseStateRepo implements StateRepo {
  constructor(private readonly db: AipClient) {}

  async read(tenantId: string): Promise<StoredState | null> {
    const { data, error } = await this.db.from("runtime_state").select("payload, bytes, sha256").eq("tenant_id", tenantId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return { payloadHex: String(data.payload), bytes: Number(data.bytes), sha256: String(data.sha256) };
  }

  async meta(tenantId: string): Promise<StateMeta | null> {
    const { data, error } = await this.db.from("runtime_state").select("bytes, sha256").eq("tenant_id", tenantId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? { bytes: Number(data.bytes), sha256: String(data.sha256) } : null;
  }

  async write(tenantId: string, row: StoredState, userId: string): Promise<void> {
    const { error } = await this.db.from("runtime_state").upsert(
      { tenant_id: tenantId, payload: row.payloadHex, bytes: row.bytes, sha256: row.sha256, updated_by: userId, updated_at: new Date().toISOString() },
      { onConflict: "tenant_id" },
    );
    if (error) throw new Error(error.message);
  }

  async remove(tenantId: string): Promise<void> {
    const { error } = await this.db.from("runtime_state").delete().eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
  }
}

export class SupabaseAuditSink implements AuditSink {
  constructor(private readonly db: AipClient) {}

  async append(e: AuditEntry): Promise<void> {
    const { error } = await this.db.from("audit_log").insert({
      tenant_id: e.tenantId,
      actor: e.actor,
      action: e.action,
      entity: e.entity,
      entity_key: e.entityKey,
      before: e.before,
      after: e.after,
    });
    if (error) throw new Error(error.message);
  }
}
