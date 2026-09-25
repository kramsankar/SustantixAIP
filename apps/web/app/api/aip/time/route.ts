import { json } from "@/lib/http";
import { epochSeconds } from "@/lib/license";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Server clock — the runtime's trusted time source on this host. */
export async function GET(): Promise<Response> {
  return json({ now: epochSeconds() });
}
