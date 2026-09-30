
(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
let selectedId=window.AIP_WO_CREATE_SOURCE||'';
let sourceMap={};
let activeDraft=null;
function allRows(){try{return typeof opsWOs==='function'?opsWOs():[]}catch(_){return []}}
function ensureDrawer(){
 let b=document.getElementById('aipV10WoBackdrop');
 if(!b){b=document.createElement('div');b.id='aipV10WoBackdrop';document.body.appendChild(b)}
 let d=document.getElementById('aipV10WoDrawer');
 if(!d){d=document.createElement('aside');d.id='aipV10WoDrawer';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');document.body.appendChild(d)}
 b.onclick=closeDrawer;return {b,d};
}
function closeDrawer(){const {b,d}=ensureDrawer();b.classList.remove('open');d.classList.remove('open');d.innerHTML='';document.body.style.overflow='';activeDraft=null}
function crewOptions(current){
 const vals=new Set(['CREW-N-1','CREW-N-2','CREW-N-3','CREW-W-1','CREW-W-2','CREW-W-3','CREW-S-1','CREW-S-2','CREW-C-1']);
 allRows().forEach(x=>{if(x.crew)vals.add(String(x.crew))});if(current)vals.add(String(current));
 return '<option value="">Select crew</option>'+[...vals].sort().map(v=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(v)}</option>`).join('');
}
function sel(id,items,value){return `<select id="${id}">${items.map(x=>`<option value="${esc(x)}" ${x===value?'selected':''}>${esc(x)}</option>`).join('')}</select>`}
function fld(label,control,full){return `<label style="${full?'grid-column:1/-1':''}">${label}${control}</label>`}
function openCreate(source){
 const id='WO-DRAFT-'+Date.now().toString().slice(-8);
 activeDraft={...source,id,status:'Draft',erp:'Pending',erpId:'',sourceWorkOrderId:source.id,crew:source.crew||'',desc:'Draft created from '+source.id+': '+(source.desc||'maintenance requirement')};
 const {b,d}=ensureDrawer();
 d.innerHTML=`<div class="v10-shell"><div style="display:flex;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid #d9e3ea;background:#f7fbfd"><div><h2 style="margin:0;color:#153a5b">Create Intelligent Work Order</h2><p style="margin:4px 0 0;color:#5e7180;font-size:12px">${esc(id)} · Source ${esc(source.id)}</p></div><button id="v10Close" type="button" style="border:0;background:#e8f1f5;border-radius:8px;width:36px;height:36px;font-size:23px;cursor:pointer">×</button></div>
 <form id="v10Form" style="padding:18px 20px;overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:14px;flex:1">
 ${fld('Work Order ID',`<input id="v10Id" value="${esc(id)}" readonly>`)}
 ${fld('Source Work Order',`<input id="v10Source" value="${esc(source.id)}" readonly>`)}
 ${fld('Site',`<input id="v10Plant" value="${esc(source.plant||'')}">`)}
 ${fld('Asset',`<input id="v10Asset" value="${esc(source.asset||'')}">`)}
 ${fld('Maintenance Type',sel('v10Type',['Predictive','Preventive','Corrective','Adaptive','Inspection'],source.type))}
 ${fld('Priority',sel('v10Priority',['Critical','High','Medium','Low'],source.priority))}
 ${fld('Status',sel('v10Status',['Draft','Awaiting Approval','Approved','Ready to Schedule','Scheduled'], 'Draft'))}
 ${fld('Crew',`<select id="v10Crew">${crewOptions(source.crew||'')}</select>`)}
 ${fld('Parts Status',sel('v10Parts',['Ready','Awaiting Parts','Partially Available','Not Required'],source.parts))}
 ${fld('Permit Status',sel('v10Permit',['Ready','Awaiting Permit','Not Required'],source.permit))}
 ${fld('Estimated Cost (₹)',`<input id="v10Cost" type="number" min="0" step="1" value="${Number(source.cost||0)}">`)}
 ${fld('Generation Loss (MWh)',`<input id="v10Loss" type="number" min="0" step="0.01" value="${Number(source.loss||0)}">`)}
 ${fld('Description',`<textarea id="v10Desc" style="min-height:92px">${esc(activeDraft.desc)}</textarea>`,true)}
 ${fld('Creation Reason',`<textarea id="v10Reason" style="min-height:72px" placeholder="Enter why this work order is being created"></textarea>`,true)}
 </form><div style="display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid #d9e3ea"><button id="v10Cancel" type="button" class="btn">Cancel</button><button id="v10CreateDraft" type="button" class="btn primary">Create Draft</button></div></div>`;
 b.classList.add('open');d.classList.add('open');document.body.style.overflow='hidden';
 d.querySelector('#v10Close').onclick=closeDrawer;d.querySelector('#v10Cancel').onclick=closeDrawer;d.querySelector('#v10CreateDraft').onclick=saveDraft;
 setTimeout(()=>d.querySelector('#v10Plant')?.focus({preventScroll:true}),0);
}
function val(id){return document.getElementById(id)?.value??''}
function saveDraft(){
 if(!activeDraft)return;
 Object.assign(activeDraft,{plant:val('v10Plant'),asset:val('v10Asset'),type:val('v10Type'),priority:val('v10Priority'),status:val('v10Status'),crew:val('v10Crew'),parts:val('v10Parts'),permit:val('v10Permit'),cost:Number(val('v10Cost')||0),loss:Number(val('v10Loss')||0),desc:val('v10Desc'),erp:'Pending'});
 const reason=val('v10Reason')||'Draft created from '+activeDraft.sourceWorkOrderId;
 activeDraft.aipDecisionLog=[...(activeDraft.aipDecisionLog||[]),{time:new Date().toLocaleString(),actor:'Planner',action:'Draft created',detail:reason}];
 let target=null;try{if(Array.isArray(ALL_WOS))target=ALL_WOS}catch(_){ }if(!target&&Array.isArray(window.ALL_WOS))target=window.ALL_WOS;
 if(target&&!target.some(x=>x.id===activeDraft.id))target.unshift(activeDraft);
 closeDrawer();window.renderWorkOrderIntelligence?.();window.toast?.('Work order draft created');
}
function syncSelection(id){selectedId=id||'';window.AIP_WO_CREATE_SOURCE=selectedId;document.querySelectorAll('#aipWoLedgerTable tbody tr[data-wo-id]').forEach(tr=>{const on=tr.dataset.woId===selectedId;tr.classList.toggle('aip-wo-selected-row',on);const r=tr.querySelector('input[type=radio]');if(r)r.checked=on});const btn=document.getElementById('aipCreateWoButton');if(btn){btn.disabled=!selectedId;btn.textContent=selectedId?'Create Work Order from '+selectedId:'Select a Row to Create Work Order'}const n=document.getElementById('aipWoSelectionNote');if(n)n.textContent=selectedId?'Selected source: '+selectedId+'. Click Create Work Order to open a new draft.':'Select exactly one source row below.'}
window.aipV10SelectSource=function(id){syncSelection(id)};
window.aipV10CreateWO=function(){
 const id=selectedId||window.AIP_WO_CREATE_SOURCE||document.querySelector('#aipWoLedgerTable input[name="aipWoCreateSource"]:checked')?.value||'';
 const src=sourceMap[id]||allRows().find(x=>String(x.id)===String(id));
 if(!id||!src){window.toast?.('Select one source row first');return false}
 openCreate({...src});return false;
};
window.opsCreateWO=window.aipV10CreateWO;
const priorLedger=window.opsWOLedger;
window.opsWOLedger=function(data){
 sourceMap={};data.forEach(x=>sourceMap[String(x.id)]=x);
 const html=priorLedger(data);
 setTimeout(()=>{const btn=document.getElementById('aipCreateWoButton');if(btn){btn.onclick=window.aipV10CreateWO;btn.type='button'}document.querySelectorAll('#aipWoLedgerTable tbody tr[data-wo-id]').forEach(tr=>{tr.onclick=()=>syncSelection(tr.dataset.woId);const r=tr.querySelector('input[type=radio]');if(r)r.onclick=e=>{e.stopPropagation();syncSelection(r.value)}})},0);
 return html;
};
// Capture before all legacy handlers and terminate the event after executing v10.
document.addEventListener('click',function(e){
 const btn=e.target.closest?.('#aipCreateWoButton');if(btn){e.preventDefault();e.stopImmediatePropagation();window.aipV10CreateWO();return}
 const radio=e.target.closest?.('#aipWoLedgerTable input[name="aipWoCreateSource"]');if(radio){e.stopImmediatePropagation();syncSelection(radio.value);return}
 const row=e.target.closest?.('#aipWoLedgerTable tbody tr[data-wo-id]');if(row&&!e.target.closest('[data-v8-open],[data-open-wo],.aip-open-wo,.ops-action,.ops-link')){e.preventDefault();e.stopImmediatePropagation();syncSelection(row.dataset.woId)}
},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('aipV10WoDrawer')?.classList.contains('open')){e.preventDefault();e.stopImmediatePropagation();closeDrawer()}},true);
})();
