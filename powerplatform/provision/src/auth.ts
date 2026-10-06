import { ConfidentialClientApplication, PublicClientApplication } from "@azure/msal-node";

/**
 * Token sources, in order of precedence:
 *  1. PP_ACCESS_TOKEN               — e.g. `az account get-access-token --resource <envUrl> --query accessToken -o tsv`
 *  2. PP_TENANT_ID + PP_CLIENT_ID + PP_CLIENT_SECRET — service principal registered as a Dataverse application user
 *  3. PP_TENANT_ID + PP_CLIENT_ID   — device-code sign-in for an administrator (public client registration)
 */
export function tokenProvider(envUrl: string, env: NodeJS.ProcessEnv = process.env, log: (m: string) => void = console.log): () => Promise<string> {
  const scope = `${new URL(envUrl).origin}/.default`;
  if (env.PP_ACCESS_TOKEN) {
    const t = env.PP_ACCESS_TOKEN;
    return async () => t;
  }
  const tenant = env.PP_TENANT_ID;
  const clientId = env.PP_CLIENT_ID;
  if (!tenant || !clientId) throw new Error("set PP_ACCESS_TOKEN, or PP_TENANT_ID + PP_CLIENT_ID (+ PP_CLIENT_SECRET for a service principal)");
  const authority = `https://login.microsoftonline.com/${tenant}`;
  let cached: { token: string; exp: number } | undefined;
  const fresh = () => cached && cached.exp - 120_000 > Date.now();

  if (env.PP_CLIENT_SECRET) {
    const app = new ConfidentialClientApplication({ auth: { clientId, authority, clientSecret: env.PP_CLIENT_SECRET } });
    return async () => {
      if (fresh()) return cached!.token;
      const r = await app.acquireTokenByClientCredential({ scopes: [scope] });
      if (!r?.accessToken) throw new Error("client-credential token request returned no token");
      cached = { token: r.accessToken, exp: r.expiresOn?.getTime() ?? Date.now() + 3_000_000 };
      return cached.token;
    };
  }
  const app = new PublicClientApplication({ auth: { clientId, authority } });
  return async () => {
    if (fresh()) return cached!.token;
    const r = await app.acquireTokenByDeviceCode({ scopes: [scope], deviceCodeCallback: (c) => log(c.message) });
    if (!r?.accessToken) throw new Error("device-code sign-in returned no token");
    cached = { token: r.accessToken, exp: r.expiresOn?.getTime() ?? Date.now() + 3_000_000 };
    return cached.token;
  };
}
