import { z } from "zod";

/** Shape of the snapshot the AIP runtime persists (see host-bridge RuntimeState). */

/**
 * The runtime keeps more than workbook sheets under `data`: alongside the sheets (arrays of rows) it stores its own
 * configuration and derived datasets (version, navigation changes, synthetic platform data…) as plain JSON values.
 * Every entry must be JSON, under a non-empty name; the snapshot as a whole stays within MAX_STATE_BYTES.
 */
export const RuntimeStateSchema = z
  .object({
    data: z.record(z.string().min(1).max(256), z.json()),
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
