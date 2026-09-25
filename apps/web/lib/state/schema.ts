import { z } from "zod";

/** Shape of the snapshot the v732 runtime persists (see host-bridge RuntimeState). */

const Row = z.record(z.string(), z.unknown()).refine((v) => v !== null && typeof v === "object" && !Array.isArray(v), {
  message: "row must be an object",
});

export const RuntimeStateSchema = z
  .object({
    data: z.record(z.string().min(1).max(256), z.array(Row)),
    mode: z.string().max(64),
    // The runtime stores null before the first import; JSON drops undefined.
    lastImport: z.json().optional().transform((v) => v ?? null),
  })
  .strict();

export type ValidRuntimeState = z.output<typeof RuntimeStateSchema>;

export function validateRuntimeState(input: unknown): { ok: true; value: ValidRuntimeState } | { ok: false; issues: string[] } {
  const r = RuntimeStateSchema.safeParse(input);
  if (r.success) return { ok: true, value: r.data };
  return {
    ok: false,
    issues: r.error.issues.slice(0, 10).map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`),
  };
}
