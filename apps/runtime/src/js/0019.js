
(function(){
  const run=()=>{try{if(typeof enforceWarrantyOpenDaysIntegers==='function')enforceWarrantyOpenDaysIntegers()}catch(e){}};
  document.addEventListener('DOMContentLoaded',run);
  let __wodQueued=false;
  const observer=new window.__APMSafeMutationObserver(()=>{
    if(__wodQueued) return;
    __wodQueued=true;
    requestAnimationFrame(()=>{__wodQueued=false;run();});
  });
  document.addEventListener('DOMContentLoaded',()=>{
    const target=document.getElementById('view-warrantyrecovery')||document.getElementById('main')||document.body;
    observer.observe(target,{subtree:true,childList:true});
  });
  // Fallback safety net only; renderWarrantyRecovery() already calls run() directly.
  setTimeout(run,500);
})();
