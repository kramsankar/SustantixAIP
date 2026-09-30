
(function(){
 'use strict';
 window.AIP_CURRENT_BUILD='v87_809';
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
 function root(view){return document.getElementById('view-'+view)}
 function card(view){return [...(root(view)?.querySelectorAll('.ms686-card')||[])].find(c=>/Strategy Reasoning Graph/i.test(c.querySelector(':scope>.ms686-head h3')?.textContent||''))||null}
 function decorateDetails(view){
   const c=card(view),head=c?.querySelector(':scope>.ms686-head');if(!head)return;
   // Remove all stale synthetic captions/wrappers while preserving the original working arrow and its onclick.
   head.querySelectorAll('.ms806-details-btn,.ms808-details-caption,.ms807-details-caption').forEach(x=>x.remove());
   let arrow=head.querySelector('.ms738-expand-reasoning')||c.querySelector('.ms738-expand-reasoning');if(!arrow)return;
   const oldCluster=head.querySelector('.ms809-details-cluster');
   if(oldCluster && !oldCluster.contains(arrow)) oldCluster.remove();
   let cluster=arrow.closest('.ms809-details-cluster');
   if(!cluster){
     cluster=document.createElement('span');cluster.className='ms809-details-cluster';
     if(arrow.parentNode)arrow.parentNode.insertBefore(cluster,arrow); else head.appendChild(cluster);
     cluster.appendChild(arrow);
   }
   cluster.querySelectorAll('.ms809-details-caption').forEach(x=>x.remove());
   const cap=document.createElement('span');cap.className='ms809-details-caption';cap.textContent='Details';
   cluster.insertBefore(cap,arrow);
   arrow.classList.remove('ms807-details-arrow','ms808-details-arrow');arrow.classList.add('ms809-details-arrow');
   arrow.setAttribute('aria-label','Expand Strategy Reasoning Details');arrow.title='Expand Strategy Reasoning Details';
 }
 function forceContext(view){
   const p=document.getElementById(`ms806-context-${view}`);if(!p)return;
   const g=p.querySelector('.ms799-common-grid');
   if(g){g.style.setProperty('display','flex','important');g.style.setProperty('flex-direction','row','important');g.style.setProperty('flex-wrap','nowrap','important');g.style.setProperty('width','max-content','important');g.style.setProperty('min-width','100%','important')}
 }
 function decorate(view){decorateDetails(view);forceContext(view)}
 const prev=window.ms791RenderGraph;
 window.ms791RenderGraph=function(view){const out=typeof prev==='function'?prev(view):undefined;decorate(view);requestAnimationFrame(()=>decorate(view));setTimeout(()=>decorate(view),40);return out};
 const prevCtx=window.ms806OpenContext;
 if(typeof prevCtx==='function')window.ms806OpenContext=function(view){const out=prevCtx.apply(this,arguments);forceContext(view);requestAnimationFrame(()=>forceContext(view));return out};
 const run=()=>VIEWS.forEach(v=>{try{decorate(v)}catch(_){}});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,220),{once:true});else setTimeout(run,120);
 document.addEventListener('aip:data-source-changed',()=>setTimeout(run,120));
 document.addEventListener('click',e=>{if(e.target.closest?.('.aip-maint-subtabs,.ms806-context-btn,.ms738-expand-reasoning'))setTimeout(run,20)},true);
 window.AIP_V809_AUDIT={
   graphTypography:'Graph labels, values and especially explanatory note text enlarged for readability.',
   details:'Original working arrow retained and visibly paired with fixed static Details caption on all five strategy tabs.',
   recordContext:'Horizontal non-wrapping row retained; Record Context label/value typography enlarged.',
   modal:'Removed only the outer Strategy Reasoning Detail panel border; inner evidence/policy card borders retained.',
   excelBusinessDataChanged:false
 };
})();
