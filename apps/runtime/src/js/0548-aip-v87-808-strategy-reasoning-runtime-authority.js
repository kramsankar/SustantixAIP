
(function(){
 'use strict';
 window.AIP_CURRENT_BUILD='v87_808';
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
 function root(view){return document.getElementById('view-'+view)}
 function card(view){return [...(root(view)?.querySelectorAll('.ms686-card')||[])].find(c=>/Strategy Reasoning Graph/i.test(c.querySelector(':scope>.ms686-head h3')?.textContent||''))||null}
 function decorateDetails(view){
   const c=card(view),head=c?.querySelector(':scope>.ms686-head');if(!head)return;
   // Remove the duplicate v87_806 Details button and any stale v87_807 wrappers/captions.
   head.querySelectorAll('.ms806-details-btn,.ms808-details-caption').forEach(x=>x.remove());
   const stale=head.querySelector('.ms807-details-control');
   let arrow=head.querySelector('.ms738-expand-reasoning')||stale?.querySelector('.ms738-expand-reasoning')||c.querySelector('.ms738-expand-reasoning');
   if(!arrow)return;
   // Put the original working arrow back as a direct header control, preserving its original onclick.
   if(arrow.parentElement!==head)head.appendChild(arrow);
   if(stale&&stale!==arrow.parentElement)stale.remove();
   arrow.classList.remove('ms807-details-arrow');arrow.classList.add('ms808-details-arrow');
   arrow.setAttribute('aria-label','Expand Strategy Reasoning Details');
   arrow.title='Expand Strategy Reasoning Details';
   const cap=document.createElement('span');cap.className='ms808-details-caption';cap.textContent='Details';
   head.insertBefore(cap,arrow);
 }
 function forceHorizontalContext(view){
   const p=document.getElementById(`ms806-context-${view}`);if(!p)return;
   const g=p.querySelector('.ms799-common-grid');if(g){g.style.setProperty('display','flex','important');g.style.setProperty('flex-direction','row','important');g.style.setProperty('flex-wrap','nowrap','important')}
 }
 function decorate(view){decorateDetails(view);forceHorizontalContext(view)}
 const prior=window.ms791RenderGraph;
 window.ms791RenderGraph=function(view){const out=typeof prior==='function'?prior(view):undefined;decorate(view);setTimeout(()=>decorate(view),0);return out};
 const priorContext=window.ms806OpenContext;
 if(typeof priorContext==='function')window.ms806OpenContext=function(view){const out=priorContext.apply(this,arguments);forceHorizontalContext(view);setTimeout(()=>forceHorizontalContext(view),0);return out};
 const run=()=>VIEWS.forEach(v=>{try{decorate(v)}catch(_){}});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,180),{once:true});else setTimeout(run,100);
 document.addEventListener('aip:data-source-changed',()=>setTimeout(run,140));
 document.addEventListener('click',e=>{
   if(e.target.closest?.('.ms806-context-btn'))setTimeout(run,0);
 },true);
 window.AIP_V808_AUDIT={
   graphTypography:'Restored to v87_802 readable scale (small 6.2px, value 8.7px, note 6.1px; node min-height 50px)',
   details:'Original working graph expand arrow retained with a fixed small static Details caption immediately beside it.',
   recordContext:'Forced to one non-wrapping horizontal row, including Selection basis; horizontal scroll used when needed rather than vertical stacking.',
   scope:'Preventive, Predictive, Corrective, Risk-Based, Adaptive',
   excelBusinessDataChanged:false
 };
})();
