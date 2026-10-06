import type { LicenseStatus, RuntimeEnvironment } from "@sustantix/license";

/** Snapshot the AIP runtime persists through saveEamState / loadEamState. */
export interface RuntimeState {
  data: Record<string, unknown[]>;
  lastImport: unknown;
  mode: string;
}

export interface StatePersistence {
  load(): Promise<RuntimeState | undefined>;
  save(state: RuntimeState): Promise<void>;
  clear(): Promise<void>;
}

/** The tenant's governed data in the runtime's workbook shape (phase 3), offered at boot through a host seam. */
export interface GovernedWorkbook {
  label: string;
  sheets: Record<string, unknown[]>;
  omitted?: string[];
}

export interface GovernedSource {
  /** Resolves null when this deployment serves the bundled data. */
  load(): Promise<GovernedWorkbook | null>;
  /**
   * Phase 4: the runtime saved while showing governed data (a workbook import). The host writes what changed as one
   * governed change, or rejects, in which case the changed sheets are restored to what was loaded.
   */
  save?(state: RuntimeState): Promise<void>;
  /**
   * Starts loading the workbook now (a session is known), so the runtime's load() after sign-in finds it ready or in
   * flight instead of starting it then.
   */
  prefetch?(): void;
}

/** Phase 4: the Enterprise Grid inside the runtime's screens, switched on per screen by the host. */
export interface GridHost {
  /** Screens (data-view names) whose tables become grids, or "all"; empty means none. */
  screens(): Promise<string[] | "all">;
  /** The governed grid workspace, on hosts that serve it. */
  workspaceUrl?: string;
  /** Where governed grids read and write: the host's grid API ("http" on Vercel) or a host-side implementation. */
  api?: "http" | object;
  /** Audits an export of a screen grid. */
  recordExport?(grid: string, format: "csv" | "xlsx", rows: number): Promise<void>;
}

export interface Identity {
  displayName: string;
  login: string;
}

/**
 * Everything a hosting platform must provide. The bridge never trusts the client
 * for authorisation: when a host offers serverVerdict(), that verdict wins.
 */
export interface HostAdapter {
  readonly name: "standalone" | "powerapps" | "vercel";
  init(): Promise<void>;
  environment(): Promise<RuntimeEnvironment>;
  /** Authoritative server-side license verdict (Dataverse plug-in / Vercel API). */
  serverVerdict?(refresh?: boolean): Promise<LicenseStatus | null>;
  /** Raw token for client-side verification when no server verdict exists. */
  licenseToken?(): Promise<string | null>;
  trustedNow(): Promise<number>;
  /** Single sign-on identity, when the platform already authenticated the user. */
  ssoIdentity?(): Promise<Identity | null>;
  signIn(login: string, secret: string): Promise<boolean>;
  signOut?(): Promise<void>;
  persistence?: StatePersistence;
  governed?: GovernedSource;
  grid?: GridHost;
}
