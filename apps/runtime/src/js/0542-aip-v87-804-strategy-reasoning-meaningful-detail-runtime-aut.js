
(function(){
 'use strict';
 window.AIP_CURRENT_BUILD='v87_804';
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
 const ORDER={
  preventive:['scope','policy','interval','suitability','recommendation'],
  predictive:['condition','risk','rul','consequence','window','suitability','recommendation'],
  corrective:['failure','impact','severity','repair','suitability','recommendation'],
  riskbased:['criticality','energy','safety','access','composite','priority','suitability','recommendation'],
  adaptive:['current','condition','change','interval','suitability','recommendation']
 };
 // A down-arrow exists only where clicking reveals genuinely new governed information.
 const MEANINGFUL={
  preventive:new Set(['interval']),
  predictive:new Set(['window']),
  corrective:new Set([]),
  riskbased:new Set(['safety','composite']),
  adaptive:new Set(['interval'])
 };
 const EXTERNAL={
  preventive:new Set(['policy']),
  predictive:new Set(['recommendation']),
  corrective:new Set(['failure','repair','recommendation']),
  riskbased:new Set(['criticality','recommendation']),
  adaptive:new Set(['current','recommendation'])
 };
 const KEEP={
  'preventive:interval':new Set(['interval','last maintenance','next due']),
  'predictive:window':new Set(['rule']),
  'riskbased:safety':new Set(['severity'])
 };
 const priorRender=window.ms791RenderGraph;
 const priorPin=window.ms791Pin;
 function decorate(view){
   if(!VIEWS.includes(view))return;
   const root=document.getElementById('view-'+view),nodes=[...(root?.querySelectorAll('.ms791-chain .ms791-node')||[])];
   const keys=ORDER[view]||[];
   nodes.forEach((n,i)=>{
     const key=keys[i];if(!key)return;
     n.dataset.ms804Key=key;
     n.classList.remove('ms804-static','ms804-meaningful');
     if(EXTERNAL[view]?.has(key))return; // ↗ remains authoritative for exact external navigation.
     if(MEANINGFUL[view]?.has(key))n.classList.add('ms804-meaningful');
     else n.classList.add('ms804-static');
   });
 }
 function cell(label,value){
   const c=document.createElement('div');c.className='ms791-pin-cell ms804-basis-cell';
   const s=document.createElement('span');s.textContent=label;
   const b=document.createElement('b');b.textContent=value;
   c.append(s,b);return c;
 }
 function cleanMeaningful(view,key,box){
   const step=box.querySelector('.ms799-step');if(!step)return;
   const title=step.querySelector('.ms799-section-title');
   if(title)title.textContent='Reasoning Basis · '+((ORDER[view]||[]).includes(key)?(box.closest('#view-'+view)?.querySelector(`.ms791-node[data-ms804-key="${key}"] small`)?.textContent||key):key);
   const grid=step.querySelector('.ms799-step-grid');if(!grid)return;
   if(view==='riskbased'&&key==='composite'){
     grid.innerHTML='';
     grid.append(cell('Weighting rule','45% Energy + 35% Safety + 20% Accessibility'));
     return;
   }
   if(view==='adaptive'&&key==='interval'){
     grid.innerHTML='';
     grid.append(cell('Adjustment rule','Risk change >10 pp → 75%; >5 pp → 90%; otherwise 100% of current interval'));
     return;
   }
   const keep=KEEP[view+':'+key]||new Set();
   [...grid.querySelectorAll('.ms791-pin-cell')].forEach(c=>{
     const label=(c.querySelector('span')?.textContent||'').trim().toLowerCase();
     if(!keep.has(label))c.remove();
   });
   if(!grid.querySelector('.ms791-pin-cell'))step.remove();
 }
 window.ms791RenderGraph=function(view){
   const out=typeof priorRender==='function'?priorRender(view):undefined;
   decorate(view);setTimeout(()=>decorate(view),0);return out;
 };
 window.ms791Pin=function(view,key){
   if(!VIEWS.includes(view))return typeof priorPin==='function'?priorPin(view,key):undefined;
   const isExternal=!!EXTERNAL[view]?.has(key),isMeaningful=!!MEANINGFUL[view]?.has(key);
   if(!isExternal&&!isMeaningful)return; // Static graph boxes do not open a duplicate detail panel.
   const out=typeof priorPin==='function'?priorPin(view,key):undefined;
   const box=document.getElementById('ms791Pin-'+view);if(!box)return out;
   const step=box.querySelector('.ms799-step');
   if(isMeaningful)cleanMeaningful(view,key,box);
   else if(step)step.remove(); // External-action drill-down: common record context + governed action only.
   return out;
 };
 const repaint=()=>VIEWS.forEach(v=>{try{decorate(v)}catch(_){}});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(repaint,160),{once:true});else setTimeout(repaint,80);
 document.addEventListener('aip:data-source-changed',()=>setTimeout(repaint,120));
 window.AIP_V804_AUDIT={
   meaningfulDropdownOnly:true,
   meaningfulDropdowns:{preventive:['interval'],predictive:['window'],corrective:[],riskbased:['safety','composite'],adaptive:['interval']},
   duplicateSelectedStepRemoved:true,
   externalActionDetail:'Common Record Context + governed action only',
   dropdownSymbol:'white vertical line + arrow on deep-purple palette badge',
   excelBusinessDataChanged:false
 };
})();
