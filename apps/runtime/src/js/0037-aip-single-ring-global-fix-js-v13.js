
(function(){
  function dedupe(root=document){
    root.querySelectorAll('.aip-ring-enabled').forEach(card=>{
      const wraps=[...card.querySelectorAll(':scope > .aip-kpi-ring-wrap')];
      wraps.slice(0,-1).forEach(x=>x.remove());
    });
  }
  const run=()=>dedupe(document);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
  const main=document.getElementById('main')||document.body;
  new window.__APMSafeMutationObserver(()=>requestAnimationFrame(run)).observe(main,{childList:true,subtree:true});
})();
