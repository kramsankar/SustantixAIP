import type { ChangeFeed } from "@sustantix/grid";
import { ApiError } from "../http";

/** The `since` a grid sends back: the cursor of the previous answer, an ISO 8601 instant, or nothing at first. */
export function parseSince(raw: string | null): string | null {
  if (raw === null || raw === "") return null;
  if (raw.length > 40 || !/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})$/.test(raw) || Number.isNaN(Date.parse(raw))) {
    throw new ApiError(400, "invalid_since", "since must be the cursor of a previous answer");
  }
  return raw;
}

interface FeedRpc {
  rpc(fn: "change_feed", args: { p_tenant: string; p_since: string | null }): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

/** The tenant's change feed, read as the signed-in member (the database decides membership). */
export async function readFeed(db: FeedRpc, tenantId: string, since: string | null): Promise<ChangeFeed> {
  const { data, error } = await db.rpc("change_feed", { p_tenant: tenantId, p_since: since });
  if (error) throw new Error(`change feed: ${error.message}`);
  const f = data as { cursor: string; items: ChangeFeed["items"]; truncated: boolean };
  return { cursor: new Date(f.cursor).toISOString(), items: f.items ?? [], truncated: !!f.truncated };
}
