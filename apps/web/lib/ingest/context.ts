import { randomUUID } from "node:crypto";
import { requestContext } from "../analytics/context";
import { adminClient } from "../supabase/admin";
import { authenticate, SupabaseIntegrationDirectory } from "./integrations";
import type { Deliverer } from "./service";
import { SupabaseIngestStore, SupabaseStaging } from "./store";

/**
 * Who delivers: an integration (its key verified; the service client, scoped to its tenant and acting as its member)
 * or a signed-in person (their own client, under row-level security).
 */
export async function deliveryContext(headers: { get(name: string): string | null }) {
  const integration = await authenticate(headers, new SupabaseIntegrationDirectory(adminClient()));
  if (integration) {
    const db = adminClient();
    const who: Deliverer = { role: integration.role, actor: integration.actor, source: integration.name, integrationId: integration.id, entities: integration.entities };
    return { tenantId: integration.tenantId, who, store: new SupabaseIngestStore(db, integration.tenantId, integration.actor), ledger: new SupabaseStaging(db, integration.tenantId), newId: randomUUID };
  }
  const { userId, membership, db } = await requestContext();
  const who: Deliverer = { role: membership.role, actor: userId, source: "upload", integrationId: null };
  return { tenantId: membership.tenantId, who, store: new SupabaseIngestStore(db, membership.tenantId), ledger: new SupabaseStaging(db, membership.tenantId), newId: randomUUID };
}
