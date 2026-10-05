import { requestContext } from "../analytics/context";
import { SupabaseChangeStore, SupabaseExportLog, SupabaseGridStore, SupabaseViewStore } from "../supabase/grid-store";

/** Production wiring: every grid store runs on the caller's own client, so row-level security applies throughout. */
export async function gridContext() {
  const { userId, membership, db } = await requestContext();
  const grid = new SupabaseGridStore(db);
  return {
    userId,
    membership,
    grid,
    options: grid,
    changes: new SupabaseChangeStore(db),
    exports: new SupabaseExportLog(db),
    views: new SupabaseViewStore(db, userId),
  };
}
