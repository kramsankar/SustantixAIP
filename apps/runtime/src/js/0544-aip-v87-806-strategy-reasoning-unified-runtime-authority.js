
(function(){
 'use strict';
 window.AIP_CURRENT_BUILD='v87_806';
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
 const MEANINGFUL={preventive:new Set(['interval']),predictive:new Set(['window']),corrective:new Set([]),riskbased:new Set(['safety','composite']),adaptive:new Set(['interval'])};
 const EXTERNAL={preventive:new Set(['policy']),predictive:new Set(['recommendation']),corrective:new Set(['failure','repair','recommendation']),riskbased:new Set(['criticality','recommendation']),adaptive:new Set(['current','recommendation'])};
 const CONTEXT_SEED={preventive:'interval',predictive:'window',corrective:'failure',riskbased:'safety',adaptive:'interval'};
 const dataPin=window.ms791Pin, dataRender=window.ms791RenderGraph;
 function root(view){return document.getElementById('view-'+view)}
 function card(view){return [...(root(view)?.querySelectorAll('.ms686-card')||[])].find(c=>/Strategy Reasoning Graph/i.test(c.querySelector(':scope>.ms686-head h3')?.textContent||''))||null}
 function oldPin(view){return document.getElementById('ms791Pin-'+view)}
 function panelId(view,type){return `ms806-${type}-${view}`}
 function ensureStack(view){
   const c=card(view); if(!c)return null;
   let s=c.querySelector('.ms806-detail-stack');
   if(!s){s=document.createElement('div');s.className='ms806-detail-stack';c.appendChild(s)}
   ['context','basis','action'].forEach(type=>{
     if(!s.querySelector('#'+panelId(view,type))){
       const p=document.createElement('div');p.id=panelId(view,type);p.className='ms806-detail-panel '+type;
       p.innerHTML=`<div class="ms806-panel-head"><b>${type==='context'?'Common Record Context':type==='basis'?'Reasoning Basis':'Governed Action'}</b><button class="ms806-panel-close" type="button" aria-label="Close">×</button></div><div class="ms806-panel-body"></div>`;
       p.querySelector('.ms806-panel-close').onclick=()=>p.classList.remove('open');
       s.appendChild(p);
     }
   });
   return s;
 }
 function ensureHeader(view){
   const c=card(view),head=c?.querySelector(':scope>.ms686-head'); if(!head)return;
   const titleWrap=head.querySelector(':scope>div'); const h=titleWrap?.querySelector('h3'); if(!titleWrap||!h)return;
   let line=titleWrap.querySelector('.ms806-title-line');
   if(!line){
     line=document.createElement('div');line.className='ms806-title-line';
     h.insertAdjacentElement('beforebegin',line);line.appendChild(h);
     const d=document.createElement('button');d.type='button';d.className='ms806-details-btn';
     d.innerHTML='<span class="ms806-details-icon" aria-hidden="true"></span><span>Details</span>';
     d.setAttribute('aria-label','Open Strategy Reasoning Details');
     d.onclick=e=>{e.preventDefault();e.stopPropagation();try{window.ms686Detail?.('graph')}catch(_){}};
     line.appendChild(d);
   }
   let ctx=head.querySelector('.ms806-context-btn');
   if(!ctx){
     ctx=document.createElement('button');ctx.type='button';ctx.className='ms806-context-btn';
     ctx.innerHTML='<span class="ms806-context-icon" aria-hidden="true"></span><span>Record Context</span>';
     ctx.setAttribute('aria-label','Open Common Record Context');
     ctx.onclick=e=>{e.preventDefault();e.stopPropagation();window.ms806OpenContext(view)};
     head.appendChild(ctx);
   }
   ensureStack(view);
 }
 function harvest(view,kind){
   const b=oldPin(view); if(!b)return '';
   if(kind==='context')return b.querySelector('.ms799-context')?.outerHTML||'';
   if(kind==='basis')return b.querySelector('.ms799-step')?.outerHTML||'';
   if(kind==='action')return b.querySelector('.ms791-pin-actions')?.outerHTML||'';
   return '';
 }
 function show(view,type,html){
   ensureStack(view);const p=document.getElementById(panelId(view,type));if(!p)return;
   const body=p.querySelector('.ms806-panel-body');if(body)body.innerHTML=html||'';
   p.classList.toggle('open',!!html);
 }
 function generate(view,key,kind){
   if(typeof dataPin!=='function')return '';
   try{dataPin(view,key)}catch(_){}
   const html=harvest(view,kind);
   const b=oldPin(view); if(b)b.classList.remove('open');
   return html;
 }
 window.ms806OpenContext=function(view){
   if(!VIEWS.includes(view))return;
   const seed=CONTEXT_SEED[view]; if(!seed)return;
   show(view,'context',generate(view,seed,'context'));
 };
 window.ms791Pin=function(view,key){
   if(!VIEWS.includes(view))return typeof dataPin==='function'?dataPin(view,key):undefined;
   const meaningful=MEANINGFUL[view]?.has(key), external=EXTERNAL[view]?.has(key);
   if(!meaningful&&!external)return;
   if(meaningful){
     const html=generate(view,key,'basis');
     show(view,'basis',html);
     /* Intentionally preserve any existing governed-action panel. */
     return;
   }
   if(external){
     const html=generate(view,key,'action');
     show(view,'action',html);
     /* Intentionally preserve Context and Basis panels. */
     return;
   }
 };
 function decorate(view){
   ensureHeader(view);
   [...(root(view)?.querySelectorAll('.ms791-node.ms804-meaningful .ms791-go')||[])].forEach(g=>{
     g.textContent='';g.setAttribute('aria-label','Open Reasoning Basis');g.title='Reasoning Basis';
   });
   [...(root(view)?.querySelectorAll('.ms791-node.has-external .ms791-go')||[])].forEach(g=>{
     g.textContent='↗';g.setAttribute('aria-label','Open governed record');g.title='Open governed record';
   });
 }
 window.ms791RenderGraph=function(view){
   const out=typeof dataRender==='function'?dataRender(view):undefined;
   decorate(view);setTimeout(()=>decorate(view),0);return out;
 };
 const repaint=()=>VIEWS.forEach(v=>{try{decorate(v)}catch(_){}});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(repaint,120),{once:true});else setTimeout(repaint,60);
 document.addEventListener('aip:data-source-changed',()=>setTimeout(repaint,100));
 window.AIP_V806_AUDIT={
   unifiedAcrossAllFiveStrategies:true,
   detailsControl:'left beside Strategy Reasoning Graph title',
   detailsIcon:'white vertical down-arrow on navy circular background',
   recordContext:'compact right-side independent panel',
   basis:'node-specific independent panel',
   governedAction:'independent persistent panel with diagonal external arrow',
   independentPanelState:true,
   nodeMinHeightPx:38,
   excelBusinessDataChanged:false
 };
})();
