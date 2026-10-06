
(function(){
 const phrases=[
  'current degree of fit across five maintenance strategies',
  'suitability gap identified from linked evidence for selected context'
 ];
 function clean(){
  document.querySelectorAll('#view-preventive *,#view-predictive *,#view-corrective *,#view-riskbased *,#view-adaptive *').forEach(el=>{
   if(el.children.length)return;
   const t=(el.textContent||'').trim().toLowerCase().replace(/\.$/,'');
   if(phrases.includes(t))el.remove();
  });
 }
 let raf=0;function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;clean()})}
 document.addEventListener('change',()=>setTimeout(schedule,25),true);
 document.addEventListener('aip:data-source-changed',()=>setTimeout(schedule,35));
 const main=document.getElementById('main')||document.body;
 new MutationObserver(schedule).observe(main,{childList:true,subtree:true});
 setTimeout(schedule,50);setTimeout(schedule,220);
})();
