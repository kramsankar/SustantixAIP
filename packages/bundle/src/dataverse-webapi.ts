import type { DataverseGridClient } from "@sustantix/host-bridge/src/adapters/dataverse-grid.ts";

/** What the bundle tool needs from the Dataverse Web API: a request (relative to /api/data/v9.2/) that parses JSON. */
export interface WebApiLike {
  readonly base: string;
  request<T = unknown>(method: string, path: string, body?: unknown, extra?: Record<string, string>): Promise<T | undefined>;
}

const READ_HEADERS = { Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue",odata.maxpagesize=5000' };

/**
 * The grid adapter's Dataverse client, over the Web API from a workstation (the code app uses the Power Apps data
 * client instead). Entity set names are resolved once from the environment's metadata.
 */
export async function webApiGridClient(api: WebApiLike): Promise<DataverseGridClient> {
  const meta = await api.request<{ value: Array<{ LogicalName: string; EntitySetName: string }> }>("GET", "EntityDefinitions?$select=LogicalName,EntitySetName&$filter=startswith(LogicalName,'sus_')");
  const sets = new Map((meta?.value ?? []).map((m) => [m.LogicalName, m.EntitySetName]));
  return {
    entitySet: (logical) => sets.get(logical) ?? `${logical}s`,
    async list(table, select, skipToken) {
      // The skip token is the server's next link, relative to the API root.
      const path = skipToken ?? `${table}?$select=${select.join(",")}`;
      const r = await api.request<{ value: Array<Record<string, unknown>>; "@odata.nextLink"?: string }>("GET", path, undefined, READ_HEADERS);
      const next = r?.["@odata.nextLink"];
      return { rows: r?.value ?? [], ...(next ? { skipToken: next.startsWith(api.base) ? next.slice(api.base.length) : next } : {}) };
    },
    async customApi(name, body) {
      return (await api.request<Record<string, unknown>>("POST", name, body)) ?? {};
    },
  };
}
