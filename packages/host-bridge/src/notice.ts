/** A short host notice at the foot of the screen (governed saves), dismissed after a few seconds or on click. */
export function showNotice(message: string, kind: "ok" | "error"): void {
  if (typeof document === "undefined") return;
  let el = document.getElementById("sxHostNotice");
  if (!el) {
    el = document.createElement("div");
    el.id = "sxHostNotice";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147482000;max-width:min(680px,92vw);padding:10px 16px;border-radius:10px;font:13px/1.45 Arial,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.18);cursor:pointer";
    el.addEventListener("click", () => el!.remove());
    document.body.appendChild(el);
  }
  el.style.background = kind === "ok" ? "#E4F3F2" : "#FBEAE8";
  el.style.color = kind === "ok" ? "#0B4F4E" : "#8B3A3A";
  el.style.border = `1px solid ${kind === "ok" ? "#CFE7E6" : "#F1C9C2"}`;
  el.textContent = message;
  const shown = el;
  setTimeout(() => shown.isConnected && shown.textContent === message && shown.remove(), kind === "ok" ? 6000 : 12000);
}
