import { lookup } from "node:dns/promises";
import { requireCron, requireCronLicense } from "@/lib/cron";
import { errorResponse, json } from "@/lib/http";
import { deliverDue, type OutboxEvent } from "@/lib/outbox/deliver";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET /api/aip/cron/outbox — the scheduler's call: deliver every due outbox event (signed, leased, with back-off). */
export async function GET(req: Request): Promise<Response> {
  try {
    requireCron(req);
    await requireCronLicense();
    const db = adminClient();
    const result = await deliverDue({
      async claim(limit) {
        const { data, error } = await db.rpc("claim_outbox", { p_limit: limit });
        if (error) throw new Error(`claim: ${error.message}`);
        return (data ?? []) as OutboxEvent[];
      },
      async complete(id, ok, err) {
        const { error } = await db.rpc("complete_outbox", { p_id: id, p_ok: ok, p_error: err });
        if (error) throw new Error(`complete: ${error.message}`);
      },
      async destination(id) {
        const { data, error } = await db.from("outbox_destination").select("url, secret, enabled").eq("id", id).maybeSingle();
        if (error) throw new Error(`destination: ${error.message}`);
        return data;
      },
      resolve: async (host) => (await lookup(host, { all: true })).map((a) => a.address),
      fetch: (...a) => fetch(...a),
      now: Date.now,
    });
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
