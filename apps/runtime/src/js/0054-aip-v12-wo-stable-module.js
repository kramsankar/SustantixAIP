
(function(){
'use strict';
const S={selectedIds:new Set(),search:'',status:'All',tab:(window.AIP_WO_DESIRED_TAB||'ledger')};
function firstSelectedSource(){const id=[...S.selectedIds][0];return id?rows().find(r=>String(r.id)===String(id)):null}
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c));
function rows(){try{return typeof opsWOs==='function'?opsWOs():[]}catch(_){return []}}
function view(){return document.getElementById('view-workorderintelligence')}
function crewOptions(current){
 const base=[['CREW-N-1','North Electrical Response Team'],['CREW-N-2','North HV & Transformer Team'],['CREW-N-3','North Mechanical & Tracker Team'],['CREW-W-1','West Inverter Response Team'],['CREW-W-2','West Civil & Module Team'],['CREW-W-3','West Tracker Maintenance Team'],['CREW-S-1','South Electrical Response Team'],['CREW-S-2','South Transformer Team'],['CREW-C-1','Central Multi-Skilled Team']];
 const seen=new Set(base.map(x=>x[0])); rows().forEach(r=>{if(r.crew&&!seen.has(String(r.crew))){base.push([String(r.crew),String(r.crew)]);seen.add(String(r.crew))}});
 return '<option value="">Unassigned</option>'+base.map(([id,name])=>`<option value="${esc(id)}" ${String(current||'')===id?'selected':''}>${esc(id)} — ${esc(name)}</option>`).join('');
}
function allPlants(){
 const seen=new Set(); const list=[];
 rows().forEach(r=>{const p=String(r.plant||'').trim(); if(p && !seen.has(p)){seen.add(p);list.push(p)}});
 return list.sort((a,b)=>a.localeCompare(b));
}
function allAssetsForPlant(plant){
 const seen=new Set(); const list=[];
 rows().forEach(r=>{const a=String(r.asset||'').trim(); if(!a||seen.has(a))return; if(plant && r.plant!==plant)return; seen.add(a);list.push(a)});
 return list.sort((a,b)=>a.localeCompare(b));
}
function plantOptions(current){
 const list=allPlants(); if(current && !list.includes(current)) list.unshift(current);
 return '<option value="">Select site…</option>'+list.map(p=>`<option value="${esc(p)}" ${String(current||'')===p?'selected':''}>${esc(p)}</option>`).join('');
}
function assetOptionsHtml(current,plant){
 const list=allAssetsForPlant(plant); if(current && !list.includes(current)) list.unshift(current);
 return '<option value="">Select asset…</option>'+list.map(a=>`<option value="${esc(a)}" ${String(current||'')===a?'selected':''}>${esc(a)}</option>`).join('');
}
function ensureDrawer(){
 let b=document.getElementById('aipWo12Backdrop'); if(!b){b=document.createElement('div');b.id='aipWo12Backdrop';b.style.cssText='display:none;position:fixed;inset:0;background:rgba(15,23,42,.46);z-index:2147483644';document.body.appendChild(b)}
 let d=document.getElementById('aipWo12Drawer'); if(!d){d=document.createElement('aside');d.id='aipWo12Drawer';d.style.cssText='display:none;position:fixed;top:0;right:0;width:min(760px,96vw);height:100vh;background:#fff;z-index:2147483645;box-shadow:-16px 0 38px rgba(15,23,42,.3)';document.body.appendChild(d)}
 b.onclick=closeDrawer; return {b,d};
}
function closeDrawer(){const {b,d}=ensureDrawer();b.style.display='none';d.style.display='none';d.innerHTML='';document.body.style.overflow=''}
function sel(id,items,val){return `<select id="${id}">${items.map(x=>`<option value="${esc(x)}" ${String(val||'')===x?'selected':''}>${esc(x)}</option>`).join('')}</select>`}
function fld(label,html,full=false){return `<label style="display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:700;color:#34495e;${full?'grid-column:1/-1':''}">${label}${html}</label>`}
function openDrawer(mode,src){
 const isCreate=mode==='create'; const rec={...src}; const originalId=rec.id||''; rec.id=isCreate?'WO-DRAFT-'+Date.now().toString().slice(-9):rec.id; rec.sourceWorkOrderId=isCreate?originalId:(rec.sourceWorkOrderId||''); rec.status=isCreate?'Draft':(rec.status||'Draft'); rec.erp=isCreate?'Pending':(rec.erp||'Pending');
 const {b,d}=ensureDrawer();
 d.innerHTML=`<div style="height:100%;display:flex;flex-direction:column"><div style="display:flex;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid #d9e3ea;background:#f6fafc"><div><h2 style="margin:0;color:#153a5b">${isCreate?'Create Intelligent Work Order':'Update Work Order'}</h2><p style="margin:4px 0 0;color:#5e7180;font-size:12px">${esc(rec.id)}${isCreate&&originalId?' · Source '+esc(originalId):''}</p></div><button id="wo12-close" type="button" class="btn">Close</button></div><div id="wo12-form" style="padding:18px 20px;overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:14px;flex:1">
 ${fld('Work Order ID',`<input id="wo12-id" value="${esc(rec.id)}" readonly>`)}${fld('Source Work Order',`<input id="wo12-source" value="${esc(rec.sourceWorkOrderId||'')}" readonly>`)}${fld('Site',`<select id="wo12-plant">${plantOptions(rec.plant||'')}</select>`)}${fld('Asset',`<select id="wo12-asset">${assetOptionsHtml(rec.asset||'',rec.plant||'')}</select>`)}${fld('Maintenance Type',sel('wo12-type',['Predictive','Preventive','Corrective','Adaptive','Inspection'],rec.type||'Corrective'))}${fld('Priority',sel('wo12-priority',['Critical','High','Medium','Low'],rec.priority||'Medium'))}${fld('Status',sel('wo12-status',['Draft','Awaiting Approval','Approved','Ready to Schedule','Scheduled','In Progress','Completed','Closed'],rec.status||'Draft'))}${fld('Crew',`<select id="wo12-crew">${crewOptions(rec.crew||'')}</select>`)}${fld('Parts Status',sel('wo12-parts',['Ready','Awaiting Parts','Partially Available','Not Required'],rec.parts||'Not Required'))}${fld('Permit Status',sel('wo12-permit',['Ready','Awaiting Permit','Not Required'],rec.permit||'Not Required'))}${fld('Estimated Cost (₹)',`<input id="wo12-cost" type="number" min="0" step="1" value="${Number(rec.cost||0)}">`)}${fld('Generation Loss (MWh)',`<input id="wo12-loss" type="number" min="0" step="0.01" value="${Number(rec.loss||0)}">`)}${fld('Description',`<textarea id="wo12-desc" style="min-height:100px">${esc(rec.desc||'')}</textarea>`,true)}${fld(isCreate?'Creation Reason':'Update Reason',`<textarea id="wo12-reason" style="min-height:72px"></textarea>`,true)}</div><div style="display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid #d9e3ea"><button id="wo12-cancel" type="button" class="btn">Cancel</button><button id="wo12-save" type="button" class="btn primary">${isCreate?'Create Draft':'Save Update'}</button></div></div>`;
 d.querySelectorAll('input,select,textarea').forEach(x=>x.style.cssText='width:100%;box-sizing:border-box;border:1px solid #b7c8d3;border-radius:7px;padding:10px 11px;background:#fff;color:#172b3a');
 d.querySelector('#wo12-plant').addEventListener('change',function(){
  const assetSel=d.querySelector('#wo12-asset'); const keep=assetSel.value;
  assetSel.innerHTML=assetOptionsHtml('',this.value);
  if(keep && [...assetSel.options].some(o=>o.value===keep)) assetSel.value=keep;
 });
 b.style.display='block';d.style.display='block';document.body.style.overflow='hidden';
 d.querySelector('#wo12-close').onclick=closeDrawer;d.querySelector('#wo12-cancel').onclick=closeDrawer;
 d.querySelector('#wo12-save').onclick=function(){
   const get=id=>d.querySelector('#'+id)?.value??'';
   Object.assign(rec,{plant:get('wo12-plant'),plantName:get('wo12-plant'),asset:get('wo12-asset'),type:get('wo12-type'),priority:get('wo12-priority'),status:get('wo12-status'),crew:get('wo12-crew'),parts:get('wo12-parts'),permit:get('wo12-permit'),cost:Number(get('wo12-cost')||0),loss:Number(get('wo12-loss')||0),desc:get('wo12-desc')});
   const target=Array.isArray(window.ALL_WOS)?window.ALL_WOS:null;
   if(target){if(isCreate)target.unshift(rec);else{const i=target.findIndex(x=>String(x.id||x.Work_Order_ID)===String(originalId));if(i>=0)Object.assign(target[i],rec)}}
   closeDrawer(); render(); window.toast?.(isCreate?'Work order draft created':'Work order updated');
 };
 setTimeout(()=>d.querySelector('#wo12-plant')?.focus({preventScroll:true}),0);
}
function matches(r,q,status){return (status==='All'||String(r.status)===status)&&(!q||[r.id,r.plant,r.asset,r.type,r.priority,r.status,r.crew,r.parts,r.permit,r.erp,r.desc].join(' ').toLowerCase().includes(q))}
function applyFilter(){
 const table=document.getElementById('wo12-table'); if(!table)return; const q=(document.getElementById('wo12-search')?.value||'').trim().toLowerCase(); const status=document.getElementById('wo12-status-filter')?.value||'All'; S.search=q;S.status=status;let n=0;
 table.querySelectorAll('tbody tr[data-wo12-id]').forEach(tr=>{const rec=rows().find(r=>String(r.id)===tr.dataset.wo12Id);const show=rec&&matches(rec,q,status);tr.hidden=!show;if(show)n++});
 const count=document.getElementById('wo12-count');if(count)count.textContent=n+' work orders'; const clear=document.getElementById('wo12-clear');if(clear)clear.hidden=!q;
 updateSelectionUI();
}
function ledger(all){
 const selCount=S.selectedIds.size;
 const statuses=['Draft','Awaiting Approval','Approved','Ready to Schedule','Scheduled','In Progress','Completed','Closed'];
 return `<div class="ops-panel"><div class="ops-toolbar"><input id="wo12-search" type="search" autocomplete="off" spellcheck="false" placeholder="Search WO, asset, site, crew or status" value="${esc(S.search)}"><button id="wo12-clear" type="button" class="btn" ${S.search?'':'hidden'}>Clear</button><span id="wo12-count">${all.length} work orders</span><select id="wo12-status-filter"><option>All</option>${statuses.map(x=>`<option ${S.status===x?'selected':''}>${x}</option>`).join('')}</select><button id="wo12-create" type="button" class="btn primary">Create Work Order</button></div><div class="wo11-inline-note">Create Work Order opens immediately. Selecting a row is optional and only pre-fills context. Select multiple rows to apply a bulk status change.</div><div id="wo12-bulk-bar" style="display:${selCount?'flex':'none'};align-items:center;gap:10px;flex-wrap:wrap;background:#eef6ff;border:1px solid #bcdcff;padding:8px 12px;border-radius:8px;margin-top:8px"><b id="wo12-bulk-count">${selCount} selected</b><select id="wo12-bulk-status"><option value="">Change status to…</option>${statuses.map(x=>`<option value="${x}">${x}</option>`).join('')}</select><button id="wo12-bulk-apply" type="button" class="btn primary">Apply to selected</button><button id="wo12-bulk-clear" type="button" class="btn">Clear selection</button></div><div class="ops-table-wrap" style="margin-top:10px"><table id="wo12-table" class="ops-table"><thead><tr><th><input type="checkbox" id="wo12-select-all" title="Select all visible rows" ${selCount?'':''}></th><th>WO ID</th><th>Site / Asset</th><th>Type</th><th>Priority</th><th>Status</th><th>Crew</th><th>Parts</th><th>Permit</th><th>Loss</th><th>Cost</th><th>ERP</th><th>Action</th></tr></thead><tbody>${all.map(r=>`<tr data-wo12-id="${esc(r.id)}" class="${S.selectedIds.has(String(r.id))?'aip-wo-selected-row':''}"><td><input type="checkbox" class="wo12-row-select" data-id="${esc(r.id)}" ${S.selectedIds.has(String(r.id))?'checked':''}></td><td><button type="button" class="ops-link" data-wo12-update="${esc(r.id)}">${esc(r.id)}</button></td><td>${esc(r.plant)}<br><b>${esc(r.asset)}</b></td><td>${esc(r.type)}</td><td><span class="ops-status ${typeof opsPriority==='function'?opsPriority(r.priority):''}">${esc(r.priority)}</span></td><td><span class="ops-status info">${esc(r.status)}</span></td><td>${esc(r.crew||'Unassigned')}</td><td>${esc(r.parts)}</td><td>${esc(r.permit)}</td><td>${Number(r.loss||0)} MWh</td><td>₹${Number(r.cost||0).toLocaleString('en-IN')}</td><td>${esc(r.erp)}</td><td><button type="button" class="ops-action primary" data-wo12-update="${esc(r.id)}">Update</button></td></tr>`).join('')}</tbody></table></div></div>`}
