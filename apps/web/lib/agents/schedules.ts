import { AGENTS, runAgent, type DataPort, type LlmClient, type RunLog } from "@sustantix/agents";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ApiError } from "../http";
import type { Membership } from "../tenant";

type AipClient = SupabaseClient<any, "aip", "aip">;

/**
 * Scheduled agent runs. An administrator gives an agent a standing question and a cadence; the hourly worker runs
 * each due schedule as the schedule's own technical member (role planner), so a scheduled run reads the governed data
 * and can raise proposals for a person to approve, and nothing more.
 */

export const isTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const scheduleSchema = z
  .object({
    name: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,79}$/),
    agent: z.string().refine((a) => AGENTS.some((x) => x.id === a), "an agent from the catalogue"),
    prompt: z.string().trim().min(1).max(4000),
    cadence: z.enum(["hourly", "daily", "weekly"]),
    atHour: z.number().int().min(0).max(23).default(6),
    atWeekday: z.number().int().min(0).max(6).default(1),
    timeZone: z.string().max(64).refine(isTimeZone, "an IANA time zone, for example Asia/Kolkata or Europe/Berlin").default("UTC"),
  })
  .strict();
export type ScheduleInput = z.infer<typeof scheduleSchema>;

export interface ScheduleDirectory {
  create(tenantId: string, createdBy: string, v: ScheduleInput): Promise<{ id: string }>;
}

export async function createSchedule(body: unknown, m: Membership, userId: string, dir: ScheduleDirectory) {
  if (m.role !== "admin") throw new ApiError(403, "forbidden", "only administrators schedule agents");
  const v = scheduleSchema.safeParse(body);
  if (!v.success) throw new ApiError(400, "invalid_schedule", v.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  return { ...(await dir.create(m.tenantId, userId, v.data)), ...v.data };
}

export interface DueSchedule {
  id: string;
  tenant_id: string;
  name: string;
  agent: string;
  prompt: string;
  actor: string;
}

export interface ScheduleWorker {
  claim(): Promise<DueSchedule | null>;
  finish(id: string, status: "completed" | "failed" | "stopped", runId: string | null, message: string | null): Promise<void>;
  /** The data the run may read and the log it writes, for this tenant, as this schedule's member. */
  portFor(s: DueSchedule): { port: DataPort; log: RunLog };
  llm: LlmClient;
  model: string;
  now: () => number;
}

/** Scheduled runs are unattended: the reply is a record, and proposals wait for a person. */
export const SCHEDULED_CONTEXT = (name: string) =>
  `This is the scheduled run "${name}". Nobody is reading this conversation as it happens: answer in a short report, and put each recommended action into a proposal for a person to approve.`;

/** Runs due schedules one by one until none is due or the time budget is spent. */
export async function runDueSchedules(w: ScheduleWorker, budgetMs = 200_000): Promise<{ ran: number; failed: number; results: Array<{ schedule: string; status: string; proposals: number }> }> {
  const start = w.now();
  const results: Array<{ schedule: string; status: string; proposals: number }> = [];
  let failed = 0;
  while (w.now() - start < budgetMs) {
    const s = await w.claim();
    if (!s) break;
    const { port, log } = w.portFor(s);
    try {
      const r = await runAgent(
        { agentId: s.agent, role: "planner", messages: [{ role: "user", content: `${SCHEDULED_CONTEXT(s.name)}\n\n${s.prompt}` }], asOf: new Date(w.now()).toISOString().slice(0, 10) },
        { llm: w.llm, model: w.model, port, log },
      );
      await w.finish(s.id, r.status, r.runId, r.proposals.length ? `raised ${r.proposals.length} proposal${r.proposals.length === 1 ? "" : "s"}: ${r.proposals.join(", ")}` : "no proposals");
      if (r.status === "failed") failed++;
      results.push({ schedule: s.name, status: r.status, proposals: r.proposals.length });
    } catch (e) {
      failed++;
      await w.finish(s.id, "failed", null, e instanceof Error ? e.message : "run failed");
      results.push({ schedule: s.name, status: "failed", proposals: 0 });
    }
  }
  return { ran: results.length, failed, results };
}

/** Creates a schedule with its technical member: the only place a schedule identity is made. */
export class SupabaseScheduleDirectory implements ScheduleDirectory {
  constructor(private readonly admin: AipClient) {}

  async create(tenantId: string, createdBy: string, v: ScheduleInput): Promise<{ id: string }> {
    const tag = randomBytes(8).toString("hex");
    const user = await this.admin.auth.admin.createUser({ email: `schedule-${tag}@integrations.sustantix.invalid`, email_confirm: true, user_metadata: { full_name: `Scheduled agent: ${v.name}`, schedule: true } });
    if (user.error || !user.data.user) throw new Error(`schedule member: ${user.error?.message ?? "not created"}`);
    const actor = user.data.user.id;
    const member = await this.admin.from("tenant_members").insert({ tenant_id: tenantId, user_id: actor, role: "planner" });
    if (member.error) throw new Error(`schedule member: ${member.error.message}`);
    const { data, error } = await this.admin
      .from("agent_schedule")
      .insert({ tenant_id: tenantId, name: v.name, agent: v.agent, prompt: v.prompt, cadence: v.cadence, at_hour: v.atHour, at_weekday: v.atWeekday, time_zone: v.timeZone, actor, created_by: createdBy })
      .select("id")
      .single();
    if (error) {
      await this.admin.auth.admin.deleteUser(actor).catch(() => undefined);
      if (error.code === "23505") throw new ApiError(409, "duplicate", `a schedule named ${v.name} exists`);
      throw new Error(`schedule: ${error.message}`);
    }
    return { id: String(data.id) };
  }
}
