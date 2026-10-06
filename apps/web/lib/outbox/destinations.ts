import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ApiError } from "../http";
import type { Membership } from "../tenant";
import { allowedUrl } from "./deliver";

/** Destinations an administrator subscribes to events; the signing secret is returned once, at creation. */
export const destinationSchema = z
  .object({
    name: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,79}$/),
    url: z.string().max(500).refine((u) => allowedUrl(u) !== null, "an https URL on a public host"),
    events: z.array(z.enum(["change", "proposal"])).min(1).max(2).default(["change", "proposal"]),
    entities: z.array(z.string().regex(/^[a-z][a-z0-9_]{0,62}$/)).max(100).default([]),
  })
  .strict();

export interface DestinationStore {
  create(tenantId: string, createdBy: string, v: z.infer<typeof destinationSchema>, secret: string): Promise<{ id: string }>;
}

export async function createDestination(body: unknown, m: Membership, userId: string, store: DestinationStore) {
  if (m.role !== "admin") throw new ApiError(403, "forbidden", "only administrators manage outbound destinations");
  const v = destinationSchema.safeParse(body);
  if (!v.success) throw new ApiError(400, "invalid_destination", v.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  const secret = randomBytes(32).toString("base64url");
  const { id } = await store.create(m.tenantId, userId, v.data, secret);
  return { id, ...v.data, secret };
}
