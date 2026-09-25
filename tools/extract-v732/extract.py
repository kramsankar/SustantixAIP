#!/usr/bin/env python3
"""
Sustantix AIP — v732 reference decomposer.

Turns the single-file v732 reference build (≈65 MB HTML) into the modular
runtime source tree under apps/runtime/src:

  index.html          markup + styles, every script externalised in original order
  js/NNNN[-id].js     one file per executable script block (classic, parser-ordered)
  data/<hash>.json    every large inline dataset literal, byte-for-byte
  assets/img-*.{jpg,png}  every embedded image
  manifest.json       provenance: script order, dataset hashes, image hashes

Behavioural guarantees
  * Parser-inserted classic scripts become <script src> tags at the same position,
    so execution order and DOM visibility at execution time are unchanged.
  * Deferred modules keep their <script type="application/x-aip-deferred"> slot;
    the deferred loader is patched to fetch + await them in the same order.
  * Dataset literals are replaced by __AIP_DS("<hash>"), which returns a fresh
    object graph per call (identical to re-evaluating the literal).
  * The prototype credential check is replaced by the host identity bridge
    (window.AIPHost.signIn), so no credential lives in the client bundle.

Usage: python3 extract.py <AIP_v732.html> <out_dir>
"""
import hashlib
import json
import os
import re
import sys

MIN_DATASET_CHARS = 20000
MIN_IMAGE_B64 = 2000

IMG_RE = re.compile(r"data:image/(png|jpeg|jpg|gif|webp|svg\+xml);base64,([A-Za-z0-9+/=]+)")
SCRIPT_RE = re.compile(r"<script([^>]*)>(.*?)</script>", re.S)
CANDIDATE_RE = re.compile(r"(?:[=(:,\[]|return)\s*(?=(?:\[\s*\{\s*\"|\{\s*\"))")


def sha(text: str, n: int = 16) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:n]


def _strict_const(name):
    raise ValueError("non-JSON constant " + name)


DECODER = json.JSONDecoder(parse_constant=_strict_const)


def externalise_images(html: str, out: str, manifest: dict) -> str:
    os.makedirs(os.path.join(out, "assets"), exist_ok=True)
    import base64

    def repl(m):
        kind, b64 = m.group(1), m.group(2)
        if len(b64) < MIN_IMAGE_B64:
            return m.group(0)
        ext = {"jpeg": "jpg", "svg+xml": "svg"}.get(kind, kind)
        name = "img-" + sha(b64, 14) + "." + ext
        path = os.path.join(out, "assets", name)
        if not os.path.exists(path):
            with open(path, "wb") as fh:
                fh.write(base64.b64decode(b64 + "=" * (-len(b64) % 4)))
            manifest["images"].append({"file": "assets/" + name, "bytes": os.path.getsize(path)})
        return "assets/" + name

    return IMG_RE.sub(repl, html)


def extract_datasets(body: str, out: str, manifest: dict, owner: str) -> str:
    """Replace large JSON literals inside a script body with __AIP_DS(hash)."""
    parts, pos, i = [], 0, 0
    n = len(body)
    while True:
        m = CANDIDATE_RE.search(body, i)
        if not m:
            break
        start = m.end()
        try:
            _, end = DECODER.raw_decode(body, start)
        except ValueError as exc:
            # Skip ahead past the failure point to avoid quadratic rescans.
            err_pos = getattr(exc, "pos", None)
            i = max(start + 1, err_pos if isinstance(err_pos, int) else start + 1)
            continue
        text = body[start:end]
        if len(text) >= MIN_DATASET_CHARS:
            h = sha(text)
            path = os.path.join(out, "data", h + ".json")
            if not os.path.exists(path):
                with open(path, "w", encoding="utf-8") as fh:
                    fh.write(text)
                manifest["datasets"][h] = {"bytes": len(text.encode("utf-8")), "firstOwner": owner}
            manifest["datasets"][h].setdefault("owners", []).append(owner)
            parts.append(body[pos:start])
            parts.append('__AIP_DS("%s")' % h)
            pos = end
        i = end
        if i >= n:
            break
    parts.append(body[pos:])
    return "".join(parts)


LOGIN_OLD = (
    "  function login(){\n"
    "    if(loginInProgress) return;\n"
    "    if(user.value.trim().toLowerCase()==='admin' && pass.value==='sustantix2026'){"
)
LOGIN_NEW = (
    "  async function login(){\n"
    "    if(loginInProgress) return;\n"
    "    let hostAuthorised=false;\n"
    "    try{ hostAuthorised=!!(window.AIPHost && await window.AIPHost.signIn(user.value.trim(), pass.value)); }catch(_){ hostAuthorised=false; }\n"
    "    if(hostAuthorised){"
)

