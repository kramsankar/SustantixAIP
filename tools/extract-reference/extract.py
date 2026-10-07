#!/usr/bin/env python3
"""
Sustantix AIP — reference-build decomposer (v732, v915, …).

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
        # While governed data is active the database is the system of record: no snapshot is kept; a save (a workbook
        # import) goes to the host, which writes what changed as one governed change (phase 4).
        'async function saveEamState(){if(window.__AIP_GOVERNED_ACTIVE__)return window.__AIP_GOVERNED__?.save?.({data:APM_IMPORTED_DATA,lastImport:APM_LAST_IMPORT,mode:APM_DATA_MODE});if(window.__AIP_PERSISTENCE__)return window.__AIP_PERSISTENCE__.save({data:APM_IMPORTED_DATA,lastImport:APM_LAST_IMPORT,mode:APM_DATA_MODE});const db=await openEamDb();',
    ),
    (
        'async function loadEamState(){const db=await openEamDb();',
        'async function loadEamState(){if(window.__AIP_PERSISTENCE__)return window.__AIP_PERSISTENCE__.load();const db=await openEamDb();',
    ),
    (
        'async function clearEamState(){const db=await openEamDb();',
        'async function clearEamState(){if(window.__AIP_PERSISTENCE__)return window.__AIP_PERSISTENCE__.clear();const db=await openEamDb();',
    ),
    # Governed data (phase 3): when the host offers the tenant's governed workbook (window.__AIP_GOVERNED__), boot
    # loads the bundled baseline and overlays the governed sheets, exactly as a workbook upload would.
    ('loadEamState().then(saved=>{', 'loadEamState().then(async saved=>{'),
    (
        'const savedErps = JSON.parse(localStorage.getItem("eam_connected_erps")||"[]");',
        'if(window.__AIP_GOVERNED__&&await (async()=>{try{const g=await window.__AIP_GOVERNED__.load();if(!g||!g.sheets)return false;await loadExcelDemoData(true);window.__AIP_GOVERNED_ACTIVE__=true;Object.assign(APM_IMPORTED_DATA,g.sheets);APM_LAST_IMPORT=g.label||"Governed data";APM_DATA_MODE="Uploaded data";applyImportedData(APM_IMPORTED_DATA);window.refreshAllAPM?.();document.dispatchEvent(new CustomEvent("aip:data-source-changed",{detail:{mode:APM_DATA_MODE,source:"governed"}}));return true}catch(e){console.warn("Governed data unavailable",e);return false}})())return;\n    const savedErps = JSON.parse(localStorage.getItem("eam_connected_erps")||"[]");',
    ),
    # Sign-in performance (Asset Explorer, 0042): axCollectRows de-duplicated every source row on every per-asset
    # call; it is now reused while its source arrays are unchanged, and assetKey (pure) is memoised.
    ('function axCollectRows(sheetNames,globalNames=[]){\n   const rows=[]; globalNames.forEach(n=>rows.push(...arr(n)));\n   for(const sh of sheetNames){rows.push(...axImportedRows(sh),...axWorkbookRows(sh),...axEmbeddedRows(sh));}', "// Sustantix: axCollectRows is called once per asset for every panel, and each call de-duplicated every source row\n // (JSON-serialising each). The result depends only on the source arrays, so it is reused while every source is the\n // very same array at the same length; a replaced, grown or shrunk source rebuilds it. Each caller gets its own copy.\n const axCollectMemo=new Map();\n function axCollectSources(sheetNames,globalNames){\n   const src=[];globalNames.forEach(n=>{try{const v=eval(n);src.push(Array.isArray(v)?v:null)}catch(_){src.push(null)}});\n   for(const sh of sheetNames){\n     try{const d=(typeof APM_IMPORTED_DATA!=='undefined'&&APM_IMPORTED_DATA)||window.APM_IMPORTED_DATA||{};src.push(Array.isArray(d[sh])?d[sh]:null)}catch(_){src.push(null)}\n     for(const g of ['EXCEL_DATA','WORKBOOK_DATA','ACTIVE_DATASET']){try{const v=window[g]?.[sh];src.push(Array.isArray(v)?v:null)}catch(_){src.push(null)}}\n     try{src.push((typeof EMBEDDED_EXCEL_DATA!=='undefined'&&EMBEDDED_EXCEL_DATA&&Array.isArray(EMBEDDED_EXCEL_DATA[sh]))?EMBEDDED_EXCEL_DATA[sh]:null)}catch(_){src.push(null)}\n   }\n   return src;\n }\n function axCollectRows(sheetNames,globalNames=[]){\n   const memoKey=sheetNames.join('\\u0001')+'\\u0002'+globalNames.join('\\u0001');\n   const sources=axCollectSources(sheetNames,globalNames);\n   const lengths=sources.map(a=>a?a.length:-1);\n   const hit=axCollectMemo.get(memoKey);\n   if(hit&&hit.sources.length===sources.length&&hit.sources.every((a,i)=>a===sources[i]&&hit.lengths[i]===lengths[i]))return hit.out.slice();\n   const out=axCollectRowsFresh(sheetNames,globalNames);\n   axCollectMemo.set(memoKey,{sources,lengths,out});\n   return out.slice();\n }\n function axCollectRowsFresh(sheetNames,globalNames){\n   const rows=[]; globalNames.forEach(n=>rows.push(...arr(n)));\n   for(const sh of sheetNames){rows.push(...axImportedRows(sh),...axWorkbookRows(sh),...axEmbeddedRows(sh));}"),
    (" function assetKey(v){return String(v??'').trim().toLowerCase().replace(/[^a-z0-9]/g,'')}", " // Pure in its input string; memoised (bounded) because it runs for every row against every asset.\n const assetKeyMemo=new Map();\n function assetKey(v){const sv=String(v??'');let k=assetKeyMemo.get(sv);if(k===undefined){k=sv.trim().toLowerCase().replace(/[^a-z0-9]/g,'');if(assetKeyMemo.size>200000)assetKeyMemo.clear();assetKeyMemo.set(sv,k)}return k}"),
    # Sign-in performance (0042): plantName evaluated PLANTS once per work order per asset; governed work orders carry
    # no plant name, so every one took that path. The plant table is read once per task and indexed by id.
    ("function plantName(id){const p=arr('PLANTS').find(x=>x.id===id);return p?.name||id||'Unknown site'}", "// Sustantix: plantName runs for every work order against every asset, and each call evaluated PLANTS afresh. The\n // plant table is read once per task (the next task reads it again) and looked up by id; the first plant with an id\n // wins, as find did.\n let axPlantIndex=null;\n function plantName(id){if(!axPlantIndex){axPlantIndex=new Map();for(const x of arr('PLANTS'))if(x&&!axPlantIndex.has(x.id))axPlantIndex.set(x.id,x);setTimeout(()=>{axPlantIndex=null},0)}const p=axPlantIndex.get(id);return p?.name||id||'Unknown site'}"),
    # Sign-in performance (0042): telemetry and work orders were normalised in full for every asset; each source set
    # is now normalised once and indexed by asset key (same rows, same order, same match rule).
    (" function telemetry(a){\n   const matched=axCollectRows(['Telemetry'],['TELEMETRY_LOG']).map(normalizeTelemetry).filter(", " // Sustantix: telemetry and work orders were collected and normalised in full for every asset (every row against\n // every asset, on each render). Each source set is normalised once and indexed by the asset keys its rows carry;\n // an asset tests only the rows carrying its id or tag, in source order, against the same rule as before.\n function axShared(sheetNames,globalNames){\n   const memoKey=sheetNames.join('\\u0001')+'\\u0002'+globalNames.join('\\u0001');\n   const sources=axCollectSources(sheetNames,globalNames);\n   const lengths=sources.map(a=>a?a.length:-1);\n   const hit=axCollectMemo.get(memoKey);\n   if(hit&&hit.sources.length===sources.length&&hit.sources.every((a,i)=>a===sources[i]&&hit.lengths[i]===lengths[i]))return hit.out;\n   const out=axCollectRowsFresh(sheetNames,globalNames);\n   axCollectMemo.set(memoKey,{sources,lengths,out});\n   return out;\n }\n const axIndexMemo=new WeakMap();\n function axCandidates(rows,a,normalize,dep){\n   let m=axIndexMemo.get(rows);\n   if(!m||m.normalize!==normalize||m.dep!==dep){\n     const list=rows.map(normalize),index=new Map();\n     list.forEach((r,i)=>{for(const k of new Set([assetKey(r?.assetId??r?.asset_id??r?.Asset_ID),assetKey(r?.assetTag??r?.asset_tag??r?.Asset_Tag??r?.tag??r?.asset??r?.Asset),assetKey(r?.asset)])){let b=index.get(k);if(!b)index.set(k,b=[]);b.push(i)}});\n     m={normalize,dep,list,index};axIndexMemo.set(rows,m);\n   }\n   const at=new Set([...(m.index.get(assetKey(a?.assetId))||[]),...(m.index.get(assetKey(a?.tag))||[])]);\n   return [...at].sort((x,y)=>x-y).map(i=>m.list[i]);\n }\n function telemetry(a){\n   const matched=axCandidates(axShared(['Telemetry'],['TELEMETRY_LOG']),a,normalizeTelemetry).filter("),
    ("   const pools=axCollectRows(['Work Orders','Work_Orders','Intelligent WO Header','WO Ledger Runtime'],['ALL_WOS']);\n   const seen=new Set(),out=[];\n   pools.forEach(raw=>{\n     const w=normalizeWorkOrder(raw);", "   // Indexed as telemetry is (above); plant names come from PLANTS, so a new plant table re-normalises.\n   const pools=axCandidates(axShared(['Work Orders','Work_Orders','Intelligent WO Header','WO Ledger Runtime'],['ALL_WOS']),a,normalizeWorkOrder,arr('PLANTS'));\n   const seen=new Set(),out=[];\n   pools.forEach(norm=>{\n     const w=Object.assign({},norm);"),
    # Database-only data (0012): on hosts that hold the tenant's runtime datasets in their database, the deferred
    # loader waits for them (loaded after sign-in) before running any module; when they cannot be loaded the host says
    # so and nothing runs on missing data.
    ("    if(started) return;\n    started=true;\n    document.body.classList.add('aip-booting');", "    if(started) return;\n    started=true;\n    if(window.__AIP_DATASETS__){try{await window.__AIP_DATASETS__.ready()}catch(_){return}}\n    document.body.classList.add('aip-booting');"),
    # The data source reads as the database there (0014).
    ('function dxCurrentSourceLabel(full){\n', 'function dxCurrentSourceLabel(full){\n  if(window.__AIP_DB_ONLY__) return full ? "your organisation\'s database" : "Database";\n'),
    # Page freeze (every screen, 0589): the v378 Revenue shell recreated the retired F1 Help control on each change and
    # the v403 guard removed it again, a continuous add/remove loop that re-ran every page-wide observer.
    ('    let holder=pane.querySelector(\':scope > .f1-help-top-right.aip-v378-revenue-help\');\n    let button=pane.querySelector(\'.f1-btn\');\n    if(!holder){\n      holder=document.createElement(\'div\');\n      holder.className=\'f1-help-top-right aip-v378-revenue-help\';\n      pane.insertBefore(holder,pane.firstChild);\n    }\n    if(!button){\n      button=document.createElement(\'button\');\n      button.type=\'button\';\n      button.className=\'f1-btn\';\n      button.innerHTML=\'<span class="f1-key">F1</span> Help\';\n    }\n    if(button.parentNode!==holder)holder.appendChild(button);\n    button.onclick=function(e){\n      e.preventDefault();e.stopPropagation();\n      if(typeof window.openHelp===\'function\')window.openHelp(helpView);\n    };\n    button.dataset.helpView=helpView;\n    button.title=\'F1 Help\';\n    button.setAttribute(\'aria-label\',\'Open F1 Help\');\n    /* Remove duplicate/legacy controls and child page-heads after preserving one F1. */\n    pane.querySelectorAll(\'.f1-btn\').forEach(b=>{if(b!==button)b.remove()});\n    pane.querySelectorAll(\':scope > .page-head\').forEach(h=>h.remove());', "    /* Sustantix: F1 Help is retired (the v403 removal guard purges every F1 control on each change under #main).\n       Recreating it here fought that guard in an endless add/remove loop, and every turn woke each page-wide\n       observer, keeping the page busy on every screen. Only the redundant child page-heads are normalized now. */\n    pane.querySelectorAll(':scope > .page-head').forEach(h=>h.remove());"),
]

XLSX_CDN ='data-src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"'
XLSX_LOCAL = 'data-src="vendor/xlsx.full.min.js"'


WRAPPER_RE = re.compile(r'<script id="workspace" type="application/octet-stream">\s*([A-Za-z0-9+/=\s]+?)\s*</script>')


def unwrap(html: str) -> str:
    """v9xx references ship as a gzip+base64 container that document.write()s the real app."""
    m = WRAPPER_RE.search(html)
    if not m or len(html) - len(m.group(1)) > 20000:
        return html
    import base64
    import gzip
    return gzip.decompress(base64.b64decode(re.sub(r"\s+", "", m.group(1)))).decode("utf-8")


def main(src_html: str, out: str):
    for sub in ("js", "data", "assets"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)
    with open(src_html, encoding="utf-8") as fh:
        wrapped = fh.read()
    html = unwrap(wrapped)
    manifest = {"source": os.path.basename(src_html), "sourceSha256": hashlib.sha256(wrapped.encode("utf-8")).hexdigest(),
                "appSha256": hashlib.sha256(html.encode("utf-8")).hexdigest(),
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
