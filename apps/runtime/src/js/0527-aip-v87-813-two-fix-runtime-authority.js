
(function(){
 'use strict';
 window.AIP_CURRENT_BUILD='v87_813';
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
 function installBasis(view){
   const root=document.getElementById('view-'+view);if(!root)return;
   root.querySelectorAll('.ms791-node').forEach(n=>{
     const go=n.querySelector(':scope>.ms791-go');
     n.querySelectorAll(':scope>.ms813-basis-caption').forEach(x=>x.remove());
     if(!n.classList.contains('ms804-meaningful')||!go)return;
     const cap=document.createElement('span');
     cap.className='ms813-basis-caption';cap.textContent='Basis';cap.setAttribute('aria-hidden','true');
     go.insertAdjacentElement('beforebegin',cap);
   });
 }
 function stripReasoningFrame(){
   const m=document.getElementById('ms686Modal');if(!m)return;
   const title=(m.querySelector('h2')?.textContent||'').trim();
   if(!/Strategy Reasoning Detail/i.test(title))return;
   const p=m.querySelector('.ms686-panel'),body=m.querySelector('.ms686-body'),grid=m.querySelector('.ms708-calc-grid');
   [p,body,grid].filter(Boolean).forEach(el=>{
     el.classList.remove('ms713-accent-summary');
     ['border','border-top','border-right','border-bottom','border-left','outline','box-shadow','background-image'].forEach(k=>el.style.setProperty(k,'none','important'));
     ['border-width','outline-width'].forEach(k=>el.style.setProperty(k,'0','important'));
     ['border-color','outline-color'].forEach(k=>el.style.setProperty(k,'transparent','important'));
   });
   if(p)p.style.setProperty('background','#fff','important');
 }
 function run(){VIEWS.forEach(installBasis);stripReasoningFrame()}
 const prev=window.ms791RenderGraph;
 window.ms791RenderGraph=function(view){
   const out=typeof prev==='function'?prev(view):undefined;
   installBasis(view);requestAnimationFrame(()=>installBasis(view));setTimeout(()=>installBasis(view),40);
   return out;
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,180),{once:true});else setTimeout(run,80);
 document.addEventListener('click',e=>{
   if(e.target.closest?.('.aip-maint-subtabs,.ms791-node,.ms738-expand-reasoning')){
     setTimeout(run,15);setTimeout(stripReasoningFrame,60);
   }
 },true);
 const mo=new MutationObserver(()=>{clearTimeout(window.__aip813t);window.__aip813t=setTimeout(run,20)});
 if(document.body)mo.observe(document.body,{childList:true,subtree:true});
 window.AIP_V813_AUDIT={basisCaption:'Actual static DOM Basis caption immediately beside every meaningful Strategy Reasoning down-arrow.',modal:'Strategy Reasoning Detail outer panel/body/grid frame removed; internal cards retained.',excelBusinessDataChanged:false};
})();
