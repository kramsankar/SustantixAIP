import { hostnameOf } from "@/lib/host";
import { errorResponse, json } from "@/lib/http";
import { currentHost, guard, serverLicenseVerdict } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const refresh = new URL(req.url).searchParams.get("refresh") === "1";
    return json(await serverLicenseVerdict(hostnameOf(currentHost(req)!), refresh));
  } catch (err) {
    return errorResponse(err);
  }
}