function updateSelectionUI(){
 const table=document.getElementById('wo12-table'); if(!table)return;
 const bar=document.getElementById('wo12-bulk-bar'); const countEl=document.getElementById('wo12-bulk-count');
 if(bar) bar.style.display=S.selectedIds.size?'flex':'none';
 if(countEl) countEl.textContent=S.selectedIds.size+' selected';
 let visTotal=0, visChecked=0;
 table.querySelectorAll('tbody tr[data-wo12-id]').forEach(tr=>{
  const id=tr.dataset.wo12Id, checked=S.selectedIds.has(id), cb=tr.querySelector('.wo12-row-select');
  if(cb) cb.checked=checked;
  tr.classList.toggle('aip-wo-selected-row',checked);
  if(!tr.hidden){visTotal++; if(checked)visChecked++}
 });
 const all=document.getElementById('wo12-select-all');
 if(all){ all.checked = visTotal>0 && visChecked===visTotal; all.indeterminate = visChecked>0 && visChecked<visTotal; }
}
function stableKpis(all){
 const defs=[
  ['Open work orders',all.filter(r=>!['Closed','Completed'].includes(r.status)).length,'WOs','#1976d2'],
  ['Critical priority',all.filter(r=>r.priority==='Critical').length,'WOs','#d32f2f'],
  ['Overdue actions',all.filter(r=>r.overdue).length,'WOs','#ef8f00'],
  ['Ready to schedule',all.filter(r=>r.parts==='Ready'&&r.permit==='Ready'&&!r.crew).length,'WOs','#7b1fa2'],
  ['SLA at risk',all.filter(r=>r.slaRisk).length,'WOs','#c62828'],
  ['ERP/EAM pending',all.filter(r=>['Pending','Failed'].includes(r.erp)).length,'WOs','#00838f']
 ];
 return `<div class="wo213-kpis">${defs.map(d=>`<div class="wo213-kpi" style="--wo213-accent:${d[3]}"><div class="wo213-label">${esc(d[0])}</div><div class="wo213-value">${d[1]}<span>${esc(d[2])}</span></div><div class="wo213-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div></div>`).join('')}</div>`;
}
function render(){
 const el=view(); if(!el) return;
 const desired=window.AIP_WO_DESIRED_TAB;
 if(['command','ledger','lifecycle','exceptions','audit','erp'].includes(desired)) S.tab=desired;
 const all=rows();
 const tabDefs=[['command','Command Centre'],['ledger','Work Order Ledger'],['lifecycle','Lifecycle & Status'],['exceptions','Approvals & Exceptions'],['audit','Status & Audit Ledger'],['erp','ERP/EAM Transaction Status']];
 const tabsHtml=`<div class="ops-tabs">${tabDefs.map(t=>`<button class="ops-tab ${S.tab===t[0]?'active':''}" type="button" data-wo12-tab="${t[0]}">${t[1]}</button>`).join('')}</div>`;
 let body;
 if(S.tab==='command') body = typeof opsWOCommand==='function'?opsWOCommand(all):'';
 else if(S.tab==='lifecycle') body = typeof opsWOLifecycle==='function'?opsWOLifecycle(all):'';
 else if(S.tab==='exceptions') body = typeof opsWOExceptions==='function'?opsWOExceptions(all):'';
 else if(S.tab==='audit') body = typeof opsWOAudit==='function'?opsWOAudit():'';
 else if(S.tab==='erp') body = typeof opsWOERP==='function'?opsWOERP(all):'';
 else body = ledger(all);
 el.innerHTML=`<div class="view-head"><div><div class="eyebrow" style="color:#198754">MAINTENANCE STRATEGY & EXECUTION</div><h1>Work Order Intelligence</h1></div></div>${stableKpis(all)}${tabsHtml}${body}`;
 if(S.tab==='ledger') applyFilter();
}
// One permanent capture listener. It survives every application rerender.
document.addEventListener('click',function(e){
 const tabBtn=e.target.closest('.ops-tab[data-wo12-tab]'); if(tabBtn){window.AIP_WO_DESIRED_TAB=tabBtn.dataset.wo12Tab;S.tab=tabBtn.dataset.wo12Tab;render();return}
 const create=e.target.closest('#wo12-create'); if(create){e.preventDefault();e.stopImmediatePropagation();const src=firstSelectedSource()||{id:'',plant:'',asset:'',type:'Corrective',priority:'Medium',status:'Draft',crew:'',parts:'Not Required',permit:'Not Required',cost:0,loss:0,desc:''};openDrawer('create',{...src});return}
 const upd=e.target.closest('[data-wo12-update]'); if(upd){e.preventDefault();e.stopImmediatePropagation();const rec=rows().find(r=>String(r.id)===String(upd.dataset.wo12Update));if(rec)openDrawer('update',{...rec});return}
 const bulkClear=e.target.closest('#wo12-bulk-clear'); if(bulkClear){S.selectedIds.clear();updateSelectionUI();return}
 const bulkApply=e.target.closest('#wo12-bulk-apply'); if(bulkApply){
  const statusSel=document.getElementById('wo12-bulk-status'); const newStatus=statusSel?.value;
  if(!newStatus){window.toast?.('Choose a status to apply first');return}
  const target=Array.isArray(window.ALL_WOS)?window.ALL_WOS:null; let n=0;
  if(target){ S.selectedIds.forEach(id=>{ const rec=target.find(x=>String(x.id||x.Work_Order_ID)===String(id)); if(rec){rec.status=newStatus;rec.erp='Pending';n++} }); }
  S.selectedIds.clear(); render();
  window.toast?.(`Updated status for ${n} work order${n===1?'':'s'}`);
  return;
 }
 const row=e.target.closest('#wo12-table tbody tr[data-wo12-id]');
 if(row && !e.target.closest('.wo12-row-select,[data-wo12-update],.ops-link')){
  const id=row.dataset.wo12Id;
  if(S.selectedIds.has(id)) S.selectedIds.delete(id); else S.selectedIds.add(id);
  updateSelectionUI();
  return;
 }
 const clear=e.target.closest('#wo12-clear'); if(clear){const input=document.getElementById('wo12-search');if(input){input.value='';input.focus()}applyFilter();return}
},true);
document.addEventListener('input',function(e){if(e.target.id==='wo12-search')applyFilter()},true);
document.addEventListener('change',function(e){
 if(e.target.id==='wo12-status-filter'){applyFilter();return}
 if(e.target.id==='wo12-select-all'){
  const table=document.getElementById('wo12-table'); if(!table)return; const checked=e.target.checked;
  table.querySelectorAll('tbody tr[data-wo12-id]:not([hidden])').forEach(tr=>{const id=tr.dataset.wo12Id; if(checked) S.selectedIds.add(id); else S.selectedIds.delete(id);});
  updateSelectionUI();
  return;
 }
 if(e.target.classList && e.target.classList.contains('wo12-row-select')){
  const id=e.target.dataset.id;
  if(e.target.checked) S.selectedIds.add(id); else S.selectedIds.delete(id);
  updateSelectionUI();
  return;
 }
},true);
document.addEventListener('keydown',function(e){if(e.key==='Escape'){if(document.getElementById('aipWo12Drawer')?.style.display==='block')closeDrawer();else if(document.activeElement?.id==='wo12-search'){document.activeElement.value='';applyFilter()}}},true);
window.__AIP_WO_STABLE_RENDER=render; window.renderWorkOrderIntelligence=render; window.opsWOTab=render; window.opsCreateWO=function(){const src=firstSelectedSource()||{id:'',plant:'',asset:'',type:'Corrective',priority:'Medium',status:'Draft',crew:'',parts:'Not Required',permit:'Not Required',cost:0,loss:0,desc:''};openDrawer('create',{...src});return false}; window.opsOpenWO=function(id){const rec=rows().find(r=>String(r.id)===String(id));if(rec)openDrawer('update',{...rec})};
const nav=document.querySelector('[data-view="workorderintelligence"]');if(nav?.classList.contains('active'))setTimeout(render,0);
// v2.13: legacy router delegates synchronously to the authoritative renderer; delayed repaint removed.
})();
