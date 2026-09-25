
(function(){
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
 function isStrategyRoot(el){return !!el?.closest?.('#view-preventive,#view-predictive,#view-corrective,#view-riskbased,#view-adaptive')}
 function neutralize(){
   VIEWS.forEach(v=>{
     const root=document.getElementById('view-'+v),ws=root?.querySelector('.ms686-workspace');if(!ws)return;
     /* Re-run after every renderer refresh; do not depend on a one-time dataset flag. */
     ws.querySelectorAll('.ms686-score').forEach(x=>{x.removeAttribute('onclick');x.style.cursor='default';});
     ws.querySelectorAll('.ms686-action').forEach(x=>{x.removeAttribute('onclick');x.style.cursor='default';x.querySelectorAll('.ms686-drill').forEach(b=>b.remove());});
     ws.querySelectorAll('.ms686-knode').forEach(x=>{x.removeAttribute('onclick');x.querySelectorAll('.d').forEach(d=>d.remove());});
     const cards=ws.querySelectorAll('.ms686-card');
     cards.forEach(card=>{
       const head=card.querySelector(':scope>.ms686-head');if(!head)return;
       const title=head.querySelector('h3')?.textContent||'';
       head.querySelectorAll(':scope>.ms686-drill').forEach(b=>b.remove());
       if(/Strategy Reasoning Graph/i.test(title)){
         let b=head.querySelector(':scope>.ms690-expand');
         if(!b){b=document.createElement('button');b.type='button';b.className='ms690-expand';b.title='Show reasoning detail';b.setAttribute('aria-label','Show reasoning detail');b.innerHTML='<svg class="ms741-down-arrow" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><line class="ms741-arrow-shaft" x1="8" y1="2" x2="8" y2="10"></line><polyline class="ms741-arrow-head" points="4.5,7.5 8,11 11.5,7.5"></polyline></svg>';b.onclick=function(e){e.stopPropagation();window.ms690Detail?.('graph690')};head.appendChild(b)}
       } else head.querySelectorAll(':scope>.ms690-expand').forEach(b=>b.remove());
     });
   });
 }
 /* Hard-stop legacy local drawers from these display-only areas, including immediately after scope rerenders. */
 const old686=window.ms686Detail;
 window.ms686Detail=function(type,arg){
   if(['scores','score','migration','sufficiency','recommendation','graph','work','condition','risk','failure','evidence','quality'].includes(String(type||''))) return;
   return old686?.apply(this,arguments);
 };
 document.addEventListener('click',function(e){
   if(!isStrategyRoot(e.target))return;
   const blocked=e.target.closest?.('.ms686-score,.ms686-action,.ms686-knode');
   if(blocked){e.preventDefault();e.stopImmediatePropagation();return false;}
 },true);
 const main=document.getElementById('main')||document.body;
 new MutationObserver(()=>requestAnimationFrame(neutralize)).observe(main,{subtree:true,childList:true});
 document.addEventListener('aip:data-source-changed',()=>setTimeout(neutralize,30));
 document.addEventListener('change',()=>setTimeout(neutralize,20),true);
 setTimeout(neutralize,20);setTimeout(neutralize,180);
})();
