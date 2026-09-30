
(function(){
 'use strict';
 function clear(){
   window.AIP_DEC005_PLAN_CONTEXT=null;
   const r=document.getElementById('view-resourceplanning');
   r?.classList.remove('aip-v583-dec005-context');
   r?.querySelectorAll('.aip-v583-dec005-target').forEach(x=>x.classList.remove('aip-v583-dec005-target'));
   r?.querySelector('.aip-v583-dec005-banner')?.remove();
   try{window.planScheduleSelect?.('')}catch(_){}
 }
 function decorate(){
   const ctx=window.AIP_DEC005_PLAN_CONTEXT,r=document.getElementById('view-resourceplanning');
   if(!ctx?.active||!r?.classList.contains('active'))return;
   r.classList.add('aip-v583-dec005-context');
   const row=[...r.querySelectorAll('.po-sched184-fixedrow')].find(x=>/INT-001/.test(x.textContent||''));
   row?.classList.add('aip-v583-dec005-target');
   const card=r.querySelector('.po-sched176-card');
   if(card&&!r.querySelector('.aip-v583-dec005-banner')){
     const b=document.createElement('div');b.className='aip-v583-dec005-banner';
     b.innerHTML='<div><b>DEC-005 context</b> · Outage Bundling VIS-001 → ALT-0001 → <b>INT-001</b> / WO-00001<br><span>Governed Planning & Optimization intervention for the low-irradiance maintenance opportunity.</span></div><button type="button" title="Clear context" aria-label="Clear context">×</button>';
     b.querySelector('button').onclick=clear;card.parentNode.insertBefore(b,card);
   }
 }
 const r=document.getElementById('view-resourceplanning');
 if(r)new MutationObserver(()=>requestAnimationFrame(decorate)).observe(r,{subtree:true,childList:true});
 window.aipClearDec005PlanningContext=clear;
 window.AIP_V583_DEC005_ROUTE_AUDIT={
   rootCause:'Authoritative Asset-to-Value governedSourceTarget still mapped Outage Bundling to retired opportunistic.',
   sourceMapping:'Outage Bundling -> resourceplanning',
   record:'INT-001',
   workOrder:'WO-00001',
   renderer:'AIP_V21.open(resourceplanning) + planSelect(INT-001,schedule)'
 };
})();
window.AIP_CURRENT_BUILD='v583';
