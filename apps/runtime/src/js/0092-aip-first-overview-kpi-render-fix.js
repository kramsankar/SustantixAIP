
(function(){
  'use strict';
  let pending=[];
  function clearPending(){ pending.forEach(clearTimeout); pending=[]; }
  function normalizeOverview(){
    const view=document.getElementById('view-overview');
    if(!view) return;
    const master=window.AIPKPIMaster;
    if(master&&typeof master.scan==='function'){
      try{ master.scan(view); }catch(_){ try{ master.scan(); }catch(__){} }
    }
  }
  function scheduleOverviewNormalization(){
    clearPending();
    normalizeOverview();
    requestAnimationFrame(()=>{ normalizeOverview(); requestAnimationFrame(normalizeOverview); });
    [30,90,180,350].forEach(ms=>pending.push(setTimeout(normalizeOverview,ms)));
  }
  document.addEventListener('aip:pre-reveal-layout',scheduleOverviewNormalization);
  document.addEventListener('aip:login-complete',scheduleOverviewNormalization);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(scheduleOverviewNormalization,0),{once:true});
})();
