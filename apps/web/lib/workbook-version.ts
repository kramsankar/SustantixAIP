/**
 * The governed workbook's version, so a sign-in with no data changed since the last one skips rebuilding and
 * re-downloading it. Every write to a tenant's governed data leaves a row in aip.audit_log (row triggers on every
 * table, and apply_change_set for every change set), and every change set a row in aip.change_set; the version is the
 * newest of each, with the deployed build (a new build may shape the workbook differently).
 */
export interface VersionSource {
  latestAudit(tenantId: string): Promise<string | null>;
  latestChangeSet(tenantId: string): Promise<string | null>;
}

export const BUILD = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "dev";

export async function workbookVersion(tenantId: string, src: VersionSource, build = BUILD): Promise<string> {
  const [audit, changeSet] = await Promise.all([src.latestAudit(tenantId), src.latestChangeSet(tenantId)]);
  return `W/"wb-${build}-${tenantId}-${audit ?? "0"}-${changeSet ? Date.parse(changeSet) : 0}"`;
}

/** True when the browser already holds this version (If-None-Match, which may list several tags or be *). */
export function notModified(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false;
  const bare = (t: string) => t.trim().replace(/^W\//, "");
  return ifNoneMatch.split(",").some((t) => t.trim() === "*" || bare(t) === bare(etag));
}
