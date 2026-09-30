
(function(){
 'use strict';
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
 function sync(view){
   const root=document.getElementById('view-'+view);
   const card=[...(root?.querySelectorAll('.ms686-card')||[])].find(c=>/Strategy Reasoning Graph/i.test(c.querySelector(':scope>.ms686-head h3')?.textContent||''));
   if(!card)return;
   const rid=card.querySelector('.ms791-host')?.dataset?.ms800reasoning||'';
   if(card.dataset.ms806PanelRid!==rid){
     card.dataset.ms806PanelRid=rid;
     card.querySelectorAll('.ms806-detail-panel').forEach(p=>{p.classList.remove('open');const b=p.querySelector('.ms806-panel-body');if(b)b.innerHTML=''});
   }
 }
 const old=window.ms791RenderGraph;
 window.ms791RenderGraph=function(view){
   const out=typeof old==='function'?old(view):undefined;
   sync(view);setTimeout(()=>sync(view),0);return out;
 };
 const run=()=>VIEWS.forEach(sync);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,150),{once:true});else setTimeout(run,80);
})();
