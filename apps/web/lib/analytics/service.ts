import { MODEL_CARDS, buildDataset, runPortfolio, type ModelOutput, type ModelRun, type TenantSource } from "@sustantix/analytics";
import { z } from "zod";
import { ApiError } from "../http";
import type { Membership } from "../tenant";

/** Runs the AIP analytics engines for one tenant and records every run and its outputs. */

export const RunRequestSchema = z
  .object({
    models: z.array(z.enum(MODEL_CARDS.map((m) => m.code) as [string, ...string[]])).min(1).max(MODEL_CARDS.length).optional(),
    asOf: z.iso.datetime({ local: true }).optional(),
    horizonDays: z.number().int().min(1).max(365).optional(),
    gamma: z.number().min(0).max(10).optional(),
  })
  .strict();
export type RunRequest = z.infer<typeof RunRequestSchema>;

export interface RecordedRun {
  model: string;
  code: string;
  status: ModelRun["status"];
  outputs: number;
  message?: string;
}

/** Where runs and outputs are written (aip.model_run / aip.model_output through the caller's client). */
export interface ResultStore {
  recordRun(tenantId: string, run: ModelRun, meta: { code: string; asOf: string; params: Record<string, unknown>; userId: string }): Promise<string>;
  recordOutputs(tenantId: string, runId: string, outputs: ModelOutput[]): Promise<void>;
}

export interface AnalyticsContext {
  userId: string;
  membership: Membership;
  loadSource(): Promise<TenantSource>;
  store: ResultStore;
  now?: () => Date;
}

export const canRunAnalytics = (m: Membership) => m.role === "planner" || m.role === "admin";

export async function runAnalytics(ctx: AnalyticsContext, body: unknown): Promise<{ asOf: string; runs: RecordedRun[] }> {
  if (!canRunAnalytics(ctx.membership)) throw new ApiError(403, "forbidden", "running analytics requires the planner or admin role");
  const parsed = RunRequestSchema.safeParse(body ?? {});
  if (!parsed.success) throw new ApiError(400, "invalid_request", parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  const req = parsed.data;
  const now = (ctx.now ?? (() => new Date()))();
  const asOf = req.asOf ?? now.toISOString().slice(0, 19);
  const dataset = buildDataset(await ctx.loadSource(), asOf);
  const wanted = new Set(req.models ?? MODEL_CARDS.map((m) => m.code));
  const runs = runPortfolio(dataset, { horizonDays: req.horizonDays, gamma: req.gamma }).filter((r) => wanted.has(r.model));
  const stamp = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  const out: RecordedRun[] = [];
  for (const run of runs) {
    const code = `${run.model}/${stamp}`;
    const id = await ctx.store.recordRun(ctx.membership.tenantId, run, { code, asOf, params: { horizonDays: req.horizonDays ?? null, gamma: req.gamma ?? null }, userId: ctx.userId });
    if (run.status === "succeeded" && run.outputs.length) await ctx.store.recordOutputs(ctx.membership.tenantId, id, run.outputs);
    out.push({ model: run.model, code, status: run.status, outputs: run.outputs.length, ...(run.message ? { message: run.message } : {}) });
  }
  return { asOf, runs: out };
}

export const LatestQuerySchema = z
  .object({
    model: z.string().regex(/^AIP-[A-Z0-9-]+$/).optional(),
    measure: z.string().regex(/^[a-z][a-z0-9_]*$/).optional(),
    subject: z.string().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(5000).default(500),
  })
  .strict();
