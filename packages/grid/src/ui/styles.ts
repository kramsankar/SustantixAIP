/**
 * Grid styles, injected once per document. Interim Sustantix tokens (deep green, slate, white) pending brand tokens;
 * colours are custom properties so a host can restyle the grid without touching it.
 */
export const GRID_CSS = `
.sxg{--sxg-bg:#ffffff;--sxg-fg:#1e293b;--sxg-muted:#64748b;--sxg-line:#e2e8f0;--sxg-head:#f1f5f4;--sxg-accent:#14532d;--sxg-accent-soft:#dcfce7;--sxg-dirty:#fef3c7;--sxg-new:#e0f2fe;--sxg-danger:#b91c1c;--sxg-focus:#15803d;
  font:13px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--sxg-fg);background:var(--sxg-bg);display:flex;flex-direction:column;min-height:0;height:100%;border:1px solid var(--sxg-line);border-radius:8px;overflow:hidden}
@media (prefers-color-scheme:dark){.sxg{--sxg-bg:#0f172a;--sxg-fg:#e2e8f0;--sxg-muted:#94a3b8;--sxg-line:#1e293b;--sxg-head:#111c2e;--sxg-accent:#4ade80;--sxg-accent-soft:#14532d;--sxg-dirty:#422006;--sxg-new:#0c4a6e;--sxg-danger:#f87171;--sxg-focus:#4ade80}}
.sxg *{box-sizing:border-box}
.sxg button,.sxg select,.sxg input{font:inherit;color:inherit}
.sxg-toolbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px;border-bottom:1px solid var(--sxg-line);background:var(--sxg-head)}
.sxg-toolbar .sxg-spacer{flex:1}
.sxg-btn{border:1px solid var(--sxg-line);background:var(--sxg-bg);border-radius:6px;padding:4px 10px;cursor:pointer;white-space:nowrap}
.sxg-btn:hover{border-color:var(--sxg-accent)}
.sxg-btn:disabled{opacity:.5;cursor:default}
.sxg-btn.sxg-primary{background:var(--sxg-accent);border-color:var(--sxg-accent);color:#fff}
@media (prefers-color-scheme:dark){.sxg-btn.sxg-primary{color:#052e16}}
.sxg-input,.sxg-select{border:1px solid var(--sxg-line);background:var(--sxg-bg);border-radius:6px;padding:4px 8px;min-width:0}
.sxg-search{width:220px;max-width:100%}
.sxg-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 8px 8px;background:var(--sxg-head);border-bottom:1px solid var(--sxg-line)}
.sxg-chips:empty{display:none}
.sxg-chip{display:inline-flex;gap:6px;align-items:center;background:var(--sxg-accent-soft);border-radius:999px;padding:2px 4px 2px 10px}
.sxg-chip button{border:0;background:transparent;cursor:pointer;padding:0 6px;border-radius:999px}
.sxg-scroll{flex:1;overflow:auto;position:relative;outline:none;min-height:120px}
.sxg-scroll:focus-visible{box-shadow:inset 0 0 0 2px var(--sxg-focus)}
.sxg-row{display:grid;position:absolute;left:0;min-width:100%;border-bottom:1px solid var(--sxg-line);background:var(--sxg-bg)}
.sxg-headrow{position:sticky;top:0;z-index:3;display:grid;min-width:100%;background:var(--sxg-head);border-bottom:1px solid var(--sxg-line);font-weight:600}
.sxg-cell{padding:6px 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-right:1px solid var(--sxg-line);background:inherit;min-height:32px}
.sxg-cell.sxg-num{text-align:right;font-variant-numeric:tabular-nums}
.sxg-cell.sxg-pin{position:sticky;z-index:1}
.sxg-headrow .sxg-cell{position:relative;cursor:pointer;user-select:none;display:flex;gap:4px;align-items:center}
.sxg-headrow .sxg-cell.sxg-pin{position:sticky;z-index:4}
.sxg-sort{color:var(--sxg-accent);font-size:11px}
.sxg-resize{position:absolute;right:-3px;top:0;bottom:0;width:6px;cursor:col-resize;z-index:5}
.sxg-cell.sxg-active{box-shadow:inset 0 0 0 2px var(--sxg-focus)}
.sxg-cell.sxg-dirty{background:var(--sxg-dirty)}
.sxg-row.sxg-new{background:var(--sxg-new)}
.sxg-row.sxg-deleted .sxg-cell{text-decoration:line-through;color:var(--sxg-muted)}
.sxg-row.sxg-selected{background:var(--sxg-accent-soft)}
.sxg-row.sxg-group{font-weight:600;background:var(--sxg-head)}
.sxg-cell.sxg-editable{cursor:text}
.sxg-cell.sxg-error{box-shadow:inset 0 0 0 2px var(--sxg-danger)}
.sxg-loading{color:var(--sxg-muted)}
.sxg-toggle{border:0;background:transparent;cursor:pointer;width:18px;padding:0;margin-right:2px}
.sxg-link{border:0;background:transparent;color:var(--sxg-accent);cursor:pointer;padding:0 0 0 4px;font-size:11px}
.sxg-editor{width:100%;border:0;outline:none;background:transparent;padding:0}
.sxg-foot{display:flex;flex-wrap:wrap;gap:12px;padding:6px 10px;border-top:1px solid var(--sxg-line);color:var(--sxg-muted);background:var(--sxg-head)}
.sxg-foot strong{color:var(--sxg-fg);font-weight:600}
.sxg-status{margin-left:auto}
.sxg-status.sxg-bad{color:var(--sxg-danger)}
.sxg-dialog{position:absolute;inset:0;background:rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center;z-index:10}
.sxg-dialog[hidden]{display:none}
.sxg-panel{background:var(--sxg-bg);border:1px solid var(--sxg-line);border-radius:10px;padding:16px;min-width:320px;max-width:min(720px,92vw);max-height:80vh;overflow:auto;box-shadow:0 10px 30px rgba(0,0,0,.2)}
.sxg-panel h3{margin:0 0 10px;font-size:15px}
.sxg-panel table{border-collapse:collapse;width:100%;margin:8px 0}
.sxg-panel td,.sxg-panel th{border:1px solid var(--sxg-line);padding:4px 8px;text-align:left}
.sxg-panel .sxg-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
.sxg-panel label{display:flex;flex-direction:column;gap:4px;margin:8px 0}
.sxg-panel .sxg-inline{flex-direction:row;align-items:center}
.sxg-cols li{display:flex;gap:6px;align-items:center;padding:2px 0}
.sxg-cols{list-style:none;padding:0;margin:0}
.sxg-tall .sxg-body .sxg-cell{line-height:1.3;padding-top:5px;padding-bottom:5px}
.sxg-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
`;

export function injectStyles(doc: Document): void {
  if (doc.getElementById("sxg-styles")) return;
  const s = doc.createElement("style");
  s.id = "sxg-styles";
  s.textContent = GRID_CSS;
  doc.head.appendChild(s);
}
