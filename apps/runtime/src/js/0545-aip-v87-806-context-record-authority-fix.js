
(function(){
 'use strict';
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
 const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 function currentRecord(view){
   const root=document.getElementById('view-'+view);
   const rid=root?.querySelector('.ms791-host')?.dataset?.ms800reasoning||'';
   if(!rid)return null;
   const all=[...(window.AIP_STRATEGY_REASONING_EXCEL||[]),...(window.AIP_STRATEGY_REASONING_SYNTHETIC||[])];
   return all.find(r=>String(r.Reasoning_ID||'')===rid)||null;
 }
 function panel(view){return document.getElementById(`ms806-context-${view}`)}
 function selectionBasis(view,r){
   const root=document.getElementById('view-'+view),ws=root?.querySelector('.ms686-workspace');
   const asset=ws?.querySelector('.ms686-asset')?.value||root?.dataset?.ms686asset||'All';
   const site=ws?.querySelector('.ms686-site')?.value||root?.dataset?.ms686site||'All';
   try{return window.AIP_STRATEGY_REASONING_SELECTION?.selectionBasis?.(view,r,{asset,site,rows:[],root,ws})||''}catch(_){return ''}
 }
 function cell(label,value,selection){
   return `<div class="ms791-pin-cell${selection?' ms800-selection-basis':''}"><span>${esc(label)}</span><b>${esc(value||'—')}</b></div>`;
 }
 window.ms806OpenContext=function(view){
   if(!VIEWS.includes(view))return;
   const r=currentRecord(view),p=panel(view);if(!r||!p)return;
   const fields=[
     ['Reasoning record',r.Reasoning_ID],
     ['Asset',`${r.Asset_Tag||r.Asset_ID||'—'}${r.Asset_Class?` · ${r.Asset_Class}`:''}`],
     ['Primary source',`${r.Primary_Source_Dataset||'—'}${r.Primary_Source_ID?` · ${r.Primary_Source_ID}`:''}`],
     ['Failure mode',r.Failure_Mode||'—'],
     ['Selection basis',selectionBasis(view,r),true]
   ];
   if(view==='corrective'&&r.Work_Order_ID)fields.push(['Work order',r.Work_Order_ID]);
   if(view==='adaptive'&&r.RCM_ID)fields.push(['RCM policy',r.RCM_ID]);
   const body=p.querySelector('.ms806-panel-body');
   if(body)body.innerHTML=`<div class="ms799-context"><div class="ms799-section-title">Common Record Context</div><div class="ms791-pin-grid ms799-common-grid">${fields.map(x=>cell(x[0],x[1],x[2])).join('')}</div></div>`;
   p.classList.add('open');
 };
})();
