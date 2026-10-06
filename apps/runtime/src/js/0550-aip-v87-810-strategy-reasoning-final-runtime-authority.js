
(function(){
 'use strict';
 window.AIP_CURRENT_BUILD='v87_810';
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
 const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 function root(view){return document.getElementById('view-'+view)}
 function card(view){return [...(root(view)?.querySelectorAll('.ms686-card')||[])].find(c=>/Strategy Reasoning Graph/i.test(c.querySelector(':scope>.ms686-head h3')?.textContent||''))||null}
 function decorateDetails(view){
   const c=card(view),head=c?.querySelector(':scope>.ms686-head');if(!head)return;
   head.querySelectorAll('.ms806-details-btn,.ms807-details-caption,.ms808-details-caption,.ms809-details-caption').forEach(x=>x.remove());
   let arrow=c.querySelector('.ms738-expand-reasoning');if(!arrow)return;
   let cluster=arrow.closest('.ms810-details-cluster');
   if(!cluster){
     /* Unwrap stale caption clusters without touching the original arrow or its onclick. */
     const stale=arrow.closest('.ms809-details-cluster,.ms807-details-control');
     if(stale){stale.parentNode?.insertBefore(arrow,stale);stale.remove()}
     cluster=document.createElement('span');cluster.className='ms810-details-cluster';
     arrow.parentNode?.insertBefore(cluster,arrow);cluster.appendChild(arrow);
   }
   cluster.querySelectorAll('.ms810-details-caption').forEach(x=>x.remove());
   const cap=document.createElement('span');cap.className='ms810-details-caption';cap.textContent='Details';
   cluster.appendChild(cap); /* arrow first, then the fixed caption immediately beside it */
   arrow.classList.add('ms810-details-arrow');
   arrow.setAttribute('aria-label','Expand Strategy Reasoning Details');arrow.title='Expand Strategy Reasoning Details';
 }
 function currentRecord(view){
   const rid=root(view)?.querySelector('.ms791-host')?.dataset?.ms800reasoning||'';if(!rid)return null;
   const all=[...(window.AIP_STRATEGY_REASONING_EXCEL||[]),...(window.AIP_STRATEGY_REASONING_SYNTHETIC||[])];
   return all.find(r=>String(r.Reasoning_ID||'')===rid)||null;
 }
 function selectionBasis(view,r){
   const rt=root(view),ws=rt?.querySelector('.ms686-workspace');
   const asset=ws?.querySelector('.ms686-asset')?.value||rt?.dataset?.ms686asset||'All';
   const site=ws?.querySelector('.ms686-site')?.value||rt?.dataset?.ms686site||'All';
   try{return window.AIP_STRATEGY_REASONING_SELECTION?.selectionBasis?.(view,r,{asset,site,rows:[],root:rt,ws})||''}catch(_){return ''}
 }
 function cell(label,value,selection){return `<div class="ms791-pin-cell${selection?' ms800-selection-basis':''}"><span>${esc(label)}</span><b>${esc(value||'—')}</b></div>`}
 /* Final Record Context authority: common chain context only. Corrective Work Order is deliberately excluded as redundant. */
 window.ms806OpenContext=function(view){
   if(!VIEWS.includes(view))return;
   const r=currentRecord(view),p=document.getElementById(`ms806-context-${view}`);if(!r||!p)return;
   const fields=[
     ['Reasoning record',r.Reasoning_ID],
     ['Asset',`${r.Asset_Tag||r.Asset_ID||'—'}${r.Asset_Class?` · ${r.Asset_Class}`:''}`],
     ['Primary source',`${r.Primary_Source_Dataset||'—'}${r.Primary_Source_ID?` · ${r.Primary_Source_ID}`:''}`],
     ['Failure mode',r.Failure_Mode||'—'],
     ['Selection basis',selectionBasis(view,r),true]
   ];
   if(view==='adaptive'&&r.RCM_ID)fields.push(['RCM policy',r.RCM_ID]);
   const body=p.querySelector('.ms806-panel-body');
   if(body)body.innerHTML=`<div class="ms799-context"><div class="ms791-pin-grid ms799-common-grid">${fields.map(x=>cell(x[0],x[1],x[2])).join('')}</div></div>`;
   p.classList.add('open');
   const g=p.querySelector('.ms799-common-grid');if(g){g.style.setProperty('display','flex','important');g.style.setProperty('flex-direction','row','important');g.style.setProperty('flex-wrap','nowrap','important');g.style.setProperty('width','max-content','important');g.style.setProperty('min-width','100%','important')}
 };
 function cleanModal(){
   const p=document.querySelector('#ms686Modal .ms686-panel');if(!p)return;
   p.style.setProperty('border','0','important');p.style.setProperty('outline','0','important');p.style.setProperty('box-shadow','none','important');
 }
 function decorate(view){decorateDetails(view)}
 const prior=window.ms791RenderGraph;
 window.ms791RenderGraph=function(view){const out=typeof prior==='function'?prior(view):undefined;decorate(view);requestAnimationFrame(()=>decorate(view));setTimeout(()=>decorate(view),60);return out};
 const run=()=>{VIEWS.forEach(v=>{try{decorate(v)}catch(_){}});cleanModal()};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,240),{once:true});else setTimeout(run,140);
 document.addEventListener('aip:data-source-changed',()=>setTimeout(run,140));
 document.addEventListener('click',e=>{
   if(e.target.closest?.('.aip-maint-subtabs,.ms738-expand-reasoning,.ms806-context-btn'))setTimeout(run,25);
   if(e.target.closest?.('.ms738-expand-reasoning'))setTimeout(cleanModal,40);
 },true);
 window.AIP_V810_AUDIT={
   details:'Original working heavy down-arrow plus guaranteed fixed static Details caption immediately to its right on all five strategy tabs.',
   correctiveRecordContext:'Corrective Work Order removed from Common Record Context because it is already visible in Failure/Defect and Repair Requirement.',
   modal:'Outer Strategy Reasoning Detail panel border/outline/shadow removed; internal evidence/policy/calculation card borders retained.',
   excelBusinessDataChanged:false
 };
})();
