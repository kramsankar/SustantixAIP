import { AnthropicClient } from "@sustantix/agents";
import { requireCron, requireCronLicense } from "@/lib/cron";
import { serverEnv } from "@/lib/env";
import { ApiError, errorResponse, json } from "@/lib/http";
import { SupabaseDataPort, SupabaseRunLog } from "@/lib/agents/port";
import { runDueSchedules, type DueSchedule } from "@/lib/agents/schedules";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/aip/cron/agents — the scheduler's call: run every due agent schedule. Each run reads one tenant's governed
 * data (every port query is filtered to the schedule's tenant) as the schedule's technical member, and may only raise
 * proposals.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    requireCron(req);
    await requireCronLicense();
    const env = serverEnv();
    if (!env.ANTHROPIC_API_KEY) throw new ApiError(503, "agents_not_configured", "agents need ANTHROPIC_API_KEY on the server");
    const db = adminClient();
    return json(
      await runDueSchedules({
        async claim() {
          const { data, error } = await db.rpc("claim_agent_schedule");
          if (error) throw new Error(`claim: ${error.message}`);
          return ((data ?? []) as DueSchedule[])[0] ?? null;
        },
        async finish(id, status, runId, message) {
          const { error } = await db.rpc("finish_agent_schedule", { p_id: id, p_status: status, p_run: runId, p_message: message });
          if (error) throw new Error(`finish: ${error.message}`);
        },
        portFor: (s) => ({ port: new SupabaseDataPort(db, s.tenant_id, s.actor), log: new SupabaseRunLog(db, s.tenant_id, s.actor) }),
        llm: new AnthropicClient({ apiKey: env.ANTHROPIC_API_KEY }),
        model: env.AIP_AGENT_MODEL,
        now: Date.now,
      }),
    );
  } catch (err) {
    return errorResponse(err);
  }
}
