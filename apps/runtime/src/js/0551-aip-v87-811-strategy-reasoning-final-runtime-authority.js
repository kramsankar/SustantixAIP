
(function(){
 'use strict';
 window.AIP_CURRENT_BUILD='v87_811';
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
 function getCard(view){
   const root=document.getElementById('view-'+view); if(!root)return null;
   return [...root.querySelectorAll('.ms686-card')].find(c=>/Strategy Reasoning Graph/i.test(c.querySelector(':scope>.ms686-head h3')?.textContent||''))||null;
 }
 function installCaption(view){
   const card=getCard(view); if(!card)return;
   const arrow=card.querySelector('.ms738-expand-reasoning'); if(!arrow)return;
   /* Unwrap old artificial clusters but preserve the exact original arrow node and its click handler. */
   const wrapper=arrow.closest('.ms810-details-cluster,.ms809-details-cluster,.ms807-details-control');
   if(wrapper){
     wrapper.parentNode?.insertBefore(arrow,wrapper);
     wrapper.remove();
   }
   card.querySelectorAll('.ms806-details-btn,.ms807-details-caption,.ms808-details-caption,.ms809-details-caption,.ms810-details-caption,.ms811-details-caption').forEach(x=>x.remove());
   const cap=document.createElement('span');
   cap.className='ms811-details-caption';
   cap.textContent='Details';
   cap.setAttribute('aria-hidden','true');
   /* Exactly next to the original working arrow, not in another header control. */
   arrow.insertAdjacentElement('afterend',cap);
   arrow.setAttribute('aria-label','Expand Strategy Reasoning Details');
   arrow.title='Expand Strategy Reasoning Details';
 }
 function forceContextRow(view){
   const p=document.getElementById('ms806-context-'+view); if(!p)return;
   const body=p.querySelector('.ms806-panel-body');
   const grid=p.querySelector('.ms799-common-grid');
   if(body){body.style.setProperty('overflow-x','auto','important');body.style.setProperty('overflow-y','hidden','important')}
   if(grid){
     grid.style.setProperty('display','flex','important');
     grid.style.setProperty('flex-direction','row','important');
     grid.style.setProperty('flex-wrap','nowrap','important');
     grid.style.setProperty('width','max-content','important');
     grid.style.setProperty('min-width','100%','important');
   }
 }
 const priorRender=window.ms791RenderGraph;
 window.ms791RenderGraph=function(view){
   const out=typeof priorRender==='function'?priorRender(view):undefined;
   installCaption(view);
   requestAnimationFrame(()=>installCaption(view));
   setTimeout(()=>installCaption(view),50);
   return out;
 };
 const priorContext=window.ms806OpenContext;
 window.ms806OpenContext=function(view){
   const out=typeof priorContext==='function'?priorContext(view):undefined;
   forceContextRow(view);
   requestAnimationFrame(()=>forceContextRow(view));
   setTimeout(()=>forceContextRow(view),30);
   return out;
 };
 function run(){VIEWS.forEach(v=>{try{installCaption(v);forceContextRow(v)}catch(_){}})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,180),{once:true});else setTimeout(run,80);
 document.addEventListener('click',e=>{
   if(e.target.closest?.('.aip-maint-subtabs,.ms738-expand-reasoning,.ms806-context-btn'))setTimeout(run,20);
 },true);
 document.addEventListener('aip:data-source-changed',()=>setTimeout(run,80));
 window.AIP_V811_AUDIT={
   details:'One bright navy Details caption with white text is inserted immediately after the original working heavy down-arrow on all five maintenance strategy tabs.',
   recordContext:'Record Context dropdown is forced to one non-wrapping horizontal row with horizontal scrolling only.',
   modal:'Deep Strategy Reasoning Detail outer frame remains removed.',
   excelBusinessDataChanged:false
 };
})();
