
(function(){
 const ids=['view-preventive','view-predictive','view-corrective','view-riskbased','view-adaptive'];
 function bars(){const s=document.createElement('span');s.className='aip-kpi-master-bars';s.setAttribute('aria-hidden','true');s.innerHTML='<i></i><i></i><i></i><i></i><i></i>';return s}
 function fix(root){
   if(!root)return;
   const grid=root.querySelector(':scope > .aip-maintenance-master-kpis');if(!grid)return;
   [...grid.children].forEach(card=>{
     if(!card.classList.contains('aip-kpi-master'))return;
     const all=[...card.querySelectorAll(':scope > .aip-kpi-master-bars')];
     all.slice(1).forEach(x=>x.remove());
     if(!all[0])card.appendChild(bars());
   });
 }
 function fixAll(){ids.forEach(id=>fix(document.getElementById(id)))}
 document.addEventListener('click',e=>{if(e.target.closest('.aip-maint-subtabs,[data-view]')){requestAnimationFrame(fixAll);setTimeout(fixAll,30)}},true);
 const mo=new MutationObserver(ms=>{for(const m of ms){const el=m.target.nodeType===1?m.target:m.target.parentElement;if(el&&ids.some(id=>el.closest&&el.closest('#'+id))){requestAnimationFrame(fixAll);break}}});
 if(document.body)mo.observe(document.body,{childList:true,subtree:true});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fixAll);else fixAll();
 window.addEventListener('load',()=>setTimeout(fixAll,0));
})();
