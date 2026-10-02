
(function(){
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
 function clean(){
   VIEWS.forEach(v=>{
     const root=document.getElementById('view-'+v);
     const ws=root?.querySelector('.ms686-workspace');
     if(!ws)return;
     ws.querySelectorAll('.ms697-context-note').forEach(n=>n.remove());
   });
 }
 let raf=0;
 function schedule(){
   if(raf)return;
   raf=requestAnimationFrame(()=>{raf=0;clean();});
 }
 document.addEventListener('change',()=>setTimeout(schedule,20),true);
 document.addEventListener('aip:data-source-changed',()=>setTimeout(schedule,30));
 const main=document.getElementById('main')||document.body;
 new MutationObserver(muts=>{
   if(muts.some(m=>[...m.addedNodes].some(n=>n.nodeType===1 && (n.matches?.('.ms686-workspace')||n.querySelector?.('.ms686-workspace'))))) schedule();
 }).observe(main,{childList:true,subtree:true});
 setTimeout(schedule,40);
 setTimeout(schedule,220);
})();
