import type { DataPort, LlmClient, LlmRequest, LlmResponse, RunLog } from "@sustantix/agents";
import { describe, expect, it } from "vitest";
import { requirementFor } from "../lib/gate";
import { createSchedule, isTimeZone, runDueSchedules, type DueSchedule, type ScheduleDirectory, type ScheduleWorker } from "../lib/agents/schedules";
import type { Membership } from "../lib/tenant";

const admin: Membership = { tenantId: "t", role: "admin", createdAt: "" };
const planner: Membership = { tenantId: "t", role: "planner", createdAt: "" };
const dir = (): ScheduleDirectory & { made: unknown[] } => {
  const made: unknown[] = [];
  return { made, create: async (tenant, by, v) => (made.push({ tenant, by, ...v }), { id: "s1" }) };
};
const valid = { name: "Morning risk review", agent: "planning-agent", prompt: "Which open work orders breach SLA today?", cadence: "daily", atHour: 6, timeZone: "Asia/Kolkata" };

describe("agent schedules", () => {
  it("are created by administrators, for catalogue agents, in a real time zone", async () => {
    const d = dir();
    expect(await createSchedule(valid, admin, "u1", d)).toMatchObject({ id: "s1", agent: "planning-agent", cadence: "daily", atHour: 6, atWeekday: 1, timeZone: "Asia/Kolkata" });
    expect(d.made).toEqual([expect.objectContaining({ tenant: "t", by: "u1", name: "Morning risk review" })]);
    expect(await createSchedule({ ...valid, timeZone: undefined, name: "Default zone" }, admin, "u1", d)).toMatchObject({ timeZone: "UTC" });
    await expect(createSchedule(valid, planner, "u2", dir())).rejects.toMatchObject({ status: 403 });
    for (const bad of [{ agent: "made-up-agent" }, { timeZone: "Mars/Olympus_Mons" }, { cadence: "every minute" }, { atHour: 24 }, { prompt: "" }, { actor: "someone-else" }])
      await expect(createSchedule({ ...valid, ...bad }, admin, "u1", dir()), JSON.stringify(bad)).rejects.toMatchObject({ status: 400, code: "invalid_schedule" });
    expect(isTimeZone("Europe/Berlin") && isTimeZone("America/Sao_Paulo") && !isTimeZone("India")).toBe(true);
  });

  it("are managed under the license gate as writes, and the worker route checks its own secret", () => {
    expect(requirementFor("/api/aip/agents/schedules", "POST")).toBe("writable");
    expect(requirementFor("/api/aip/agents/schedules/0b0c0d0e-0000-4000-8000-000000000001", "PATCH")).toBe("writable");
    expect(requirementFor("/api/aip/agents/schedules", "GET")).toBe("readable");
    expect(requirementFor("/api/aip/cron/agents", "GET")).toBe("open");
  });
});

describe("scheduled runs", () => {
  const due = (n: number): DueSchedule[] =>
    Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}`, tenant_id: i % 2 ? "tenant-b" : "tenant-a", name: `Schedule ${i + 1}`, agent: "planning-agent", prompt: `Question ${i + 1}`, actor: `member-${i + 1}` }));

  function worker(queue: DueSchedule[], llm: LlmClient, clock = { t: 0 }) {
    const finished: Array<{ id: string; status: string; runId: string | null; message: string | null }> = [];
    const ports: Array<{ tenant: string; actor: string }> = [];
    const port: DataPort = { queryView: async () => [], lineage: async () => [], latestOutputs: async () => [], latestRuns: async () => [], proposals: async () => [], createProposal: async () => ({ code: "PRP-1" }) };
    const w: ScheduleWorker = {
      claim: async () => queue.shift() ?? null,
      finish: async (id, status, runId, message) => void finished.push({ id, status, runId, message }),
      portFor: (s) => {
        ports.push({ tenant: s.tenant_id, actor: s.actor });
        const log: RunLog = { start: async () => `run-${s.id}`, step: async () => {}, finish: async () => {} };
        return { port, log };
      },
      llm,
      model: "claude-test",
      now: () => clock.t,
    };
    return { w, finished, ports };
  }

  it("runs each due schedule once, as its own member of its own tenant, and records the outcome", async () => {
    const asked: LlmRequest[] = [];
    const llm: LlmClient = { create: async (r): Promise<LlmResponse> => (asked.push(r), { content: [{ type: "text", text: "All clear." }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }) };
    const { w, finished, ports } = worker(due(3), llm);
    const r = await runDueSchedules(w);
    expect(r).toMatchObject({ ran: 3, failed: 0 });
    expect(ports).toEqual([
      { tenant: "tenant-a", actor: "member-1" },
      { tenant: "tenant-b", actor: "member-2" },
      { tenant: "tenant-a", actor: "member-3" },
    ]);
    expect(finished).toEqual([1, 2, 3].map((i) => ({ id: `s${i}`, status: "completed", runId: `run-s${i}`, message: "no proposals" })));
    // The standing question, framed as an unattended run that may only propose.
    const first = JSON.stringify(asked[0]!.messages);
    expect(first).toContain("Question 1");
    expect(first).toContain("proposal for a person to approve");
  });

  it("records a failure and carries on with the next schedule", async () => {
    let n = 0;
    const llm: LlmClient = {
      create: async (): Promise<LlmResponse> => {
        if (++n === 1) throw new Error("model overloaded");
        return { content: [{ type: "text", text: "Done." }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } };
      },
    };
    const { w, finished } = worker(due(2), llm);
    const r = await runDueSchedules(w);
    expect(r.ran).toBe(2);
    expect(finished[0]).toMatchObject({ id: "s1", status: "failed" });
    expect(finished[1]).toMatchObject({ id: "s2", status: "completed" });
  });

  it("stops claiming once its time budget is spent, leaving the rest for the next pass", async () => {
    const clock = { t: 0 };
    const llm: LlmClient = { create: async (): Promise<LlmResponse> => ((clock.t += 120_000), { content: [{ type: "text", text: "ok" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }) };
    const queue = due(5);
    const { w } = worker(queue, llm, clock);
    expect((await runDueSchedules(w, 200_000)).ran).toBe(2);
    expect(queue).toHaveLength(3);
  });
});
