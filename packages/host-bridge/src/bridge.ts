import { MODULES, grantedModules, type LicenseStatus, type TrustedKey } from "@sustantix/license";
import { resolveLicense } from "./license-gate.js";
import type { HostAdapter } from "./types.js";

const RECHECK_MS = 15 * 60 * 1000;

declare global {
  interface Window {
    AIPHost?: AIPHostApi;
  }
}

export interface AIPHostApi {
  readonly platform: HostAdapter["name"];
  signIn(login: string, secret: string): Promise<boolean>;
  signOut(): Promise<void>;
  license(): Promise<LicenseStatus>;
  refreshLicense(): Promise<LicenseStatus>;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function onReady(fn: () => void) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
  else fn();
}

const STYLE = `
#sxLicensePanel{margin-top:6px;padding:14px 16px;border-radius:10px;border:1px solid #F1C9C2;background:#FBEAE8;color:#0B1F26;font:13px/1.5 Arial,sans-serif;text-align:left}
#sxLicensePanel b{display:block;font-size:14px;margin-bottom:4px;color:#8B3A3A}
#sxLicensePanel code{font-size:11.5px;background:#fff;border:1px solid #E1E6E8;border-radius:4px;padding:1px 5px}
#sxLicenseBadge{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:15px;font:700 11.5px Arial,sans-serif;border:1px solid #CFE7E6;background:#E4F3F2;color:#0E7C7B;white-space:nowrap}
#sxLicenseBadge.warn{border-color:#F0D9B5;background:#FBF0DF;color:#9A6212}
#sxLicenseBadge.bad{border-color:#F1C9C2;background:#FBEAE8;color:#B84A2E}
#sxLicenseLock{position:fixed;inset:0;z-index:2147483000;background:rgba(11,31,38,.72);display:flex;align-items:center;justify-content:center}
#sxLicenseLock>div{max-width:460px;background:#fff;border-radius:14px;padding:26px 28px;font:14px/1.55 Arial,sans-serif;color:#0B1F26;box-shadow:0 20px 60px rgba(0,0,0,.3)}
`;

export function installBridge(adapter: HostAdapter, trustedKeys: TrustedKey[]) {
  try {
    // The prototype auto-resumed any tab that carried this flag; only the host may authorise a session.
    sessionStorage.removeItem("eam_logged_in");
  } catch {
    /* storage unavailable */
  }

  let current: Promise<LicenseStatus> = adapter.init().then(() => resolveLicense(adapter, trustedKeys));

  const api: AIPHostApi = {
    platform: adapter.name,
    async signIn(login, secret) {
      const lic = await current;
      if (lic.access === "none") return false;
      if (adapter.ssoIdentity) {
        const sso = await adapter.ssoIdentity();
        if (sso) return true;
      }
      if (!login || !secret) return false;
      return adapter.signIn(login, secret);
    },
    async signOut() {
      await adapter.signOut?.();
      try {
        sessionStorage.removeItem("eam_logged_in");
      } catch {
        /* ignore */
      }
      location.reload();
    },
    license: () => current,
    refreshLicense() {
      current = resolveLicense(adapter, trustedKeys, true);
      return current;
    },
  };
  Object.defineProperty(window, "AIPHost", { value: Object.freeze(api), writable: false, configurable: false });

  onReady(() => {
    const style = document.createElement("style");
    style.id = "sx-host-bridge-style";
    style.textContent = STYLE;
    document.head.appendChild(style);
    void current.then((lic) => applyLicense(lic, adapter));
  });

  if (adapter.persistence) {
    // Consumed by the host seams in saveEamState / loadEamState / clearEamState.
    Object.defineProperty(window, "__AIP_PERSISTENCE__", { value: adapter.persistence, writable: false, configurable: false });
  }

  window.setInterval(async () => {
    const lic = await api.refreshLicense();
    if (lic.access === "none") lockApplication(lic);
    else renderBadge(lic);
  }, RECHECK_MS);
}

