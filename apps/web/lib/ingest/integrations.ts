import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ApiError } from "../http";
import type { Membership } from "../tenant";

type AipClient = SupabaseClient<any, "aip", "aip">;

/**
 * Integrations: a source system (ERP/EAM, SCADA, a weather service) that delivers data with a key. Only the key's
 * SHA-256 is stored; the key is shown once, when it is created. Each integration acts as its own technical member of
 * the tenant (no password, an unroutable address, so it can never sign in), which gives it a role, an audit identity
 * and the same change-set rules as a person.
 */

export const KEY_PATTERN = /^sxi_[0-9a-f]{32}_[A-Za-z0-9_-]{43}$/;
export const hashKey = (key: string) => createHash("sha256").update(key, "utf8").digest("hex");
export const newKey = () => `sxi_${randomBytes(16).toString("hex")}_${randomBytes(32).toString("base64url")}`;

/** The key in an Authorization header, or null when the request is not an integration's. */
export function bearerKey(headers: { get(name: string): string | null }): string | null {
  const h = headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)$/i.exec(h.trim());
  return m && KEY_PATTERN.test(m[1]!) ? m[1]! : null;
}

export interface Integration {
  id: string;
  tenantId: string;
  name: string;
  actor: string;
  role: string;
  entities: string[];
}

export interface IntegrationDirectory {
  byHash(hash: string): Promise<Integration | null>;
  create(tenantId: string, createdBy: string, v: { name: string; role: "planner" | "admin"; entities: string[] }, keyHash: string): Promise<Integration>;
}

export async function authenticate(headers: { get(name: string): string | null }, dir: IntegrationDirectory): Promise<Integration | null> {
  const key = bearerKey(headers);
  if (!key) return null;
  const found = await dir.byHash(hashKey(key));
  if (!found) throw new ApiError(401, "invalid_key", "the integration key is not valid or the integration is disabled");
  return found;
}

const createSchema = z
  .object({
    name: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,79}$/),
    role: z.enum(["planner", "admin"]).default("planner"),
    entities: z.array(z.string().regex(/^[a-z][a-z0-9_]{0,62}$/)).max(100).default([]),
  })
  .strict();

/** Creates an integration (administrators only) and returns its key, which is never shown again. */
export async function createIntegration(body: unknown, m: Membership, userId: string, dir: IntegrationDirectory) {
  if (m.role !== "admin") throw new ApiError(403, "forbidden", "only administrators create integrations");
  const v = createSchema.safeParse(body);
  if (!v.success) throw new ApiError(400, "invalid_integration", v.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  const key = newKey();
  const created = await dir.create(m.tenantId, userId, { name: v.data.name, role: v.data.role, entities: v.data.entities }, hashKey(key));
  return { ...created, key };
}

/** Service-side directory: the only place the service client touches integrations. */
export class SupabaseIntegrationDirectory implements IntegrationDirectory {
  constructor(private readonly admin: AipClient) {}

  async byHash(hash: string): Promise<Integration | null> {
    const { data, error } = await this.admin.from("integration").select("id, tenant_id, name, actor, entities, enabled").eq("key_hash", hash).maybeSingle();
    if (error) throw new Error(`integration: ${error.message}`);
    if (!data || !data.enabled) return null;
    const member = await this.admin.from("tenant_members").select("role").eq("tenant_id", data.tenant_id).eq("user_id", data.actor).maybeSingle();
    if (member.error) throw new Error(`integration member: ${member.error.message}`);
    if (!member.data) return null;
    return { id: data.id, tenantId: data.tenant_id, name: data.name, actor: data.actor, role: member.data.role, entities: data.entities ?? [] };
  }

  async create(tenantId: string, createdBy: string, v: { name: string; role: "planner" | "admin"; entities: string[] }, keyHash: string): Promise<Integration> {
    const tag = randomBytes(8).toString("hex");
    const user = await this.admin.auth.admin.createUser({ email: `integration-${tag}@integrations.sustantix.invalid`, email_confirm: true, user_metadata: { full_name: `Integration: ${v.name}`, integration: true } });
    if (user.error || !user.data.user) throw new Error(`integration member: ${user.error?.message ?? "not created"}`);
    const actor = user.data.user.id;
    const member = await this.admin.from("tenant_members").insert({ tenant_id: tenantId, user_id: actor, role: v.role });
    if (member.error) throw new Error(`integration member: ${member.error.message}`);
    const { data, error } = await this.admin.from("integration").insert({ tenant_id: tenantId, name: v.name, actor, key_hash: keyHash, entities: v.entities, created_by: createdBy }).select("id").single();
    if (error) {
      if (error.code === "23505") throw new ApiError(409, "duplicate", `an integration named ${v.name} exists`);
      throw new Error(`integration: ${error.message}`);
    }
    return { id: data.id, tenantId, name: v.name, actor, role: v.role, entities: v.entities };
  }
}
