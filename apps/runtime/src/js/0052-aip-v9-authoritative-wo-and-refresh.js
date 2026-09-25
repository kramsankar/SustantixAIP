
(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const rows=()=>{try{return typeof opsWOs==='function'?opsWOs():[]}catch(e){console.error(e);return[]}};
let activeWO=null,activeIsNew=false;

function crewOptions(current){
 const vals=new Set();
 const add=v=>{v=String(v||'').trim();if(v)vals.add(v)};
 try{(CREW_ROSTER||[]).forEach(x=>add(x.crew||x.Crew_ID||x.crewId||x.team||x.Team_ID))}catch(_){ }
 try{(CREW_ASSIGNMENTS||[]).forEach(x=>add(x.crew||x.Crew_ID||x.crewId))}catch(_){ }
 rows().forEach(x=>add(x.crew)); add(current);
 if(!vals.size)['CREW-N-1','CREW-N-2','CREW-N-3','CREW-S-1','CREW-S-2','CREW-W-1','CREW-W-2','O&M-North-1','O&M-South-1'].forEach(add);
 return ['<option value="">Select crew</option>',...[...vals].sort().map(v=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(v)}</option>`)].join('');
}
function ensure(){
 let b=document.getElementById('aipV9WoBackdrop');if(!b){b=document.createElement('div');b.id='aipV9WoBackdrop';b.style.cssText='display:none;position:fixed;inset:0 720px 0 0;background:rgba(15,23,42,.40);z-index:2147483638';document.body.appendChild(b)}
 let d=document.getElementById('aipV9WoDrawer');if(!d){d=document.createElement('aside');d.id='aipV9WoDrawer';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.style.cssText='position:fixed;top:0;right:0;width:min(720px,96vw);height:100vh;background:#fff;z-index:2147483640;box-shadow:-12px 0 34px rgba(15,23,42,.28);transform:translateX(105%);transition:transform .18s ease;display:flex;flex-direction:column;pointer-events:auto';document.body.appendChild(d)}
 b.onclick=close;return{b,d};
}
function close(){const {b,d}=ensure();b.style.display='none';d.style.transform='translateX(105%)';document.body.style.overflow='';activeWO=null;activeIsNew=false}
function open(w,isNew){
 activeWO=w;activeIsNew=!!isNew;const {b,d}=ensure();
 d.innerHTML=`<div style="display:flex;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid #d9e3ea;background:#f7fbfd"><div><h2 style="margin:0;color:#153a5b">${isNew?'Create Intelligent Work Order':'Update Intelligent Work Order'}</h2><p style="margin:4px 0 0;color:#5e7180;font-size:12px">${esc(w.id)}${w.sourceWorkOrderId?' · Source '+esc(w.sourceWorkOrderId):''}</p></div><button id="v9Close" type="button" style="border:0;background:#e8f1f5;border-radius:8px;width:36px;height:36px;font-size:23px;cursor:pointer">×</button></div>
 <form id="v9Form" autocomplete="off" style="padding:18px 20px;overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:14px;flex:1">
 ${field('Work Order ID',`<input id="v9Id" value="${esc(w.id)}" readonly>`)}
 ${field('Source Work Order',`<input id="v9Source" value="${esc(w.sourceWorkOrderId||'')}" readonly>`)}
 ${field('Site',`<input id="v9Plant" value="${esc(w.plant||'')}">`)}
 ${field('Asset',`<input id="v9Asset" value="${esc(w.asset||'')}">`)}
 ${field('Maintenance Type',select('v9Type',['Predictive','Preventive','Corrective','Adaptive','Inspection'],w.type))}
 ${field('Priority',select('v9Priority',['Critical','High','Medium','Low'],w.priority))}
 ${field('Status',select('v9Status',['Recommended','Draft','Awaiting Approval','Approved','Ready to Schedule','Scheduled','Dispatched','In Progress','Completed','Verified','ERP Closed'],w.status))}
 ${field('Crew',`<select id="v9Crew">${crewOptions(w.crew||'')}</select>`)}
 ${field('Parts Status',select('v9Parts',['Ready','Awaiting Parts','Partially Available','Not Required'],w.parts))}
 ${field('Permit Status',select('v9Permit',['Ready','Awaiting Permit','Not Required'],w.permit))}
 ${field('Estimated Cost (₹)',`<input id="v9Cost" type="number" min="0" step="1" value="${Number(w.cost||0)}">`)}
 ${field('Generation Loss (MWh)',`<input id="v9Loss" type="number" min="0" step="0.01" value="${Number(w.loss||0)}">`)}
 ${field('Description',`<textarea id="v9Desc" style="min-height:92px">${esc(w.desc||'')}</textarea>`,true)}
 ${field('Decision / Update Reason',`<textarea id="v9Reason" style="min-height:72px" placeholder="Enter the reason for this work-order decision or update"></textarea>`,true)}
 </form><div style="display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid #d9e3ea"><button id="v9Cancel" type="button" class="btn">Cancel</button><button id="v9Save" type="button" class="btn primary">${isNew?'Create Draft':'Save Update'}</button></div>`;
 d.querySelectorAll('input,select,textarea').forEach(el=>{el.style.cssText+=';width:100%;box-sizing:border-box;border:1px solid #b7c8d3;border-radius:7px;padding:10px 11px;background:#fff;color:#172b3a'});
 b.style.display='block';d.style.transform='translateX(0)';document.body.style.overflow='hidden';
 d.querySelector('#v9Close').onclick=close;d.querySelector('#v9Cancel').onclick=close;d.querySelector('#v9Save').onclick=save;
 setTimeout(()=>d.querySelector(isNew?'#v9Plant':'#v9Crew')?.focus({preventScroll:true}),0);
}
function field(label,control,full=false){return `<label style="display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:700;color:#34495e;${full?'grid-column:1/-1':''}">${label}${control}</label>`}
function select(id,opts,val){return `<select id="${id}">${opts.map(x=>`<option value="${esc(x)}" ${x===val?'selected':''}>${esc(x)}</option>`).join('')}</select>`}
function read(){return {plant:q('v9Plant'),asset:q('v9Asset'),type:q('v9Type'),priority:q('v9Priority'),status:q('v9Status'),crew:q('v9Crew'),parts:q('v9Parts'),permit:q('v9Permit'),cost:Number(q('v9Cost')||0),loss:Number(q('v9Loss')||0),desc:q('v9Desc')}}
function q(id){return document.getElementById(id)?.value?.trim?.()??document.getElementById(id)?.value??''}
function save(){
 if(!activeWO)return;Object.assign(activeWO,read(),{erp:'Pending'});
 const reason=q('v9Reason')|| (activeIsNew?'Draft created':'Work order updated');
 activeWO.aipDecisionLog=Array.isArray(activeWO.aipDecisionLog)?activeWO.aipDecisionLog:[];activeWO.aipDecisionLog.push({time:new Date().toLocaleString(),actor:'Planner',action:activeIsNew?'Draft created':'Work order updated',detail:reason});
 if(activeIsNew){
   let added=false;try{if(Array.isArray(ALL_WOS)&&!ALL_WOS.includes(activeWO)){ALL_WOS.unshift(activeWO);added=true}}catch(_){ }
   if(!added&&Array.isArray(window.ALL_WOS)&&!window.ALL_WOS.includes(activeWO))window.ALL_WOS.unshift(activeWO);
 }
 const msg=activeIsNew?'Work order draft created':'Work order updated';close();window.renderWorkOrderIntelligence?.();window.toast?.(msg);
}
window.opsOpenWO=function(id){const w=rows().find(x=>x.id===id);if(!w){window.toast?.('Work order not found');return}open(w,false)};
window.opsCreateWO=function(){
 const sourceId=window.AIP_WO_CREATE_SOURCE||document.querySelector('#aipWoLedgerTable input[name="aipWoCreateSource"]:checked')?.value;
 if(!sourceId){window.toast?.('Select one source row first');return}
 const src=rows().find(x=>x.id===sourceId);if(!src){window.toast?.('Selected source row is unavailable');return}
 let id,n=1;do{id='WO-DRAFT-'+String(Date.now()).slice(-6)+(n>1?'-'+n:'');n++}while(rows().some(x=>x.id===id));
 const draft={...src,id,status:'Draft',erp:'Pending',erpId:'',sourceWorkOrderId:src.id,crew:src.crew||'',desc:'Draft created from '+src.id+': '+(src.desc||'maintenance requirement')};
 open(draft,true);
};
window.closeAipWO=close;

/* Do not reactivate/re-render the same screen repeatedly after a source switch. */
window.restoreDatasetScreen=function(state){
 if(!state?.view)return;requestAnimationFrame(()=>{const current=document.querySelector('.view.active[id^="view-"]')?.id.replace('view-','');if(current!==state.view)window.activate?.(state.view,true);const m=document.getElementById('main');if(m)m.scrollTop=state.scroll||0;});
};
/* Stop the legacy diagnostic from cycling through every navigation item. Only its round chip may spin. */
document.addEventListener('apm:datasource-refreshed',function(e){
 e.stopImmediatePropagation();const chip=document.getElementById('aipRefreshChip');if(chip){chip.className='busy';chip.title='Refreshing data…';setTimeout(()=>{chip.className='ok';chip.title='Data refreshed successfully'},500)}
},true);
function beginStable(cls){document.documentElement.classList.add(cls);document.body.classList.add(cls);setTimeout(()=>{document.documentElement.classList.remove(cls);document.body.classList.remove(cls)},900)}
document.addEventListener('aip:login-complete',()=>beginStable('aip-v9-login'),true);
document.addEventListener('click',e=>{if(e.target.closest('#resetDemoBtn,[onclick*="loadExcelDemoData"],[onclick*="loadSyntheticDemoData"]'))beginStable('aip-v9-data-switch')},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('aipV9WoDrawer')?.style.transform==='translateX(0)')close()},true);
})();