LOADER_OLD = (
    "        const src=node.getAttribute('data-src');\n"
    "        if(src){"
)
LOADER_NEW = (
    "        const moduleSrc=node.getAttribute('data-aip-src');\n"
    "        if(moduleSrc){\n"
    "          script.src=moduleSrc;\n"
    "          script.onload=()=>resolve();\n"
    "          script.onerror=()=>{ console.error('AIP module failed to load: '+moduleSrc); resolve(); };\n"
    "          document.body.appendChild(script);\n"
    "          return;\n"
    "        }\n"
    "        const src=node.getAttribute('data-src');\n"
    "        if(src){"
)

# Host seams: the runtime's workbook-import state is routed to the tenant store
# (Dataverse / Supabase) whenever the host bridge registers __AIP_PERSISTENCE__.
SEAMS = [
    (
        'async function saveEamState(){const db=await openEamDb();',
        'async function saveEamState(){if(window.__AIP_PERSISTENCE__)return window.__AIP_PERSISTENCE__.save({data:APM_IMPORTED_DATA,lastImport:APM_LAST_IMPORT,mode:APM_DATA_MODE});const db=await openEamDb();',
    ),
    (
        'async function loadEamState(){const db=await openEamDb();',
        'async function loadEamState(){if(window.__AIP_PERSISTENCE__)return window.__AIP_PERSISTENCE__.load();const db=await openEamDb();',
    ),
    (
        'async function clearEamState(){const db=await openEamDb();',
        'async function clearEamState(){if(window.__AIP_PERSISTENCE__)return window.__AIP_PERSISTENCE__.clear();const db=await openEamDb();',
    ),
]

XLSX_CDN ='data-src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"'
XLSX_LOCAL = 'data-src="vendor/xlsx.full.min.js"'


def main(src_html: str, out: str):
    for sub in ("js", "data", "assets"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)
    with open(src_html, encoding="utf-8") as fh:
        html = fh.read()
    manifest = {"source": os.path.basename(src_html), "sourceSha256": hashlib.sha256(html.encode("utf-8")).hexdigest(),
                "scripts": [], "datasets": {}, "images": []}

    html = externalise_images(html, out, manifest)

    if html.count(LOGIN_OLD) != 1:
        raise SystemExit("login block signature not found exactly once")
    html = html.replace(LOGIN_OLD, LOGIN_NEW)
    if html.count(LOADER_OLD) != 1:
        raise SystemExit("deferred loader signature not found exactly once")
    html = html.replace(LOADER_OLD, LOADER_NEW)
    html = html.replace(XLSX_CDN, XLSX_LOCAL)
    for old, new in SEAMS:
        if html.count(old) != 1:
            raise SystemExit("host seam not found exactly once: " + old[:60])
        html = html.replace(old, new)

    out_parts, pos, seq = [], 0, 0
    for m in SCRIPT_RE.finditer(html):
        attrs, body = m.group(1), m.group(2)
        out_parts.append(html[pos:m.start()])
        pos = m.end()
        inert = ("x-aip-superseded" in attrs) or ("text/plain" in attrs) or ("data-src=" in attrs) or not body.strip()
        if inert:
            out_parts.append(m.group(0))
            continue
        seq += 1
        idm = re.search(r"id=[\"']([^\"']+)", attrs)
        sid = idm.group(1) if idm else ""
        slug = re.sub(r"[^a-z0-9]+", "-", sid.lower()).strip("-")[:60]
        name = "%04d%s.js" % (seq, ("-" + slug) if slug else "")
        deferred = "x-aip-deferred" in attrs
        body = extract_datasets(body, out, manifest, name)
        with open(os.path.join(out, "js", name), "w", encoding="utf-8") as fh:
            fh.write(body)
        manifest["scripts"].append({"seq": seq, "file": "js/" + name, "id": sid, "deferred": deferred,
                                    "bytes": len(body.encode("utf-8"))})
        id_attr = (' id="%s"' % sid) if sid else ""
        if deferred:
            out_parts.append('<script type="application/x-aip-deferred"%s data-aip-src="js/%s"></script>' % (id_attr, name))
        else:
            out_parts.append('<script%s src="js/%s"></script>' % (id_attr, name))
    out_parts.append(html[pos:])
    page = "".join(out_parts)

    # Host bridge + dataset registry must exist before any application script.
    head_boot = '<script src="host/aip-host-bridge.js"></script>\n<script src="host/aip-datasets.js"></script>\n'
    head_boot += "".join('<script src="data/%s.js"></script>\n' % h for h in sorted(manifest["datasets"]))
    page = page.replace("<head>", "<head>\n" + head_boot, 1)

    with open(os.path.join(out, "index.html"), "w", encoding="utf-8") as fh:
        fh.write(page)
    with open(os.path.join(out, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=1)
    total_data = sum(v["bytes"] for v in manifest["datasets"].values())
    print("scripts=%d datasets=%d (%.1f MB) images=%d index.html=%.1f MB" % (
        len(manifest["scripts"]), len(manifest["datasets"]), total_data / 1e6, len(manifest["images"]),
        len(page.encode("utf-8")) / 1e6))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
