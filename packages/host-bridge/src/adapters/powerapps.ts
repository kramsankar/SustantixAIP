import { getContext, type IContext } from "@microsoft/power-apps/app";
import { getClient, type DataClient } from "@microsoft/power-apps/data";
import type { LicenseStatus, RuntimeEnvironment } from "@sustantix/license";
import type { HostAdapter, Identity, RuntimeState } from "../types.js";

/** Dataverse artefacts provisioned by powerplatform/provision (see schema/aip-platform.json). */
export const STATE_TABLE = "sus_runtimestates";
export const STATE_KEY_COLUMN = "sus_name";
export const STATE_FILE_COLUMN = "sus_payload";
export const STATE_ID_COLUMN = "sus_runtimestateid";
export const STATE_ROW_NAME = "current";
export const LICENSE_API = "sus_GetLicenseStatus";

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

function unwrap<T>(r: { success: boolean; data?: T; error?: unknown }, what: string): T {
  if (!r.success) throw new Error(`${what} failed: ${r.error instanceof Error ? r.error.message : JSON.stringify(r.error)}`);
  return r.data as T;
}

/**
 * Power Apps code-app host. Identity comes from Entra ID via the Power Apps player;
 * the license verdict comes from the Sustantix plug-in (Custom API) running in Dataverse,
 * which also blocks data access server-side, so this adapter never self-authorises.
 */
export function powerAppsAdapter(dataSourcesInfo: Parameters<typeof getClient>[0]): HostAdapter {
  let ctx: IContext | undefined;
  let client: DataClient | undefined;
  const dc = () => {
    if (!client) client = getClient(dataSourcesInfo);
    return client;
  };

  async function stateRowId(): Promise<string | undefined> {
    const rows = unwrap(
      await dc().retrieveMultipleRecordsAsync<Record<string, string>>(STATE_TABLE, {
        select: [STATE_ID_COLUMN],
        filter: `${STATE_KEY_COLUMN} eq '${STATE_ROW_NAME}'`,
        top: 1,
      }),
      "read runtime state",
    );
    return rows?.[0]?.[STATE_ID_COLUMN];
  }

  return {
    name: "powerapps",
    async init() {
      ctx = await getContext();
    },
    async environment(): Promise<RuntimeEnvironment> {
      return { platform: "powerplatform", environmentId: ctx?.app.environmentId, tenantId: ctx?.user.tenantId };
    },
    async serverVerdict(refresh) {
      const r = await dc().executeAsync<unknown, { StatusJson?: string }>({
        dataverseRequest: { action: "customapi", parameters: { operationName: LICENSE_API, tableName: STATE_TABLE, body: { Refresh: !!refresh } } },
      });
      const out = unwrap(r, "license verdict");
      if (!out?.StatusJson) return null;
      return JSON.parse(out.StatusJson) as LicenseStatus;
    },
    async trustedNow() {
      return Math.floor(Date.now() / 1000);
    },
    async ssoIdentity(): Promise<Identity | null> {
      const u = ctx?.user;
      if (!u?.objectId) return null;
      return { displayName: u.fullName || u.userPrincipalName || "user", login: u.userPrincipalName || u.objectId };
    },
    async signIn() {
      // Entra ID has already authenticated the user inside Power Apps; no local credentials exist.
      return !!ctx?.user.objectId;
    },
    persistence: {
      async load(): Promise<RuntimeState | undefined> {
        const id = await stateRowId();
        if (!id) return undefined;
        const r = await dc().downloadFileFromRecord(STATE_TABLE, id, STATE_FILE_COLUMN);
        if (!r.success || !r.data?.length) return undefined;
        return JSON.parse(await gunzip(r.data)) as RuntimeState;
      },
      async save(state) {
        let id = await stateRowId();
        if (!id) {
          const created = unwrap(
            await dc().createRecordAsync<Record<string, string>, Record<string, string>>(STATE_TABLE, { [STATE_KEY_COLUMN]: STATE_ROW_NAME }),
            "create runtime state",
          );
          id = created?.[STATE_ID_COLUMN];
          if (!id) throw new Error("runtime state row id missing");
        }
        const payload = await gzip(JSON.stringify(state));
        unwrap(await dc().uploadFileToRecord(STATE_TABLE, id, STATE_FILE_COLUMN, "aip-state.json.gz", payload), "save runtime state");
      },
      async clear() {
        const id = await stateRowId();
        if (id) unwrap(await dc().deleteRecordAsync(STATE_TABLE, id), "clear runtime state");
      },
    },
  };
}
