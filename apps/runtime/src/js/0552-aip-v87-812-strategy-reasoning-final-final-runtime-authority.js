
(function(){
 'use strict';
 window.AIP_CURRENT_BUILD='v87_812';
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
 function card(view){
   const root=document.getElementById('view-'+view);if(!root)return null;
   return [...root.querySelectorAll('.ms686-card')].find(c=>/Strategy Reasoning Graph/i.test(c.querySelector(':scope>.ms686-head h3')?.textContent||''))||null;
 }
 function installGraphCaption(view){
   const c=card(view),head=c?.querySelector(':scope>.ms686-head');if(!head)return;
   const arrow=c.querySelector('.ms738-expand-reasoning');if(!arrow)return;
   /* Remove prior captions, but NEVER replace/recreate the proven working arrow node. */
   head.querySelectorAll('.ms806-details-btn,.ms807-details-caption,.ms808-details-caption,.ms809-details-caption,.ms810-details-caption,.ms811-details-caption,.ms812-details-caption').forEach(x=>x.remove());
   let cluster=arrow.closest('.ms812-details-cluster');
   if(!cluster){
     cluster=document.createElement('span');cluster.className='ms812-details-cluster';
     arrow.parentNode?.insertBefore(cluster,arrow);
     cluster.appendChild(arrow);
   }
   const cap=document.createElement('span');cap.className='ms812-details-caption';cap.textContent='Details';cap.setAttribute('aria-hidden','true');
   cluster.appendChild(cap);
   arrow.setAttribute('aria-label','Expand Strategy Reasoning Details');arrow.title='Expand Strategy Reasoning Details';
 }
 function stripOuterFrame(){
   const m=document.getElementById('ms686Modal');if(!m)return;
   const p=m.querySelector('.ms686-panel');if(!p)return;
   ['border','border-width','border-color','border-style','outline','outline-width','outline-color','box-shadow'].forEach(k=>p.style.setProperty(k,k.includes('color')?'transparent':k.includes('width')?'0':k==='border-style'?'none':'none','important'));
 }
 function run(){VIEWS.forEach(v=>{try{installGraphCaption(v)}catch(_){}});stripOuterFrame()}
 const prev=window.ms791RenderGraph;
 window.ms791RenderGraph=function(view){const out=typeof prev==='function'?prev(view):undefined;installGraphCaption(view);requestAnimationFrame(()=>installGraphCaption(view));setTimeout(()=>installGraphCaption(view),60);return out};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,160),{once:true});else setTimeout(run,80);
 document.addEventListener('click',e=>{
   if(e.target.closest?.('.aip-maint-subtabs,.ms738-expand-reasoning,.ms791-go')){setTimeout(run,20);setTimeout(stripOuterFrame,80)}
 },true);
 document.addEventListener('aip:data-source-changed',()=>setTimeout(run,80));
 window.AIP_V812_AUDIT={
   graphDetails:'Original working Strategy Reasoning down-arrow retained with one fixed navy/white Details caption in the same header cluster.',
   nodeBasis:'Meaningful node drill-downs force a small static Basis caption beside the existing down-arrow affordance.',
   modal:'Big outer Strategy Reasoning Detail blue frame removed with border/outline/shadow zeroed; inner governed cards retained.',
   excelBusinessDataChanged:false
 };
})();