function applyLicense(lic: LicenseStatus, adapter: HostAdapter) {
  gateModules(lic);
  renderBadge(lic);
  const card = document.querySelector("#loginScreen .login-card");
  if (lic.access === "none") {
    if (card) {
      card.querySelectorAll(".login-field,#loginBtn").forEach((el) => ((el as HTMLElement).style.display = "none"));
      const panel = document.createElement("div");
      panel.id = "sxLicensePanel";
      panel.innerHTML =
        `<b>${escapeHtml(lic.state === "expired" ? "Subscription ended" : "License required")}</b>` +
        `${escapeHtml(lic.reason)}.<br/>Ask your administrator to install a valid Sustantix license key` +
        (lic.fingerprint ? `<br/><span style="color:#4C6169">Key fingerprint <code>${escapeHtml(lic.fingerprint)}</code></span>` : "");
      card.insertBefore(panel, card.querySelector(".login-footer"));
    }
    return;
  }
  void autoSignIn(adapter);
}

async function autoSignIn(adapter: HostAdapter) {
  if (!adapter.ssoIdentity) return;
  const who = await adapter.ssoIdentity();
  if (!who) return;
  const user = document.getElementById("loginUser") as HTMLInputElement | null;
  const btn = document.getElementById("loginBtn") as HTMLButtonElement | null;
  if (!user || !btn) return;
  user.value = who.login;
  const pass = document.getElementById("loginPass") as HTMLInputElement | null;
  if (pass) pass.closest(".login-field")?.setAttribute("hidden", "");
  btn.textContent = `Continue as ${who.displayName}`;
  btn.click();
}

function gateModules(lic: LicenseStatus) {
  const granted = grantedModules(lic.license?.modules ?? ["*"]);
  const blocked = Object.entries(MODULES)
    .filter(([k]) => !granted.includes(k))
    .flatMap(([, m]) => m.views);
  if (!blocked.length) return;
  const css = blocked.map((v) => `#sidebar .nav-item[data-view="${v}"]`).join(",") + "{display:none!important}";
  const style = document.createElement("style");
  style.id = "sx-module-gate";
  style.textContent = css;
  document.head.appendChild(style);
  document.addEventListener(
    "click",
    (e) => {
      const target = (e.target as Element | null)?.closest?.("[data-view]");
      const view = target?.getAttribute("data-view");
      if (view && blocked.includes(view)) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    },
    true,
  );
}

function renderBadge(lic: LicenseStatus) {
  const host = document.querySelector("#topbar .top-right");
  if (!host) return;
  let badge = document.getElementById("sxLicenseBadge");
  if (!badge) {
    badge = document.createElement("span");
    badge.id = "sxLicenseBadge";
    host.insertBefore(badge, host.firstChild);
  }
  const d = lic.daysRemaining ?? 0;
  const edition = lic.license?.edition ?? "";
  badge.className = lic.access === "full" ? (edition === "trial" && d <= 7 ? "warn" : "") : lic.access === "read_only" ? "warn" : "bad";
  badge.textContent =
    lic.access === "none"
      ? "Unlicensed"
      : lic.access === "read_only"
        ? "Read-only · renew license"
        : edition === "trial"
          ? `Trial · ${d} day${d === 1 ? "" : "s"} left`
          : `${edition ? edition[0]!.toUpperCase() + edition.slice(1) : "Licensed"}`;
  badge.title = `${lic.reason}${lic.expiresAt ? " · valid to " + lic.expiresAt.slice(0, 10) : ""}${lic.fingerprint ? " · key " + lic.fingerprint : ""}`;
}

function lockApplication(lic: LicenseStatus) {
  if (document.getElementById("sxLicenseLock")) return;
  const lock = document.createElement("div");
  lock.id = "sxLicenseLock";
  lock.innerHTML = `<div><b style="font-size:17px">Sustantix AIP is locked</b><p>${escapeHtml(lic.reason)}.</p><p style="color:#4C6169">Contact your Sustantix administrator to renew the license.</p></div>`;
  document.body.appendChild(lock);
}
