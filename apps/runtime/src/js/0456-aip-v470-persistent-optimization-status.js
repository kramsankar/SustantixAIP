
(function(){
  let queued=false;
  const restore=()=>{
    queued=false;
    try{ if(typeof restoreOptStatus470==='function') restoreOptStatus470(); }catch(e){}
  };
  const queue=()=>{
    if(queued)return;
    queued=true;
    setTimeout(restore,0);
  };
  const start=()=>{
    const host=document.getElementById('view-resourceplanning');
    if(!host)return;
    const mo=new MutationObserver(queue);
    mo.observe(host,{childList:true,subtree:true});
    queue();
    window.AIP_V470_OPT_STATUS_OBSERVER=mo;
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
  window.AIP_V470_AUDIT={
    release:'v470',
    baseline:'v469',
    changes:[
      'Optimization run-status message persisted in PLAN_UI state',
      'Run-status restored whenever Optimize & Govern DOM is rebuilt',
      'Green successful-run message now survives navigation to other Planning tabs and back',
      'Optimization logic, KPI values, alternatives, and Excel data unchanged'
    ]
  };
})();
