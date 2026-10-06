
(function(){
 'use strict';
 window.AIP_CURRENT_BUILD='v87_805';
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
 const MEANINGFUL={preventive:new Set(['interval']),predictive:new Set(['window']),corrective:new Set([]),riskbased:new Set(['safety','composite']),adaptive:new Set(['interval'])};
 const EXTERNAL={preventive:new Set(['policy']),predictive:new Set(['recommendation']),corrective:new Set(['failure','repair','recommendation']),riskbased:new Set(['criticality','recommendation']),adaptive:new Set(['current','recommendation'])};
 const CONTEXT_SEED={preventive:'interval',predictive:'window',corrective:'failure',riskbased:'safety',adaptive:'interval'};
 const priorRender=window.ms791RenderGraph, priorPin=window.ms791Pin;
 function card(view){const root=document.getElementById('view-'+view);return [...(root?.querySelectorAll('.ms686-card')||[])].find(c=>/Strategy Reasoning Graph/i.test(c.querySelector(':scope>.ms686-head h3')?.textContent||''))||null}
 function pinBox(view){return document.getElementById('ms791Pin-'+view)}
 function topClean(box,label){
   const line=box?.querySelector('.ms802-selection-line');if(line)line.remove();
   const top=box?.querySelector('.ms800-pin-top,.ms802-pin-top,.ms791-pin-head');
   if(top){
     const h=top.querySelector('h4');if(h)h.textContent=label||'';
     const p=top.querySelector('p');if(p)p.remove();
   }
 }
 function ensureContextButton(view){
   const c=card(view),head=c?.querySelector(':scope>.ms686-head');if(!head)return;
   let b=head.querySelector('.ms805-context-btn');
   if(!b){
     b=document.createElement('button');b.type='button';b.className='ms805-context-btn';b.innerHTML='<span class="ms805-context-icon" aria-hidden="true"></span><span>Record Context</span>';
     b.setAttribute('aria-label','Open Common Record Context');b.onclick=e=>{e.preventDefault();e.stopPropagation();window.ms805OpenContext(view)};
     const old=head.querySelector('.ms738-expand-reasoning,.ms686-drill');if(old)old.insertAdjacentElement('beforebegin',b);else head.appendChild(b);
   }
 }
 window.ms805OpenContext=function(view){
   if(!VIEWS.includes(view))return;
   const seed=CONTEXT_SEED[view];if(!seed)return;
   priorPin(view,seed);
   const box=pinBox(view);if(!box)return;
   box.classList.remove('ms805-basis-panel','ms805-action-panel');box.classList.add('ms805-context-panel','open');
   box.querySelector('.ms799-step')?.remove();box.querySelector('.ms791-pin-actions')?.remove();
   topClean(box,'Common Record Context');
 };
 window.ms791Pin=function(view,key){
   if(!VIEWS.includes(view))return typeof priorPin==='function'?priorPin(view,key):undefined;
   const meaningful=MEANINGFUL[view]?.has(key),external=EXTERNAL[view]?.has(key);
   if(!meaningful&&!external)return;
   const out=typeof priorPin==='function'?priorPin(view,key):undefined;
   const box=pinBox(view);if(!box)return out;
   box.classList.remove('ms805-context-panel','ms805-basis-panel','ms805-action-panel');
   if(meaningful){
     box.classList.add('ms805-basis-panel');
     box.querySelector('.ms799-context')?.remove();box.querySelector('.ms791-pin-actions')?.remove();
     topClean(box,'Reasoning Basis');
   }else if(external){
     box.classList.add('ms805-action-panel');
     box.querySelector('.ms799-context')?.remove();box.querySelector('.ms799-step')?.remove();
     topClean(box,'Governed Action');
   }
   return out;
 };
 function decorate(view){
   ensureContextButton(view);
   const root=document.getElementById('view-'+view);
   [...(root?.querySelectorAll('.ms791-node.ms804-meaningful .ms791-go')||[])].forEach(g=>{g.textContent='';g.setAttribute('aria-label','Open Reasoning Basis');g.title='Reasoning Basis'});
   [...(root?.querySelectorAll('.ms791-node.has-external .ms791-go')||[])].forEach(g=>{g.textContent='↗';g.setAttribute('aria-label','Open governed record')});
 }
 window.ms791RenderGraph=function(view){const out=typeof priorRender==='function'?priorRender(view):undefined;decorate(view);setTimeout(()=>decorate(view),0);return out};
 const repaint=()=>VIEWS.forEach(v=>{try{decorate(v)}catch(_){}});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(repaint,140),{once:true});else setTimeout(repaint,80);
 document.addEventListener('aip:data-source-changed',()=>setTimeout(repaint,120));
 window.AIP_V805_AUDIT={separateRecordContextControl:true,nodeReasoningBasisOnly:true,externalActionSeparate:true,meaningfulBasis:{preventive:['interval'],predictive:['window'],corrective:[],riskbased:['safety','composite'],adaptive:['interval']},nodeHeightPx:42,detailMaxWidthPx:620,excelBusinessDataChanged:false};
})();
