
(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const norm=v=>String(v??'').toLowerCase().replace(/\s+/g,' ').trim();
let selectedId=window.AIP_WO_CREATE_SOURCE||null;
let searchTimer=0;
let originalRender=window.renderWorkOrderIntelligence;
let pendingRender=false;

function dataRows(){try{return typeof opsWOs==='function'?opsWOs():[]}catch(e){console.error(e);return[]}}
function ensurePortal(){
  let b=document.getElementById('aipV8WoBackdrop');
  if(!b){b=document.createElement('div');b.id='aipV8WoBackdrop';document.body.appendChild(b);b.addEventListener('click',closeDrawer)}
  let d=document.getElementById('aipV8WoDrawer');
  if(!d){d=document.createElement('aside');d.id='aipV8WoDrawer';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.setAttribute('aria-hidden','true');document.body.appendChild(d)}
  return {b,d};
}
function closeDrawer(){const {b,d}=ensurePortal();b.classList.remove('open');d.classList.remove('open');d.setAttribute('aria-hidden','true');document.body.classList.remove('aip-v8-wo-open')}
window.closeAipWO=closeDrawer;

function renderDrawer(w,isNew){
 const {b,d}=ensurePortal();
 d.innerHTML=`<div id="aipV8WoDrawerHeader"><div><h2>${isNew?'Create Intelligent Work Order':'Update Intelligent Work Order'}</h2><p>${esc(w.id)}${w.sourceWorkOrderId?' · Source '+esc(w.sourceWorkOrderId):''}</p></div><button id="aipV8WoClose" type="button" aria-label="Close">×</button></div>
 <form id="aipV8WoForm" autocomplete="off">
  <label>Work Order ID<input id="v8woId" value="${esc(w.id)}" readonly></label>
  <label>Source Work Order<input id="v8woSource" value="${esc(w.sourceWorkOrderId||'')}" readonly></label>
  <label>Site<input id="v8woPlant" value="${esc(w.plant||'')}"></label>
  <label>Asset<input id="v8woAsset" value="${esc(w.asset||'')}"></label>
  <label>Maintenance Type<select id="v8woType">${['Predictive','Preventive','Corrective','Adaptive','Inspection'].map(x=>`<option ${x===w.type?'selected':''}>${x}</option>`).join('')}</select></label>
  <label>Priority<select id="v8woPriority">${['Critical','High','Medium','Low'].map(x=>`<option ${x===w.priority?'selected':''}>${x}</option>`).join('')}</select></label>
  <label>Status<select id="v8woStatus">${['Recommended','Draft','Awaiting Approval','Approved','Ready to Schedule','Scheduled','Dispatched','In Progress','Completed','Verified','ERP Closed'].map(x=>`<option ${x===w.status?'selected':''}>${x}</option>`).join('')}</select></label>
  <label>Crew<input id="v8woCrew" value="${esc(w.crew||'')}"></label>
  <label>Parts Status<select id="v8woParts">${['Ready','Awaiting Parts','Partially Available','Not Required'].map(x=>`<option ${x===w.parts?'selected':''}>${x}</option>`).join('')}</select></label>
  <label>Permit Status<select id="v8woPermit">${['Ready','Awaiting Permit','Not Required'].map(x=>`<option ${x===w.permit?'selected':''}>${x}</option>`).join('')}</select></label>
  <label>Estimated Cost (₹)<input id="v8woCost" type="number" min="0" step="1" value="${Number(w.cost||0)}"></label>
  <label>Generation Loss (MWh)<input id="v8woLoss" type="number" min="0" step="0.01" value="${Number(w.loss||0)}"></label>
  <label class="full">Description<textarea id="v8woDesc">${esc(w.desc||'')}</textarea></label>
  <label class="full">Decision / Update Reason<textarea id="v8woReason" placeholder="Enter the reason for this work-order decision or update"></textarea></label>
 </form>
 <div id="aipV8WoFooter"><button id="aipV8WoCancel" type="button">Cancel</button><button id="aipV8WoSave" class="primary" type="button">${isNew?'Create Draft':'Save Update'}</button></div>`;
 d.dataset.woId=w.id;d.dataset.isNew=isNew?'1':'0';
 b.classList.add('open');d.classList.add('open');d.setAttribute('aria-hidden','false');document.body.classList.add('aip-v8-wo-open');
 document.getElementById('aipV8WoClose').onclick=closeDrawer;document.getElementById('aipV8WoCancel').onclick=closeDrawer;document.getElementById('aipV8WoSave').onclick=saveDrawer;
 setTimeout(()=>document.getElementById('v8woPlant')?.focus({preventScroll:true}),0);
}
function saveDrawer(){
 const d=document.getElementById('aipV8WoDrawer');if(!d)return;
 const id=d.dataset.woId;const w=dataRows().find(x=>x.id===id);if(!w)return;
 const prev=w.status;
 w.plant=document.getElementById('v8woPlant').value.trim();w.asset=document.getElementById('v8woAsset').value.trim();w.type=document.getElementById('v8woType').value;w.priority=document.getElementById('v8woPriority').value;w.status=document.getElementById('v8woStatus').value;w.crew=document.getElementById('v8woCrew').value.trim();w.parts=document.getElementById('v8woParts').value;w.permit=document.getElementById('v8woPermit').value;w.cost=Number(document.getElementById('v8woCost').value||0);w.loss=Number(document.getElementById('v8woLoss').value||0);w.desc=document.getElementById('v8woDesc').value.trim();w.erp='Pending';
 if(window.OPS_WO?.audit)OPS_WO.audit.push({time:new Date().toLocaleString(),id,prev,next:w.status,actor:'Planner',reason:document.getElementById('v8woReason').value.trim()||'Work order saved'});
 closeDrawer();selectedId=null;window.AIP_WO_CREATE_SOURCE=null;
 if(typeof originalRender==='function')originalRender();
 window.toast?.(d.dataset.isNew==='1'?'Work order draft created':'Work order updated');
}
window.opsOpenWO=function(id){const w=dataRows().find(x=>x.id===id);if(!w){window.toast?.('Work order not found');return}renderDrawer(w,false)};
window.opsCreateWO=function(){
 const sourceId=selectedId||window.AIP_WO_CREATE_SOURCE;if(!sourceId){window.toast?.('Select one source row first');return}
 const src=dataRows().find(x=>x.id===sourceId);if(!src){window.toast?.('Selected source row is unavailable');return}
 let id;do{id='WO-'+Math.floor(7000+Math.random()*2000)}while(dataRows().some(x=>x.id===id));
 const draft={...src,id,status:'Draft',erp:'Pending',erpId:'',crew:'',sourceWorkOrderId:src.id,desc:'Draft created from '+src.id+': '+(src.desc||'maintenance requirement')};
 if(Array.isArray(window.ALL_WOS))window.ALL_WOS.unshift(draft);else try{ALL_WOS.unshift(draft)}catch(_){return}
 renderDrawer(draft,true);
};

function syncSelection(){window.AIP_WO_CREATE_SOURCE=selectedId;document.querySelectorAll('#aipWoLedgerTable tbody tr[data-wo-id]').forEach(tr=>{const on=tr.dataset.woId===selectedId;tr.classList.toggle('aip-wo-selected-row',on);const r=tr.querySelector('input[type=radio]');if(r)r.checked=on});const btn=document.getElementById('aipCreateWoButton');if(btn){btn.disabled=!selectedId;btn.textContent=selectedId?'Create Work Order from '+selectedId:'Select a Row to Create Work Order'}const n=document.getElementById('aipWoSelectionNote');if(n)n.textContent=selectedId?'Selected source: '+selectedId+'. Click Create Work Order to generate a new draft.':'Select exactly one source row below.'}
window.aipSelectWoSource=id=>{selectedId=id||null;syncSelection()};
function filterRows(value){const q=norm(value);if(window.OPS_WO)OPS_WO.search=value||'';let shown=0,total=0;document.querySelectorAll('#aipWoLedgerTable tbody tr[data-wo-search]').forEach(tr=>{total++;const ok=!q||norm(tr.dataset.woSearch).includes(q);tr.hidden=!ok;if(ok)shown++});const c=document.getElementById('aipWoLedgerMatchCount');if(c)c.textContent=shown+' of '+total+' work orders';const x=document.getElementById('aipWoLedgerClear');if(x)x.hidden=!q}
function clearSearch(){clearTimeout(searchTimer);const i=document.getElementById('aipWoLedgerSearch');if(i){i.value='';filterRows('');i.focus({preventScroll:true})}}

window.opsWOLedger=function(data){const sv=window.OPS_WO?.search||'';return `<div class="ops-panel"><div class="ops-toolbar"><div id="aipWoLedgerSearchWrap"><input id="aipWoLedgerSearch" type="search" autocomplete="off" spellcheck="false" placeholder="Search WO, asset, site, type or status" value="${esc(sv)}"><button id="aipWoLedgerClear" type="button" class="btn" ${sv?'':'hidden'}>Clear</button><span id="aipWoLedgerMatchCount">${data.length} work orders</span></div><select id="aipWoStatusFilter"><option>All</option>${['Draft','Awaiting Approval','Approved','Ready to Schedule','Scheduled','In Progress','Completed','Closed'].map(x=>`<option ${window.OPS_WO?.filter===x?'selected':''}>${x}</option>`).join('')}</select><button id="aipCreateWoButton" type="button" class="btn primary" ${selectedId?'':'disabled'}>${selectedId?'Create Work Order from '+esc(selectedId):'Select a Row to Create Work Order'}</button></div><div id="aipWoSelectionNote" class="aip-wo-selection-note">${selectedId?'Selected source: '+esc(selectedId)+'. Click Create Work Order to generate a new draft.':'Select exactly one source row below.'}</div><div class="ops-table-wrap" style="margin-top:10px"><table id="aipWoLedgerTable" class="ops-table"><thead><tr><th>Select</th><th>WO ID</th><th>Site / Asset</th><th>Type</th><th>Priority</th><th>Status</th><th>Crew</th><th>Parts</th><th>Permit</th><th>Loss</th><th>Cost</th><th>ERP</th><th>Action</th></tr></thead><tbody>${data.map(w=>{const hay=esc([w.id,w.plant,w.asset,w.type,w.priority,w.status,w.crew,w.parts,w.permit,w.erp,w.desc].join(' ').toLowerCase());return `<tr data-wo-id="${esc(w.id)}" data-wo-search="${hay}" class="${selectedId===w.id?'aip-wo-selected-row':''}"><td><input type="radio" name="aipWoCreateSource" value="${esc(w.id)}" ${selectedId===w.id?'checked':''}></td><td><button type="button" class="ops-link" data-v8-open="${esc(w.id)}">${esc(w.id)}</button></td><td>${esc(w.plant)}<br><b>${esc(w.asset)}</b></td><td>${esc(w.type)}</td><td><span class="ops-status ${opsPriority(w.priority)}">${esc(w.priority)}</span></td><td><span class="ops-status info">${esc(w.status)}</span></td><td>${esc(w.crew||'Unassigned')}</td><td>${esc(w.parts)}</td><td>${esc(w.permit)}</td><td>${Number(w.loss||0)} MWh</td><td>₹${Number(w.cost||0).toLocaleString('en-IN')}</td><td>${esc(w.erp)}</td><td><button type="button" class="ops-action primary" data-v8-open="${esc(w.id)}">Update</button></td></tr>`}).join('')}</tbody></table></div></div>`};

// Never rebuild the WO screen while the user is typing in its search field.
window.renderWorkOrderIntelligence=function(){const a=document.activeElement;if(a&&a.id==='aipWoLedgerSearch'){pendingRender=true;return}return originalRender?.apply(this,arguments)};

document.addEventListener('input',e=>{if(e.target.id==='aipWoLedgerSearch'){clearTimeout(searchTimer);const v=e.target.value;searchTimer=setTimeout(()=>filterRows(v),60)}},true);
document.addEventListener('keydown',e=>{if(e.target.id==='aipWoLedgerSearch'&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();clearSearch()}else if(e.key==='Escape'&&document.getElementById('aipV8WoDrawer')?.classList.contains('open')){e.preventDefault();closeDrawer()}},true);
document.addEventListener('focusout',e=>{if(e.target.id==='aipWoLedgerSearch'&&pendingRender){pendingRender=false;setTimeout(()=>originalRender?.(),0)}},true);
document.addEventListener('click',e=>{const clear=e.target.closest('#aipWoLedgerClear');if(clear){e.preventDefault();e.stopImmediatePropagation();return clearSearch()}const create=e.target.closest('#aipCreateWoButton');if(create){e.preventDefault();e.stopImmediatePropagation();return window.opsCreateWO()}const open=e.target.closest('[data-v8-open]');if(open){e.preventDefault();e.stopImmediatePropagation();return window.opsOpenWO(open.dataset.v8Open)}const tr=e.target.closest('#aipWoLedgerTable tbody tr[data-wo-id]');if(tr){e.preventDefault();e.stopImmediatePropagation();selectedId=tr.dataset.woId;return syncSelection()}},true);
document.addEventListener('change',e=>{if(e.target.id==='aipWoStatusFilter'){e.stopImmediatePropagation();if(window.OPS_WO){OPS_WO.filter=e.target.value;OPS_WO.search=''}selectedId=null;originalRender?.()}if(e.target.matches('#aipWoLedgerTable input[type=radio]')){e.stopImmediatePropagation();selectedId=e.target.value;syncSelection()}},true);
})();
