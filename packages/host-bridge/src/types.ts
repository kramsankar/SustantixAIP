import type { LicenseStatus, RuntimeEnvironment } from "@sustantix/license";

/** Snapshot the v732 runtime persists through saveEamState / loadEamState. */
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
}
