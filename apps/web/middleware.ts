import { NextResponse, type NextRequest } from "next/server";
import { guardRequest } from "./lib/gate";
import { currentHost, serverLicenseVerdict } from "./lib/server";

/**
 * API gate: same-origin check on state-changing calls, then the server license verdict.
 * Every /api/aip/* endpoint except license, time, session and sign-out answers 402 when
 * access is `none`; writes to /state additionally need access `full`.
 * Runs on the Node.js runtime because the verdict needs WebCrypto RSA + the service-role client.
 */
export async function middleware(req: NextRequest): Promise<Response> {
  const denied = await guardRequest(
    { pathname: req.nextUrl.pathname, method: req.method, headers: req.headers, host: currentHost(req) },
    { verdict: (hostname) => serverLicenseVerdict(hostname) },
  );
  return denied ?? NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
  runtime: "nodejs",
};
