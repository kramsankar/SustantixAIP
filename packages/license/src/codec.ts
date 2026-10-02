const enc = new TextEncoder();
const dec = new TextDecoder("utf-8", { fatal: true });

export function utf8(text: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(enc.encode(text));
}

export function fromUtf8(bytes: Uint8Array): string {
  return dec.decode(bytes);
}

export function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const B64URL = /^[A-Za-z0-9_-]*$/;

export function b64urlDecode(text: string): Uint8Array<ArrayBuffer> {
  if (!B64URL.test(text)) throw new Error("invalid base64url");
  const pad = text.length % 4 === 0 ? "" : "=".repeat(4 - (text.length % 4));
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
