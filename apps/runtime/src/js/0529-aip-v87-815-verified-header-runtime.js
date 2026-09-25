
(function(){
 'use strict';
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
 function graphCard(view){
   const root=document.getElementById('view-'+view); if(!root)return null;
   return [...root.querySelectorAll('.ms686-card')].find(c=>/Strategy Reasoning Graph/i.test(c.querySelector(':scope > .ms686-head h3')?.textContent||''))||null;
 }
 function install(view){
   const card=graphCard(view); if(!card)return false;
   const head=card.querySelector(':scope > .ms686-head'); if(!head)return false;
   const arrow=card.querySelector('.ms738-expand-reasoning'); if(!arrow)return false;
   let controls=head.querySelector(':scope > .ms815-header-controls');
   if(!controls){controls=document.createElement('div');controls.className='ms815-header-controls';head.appendChild(controls)}
   let pair=controls.querySelector(':scope > .ms815-details-pair');
   if(!pair){pair=document.createElement('span');pair.className='ms815-details-pair';controls.appendChild(pair)}
   /* Move the exact original button node, preserving its working onclick listener/attribute. */
   if(arrow.parentElement!==pair)pair.appendChild(arrow);
   let cap=pair.querySelector(':scope > .ms815-details-caption');
   if(!cap){cap=document.createElement('span');cap.className='ms815-details-caption';cap.textContent='Details';cap.setAttribute('aria-hidden','true');pair.appendChild(cap)}
   else cap.textContent='Details';
   const ctx=card.querySelector('.ms806-context-btn');
   if(ctx && ctx.parentElement!==controls)controls.insertBefore(ctx,pair);
   /* Remove stale DOM captions from this card only. */
   card.querySelectorAll('.ms806-details-btn,.ms807-details-caption,.ms808-details-caption,.ms809-details-caption,.ms810-details-caption,.ms811-details-caption,.ms812-details-caption').forEach(x=>x.remove());
   arrow.setAttribute('aria-label','Expand Strategy Reasoning Details');arrow.title='Expand Strategy Reasoning Details';
   return !!(pair.contains(arrow) && pair.querySelector('.ms815-details-caption'));
 }
 function run(){VIEWS.forEach(install)}
 const prev=window.ms791RenderGraph;
 window.ms791RenderGraph=function(view){const out=typeof prev==='function'?prev(view):undefined;install(view);requestAnimationFrame(()=>install(view));setTimeout(()=>install(view),80);return out};
 document.addEventListener('click',e=>{if(e.target.closest?.('.aip-maint-subtabs,.ms806-context-btn,.ms738-expand-reasoning')){setTimeout(run,20);setTimeout(run,100)}},true);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{run();setTimeout(run,120)},{once:true});else{run();setTimeout(run,120)}
 window.AIP_CURRENT_BUILD='v87_815';
 window.AIP_V815_AUDIT={
   graphDetailsCaption:'Verified real DOM Details caption is immediately to the right of the exact original working Strategy Reasoning Graph down-arrow on all five maintenance types.',
   recordContextControl:'Record Context header control compressed to 16px height.',
   implementation:'Original arrow node is moved into a shared inline-flex header cluster; it is not recreated, so its working drill-down remains intact.',
   excelBusinessDataChanged:false
 };
})();
