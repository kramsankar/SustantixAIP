
(function(){
  function restore(){
    const c=window.AIP_CORRECTIVE_WO_CONTEXT;if(!c?.active)return false;
    CORR773_SELECTED_WO=String(c.workOrderId||'');
    CORR773_SEARCH=String(c.search||'');
    try{activate('corrective',true)}catch(_){try{activate('corrective')}catch(__){}}
    try{renderCorrective()}catch(_){}
    requestAnimationFrame(()=>{
      const root=document.getElementById('view-corrective');
      const id=String(c.workOrderId||'');
      if(root?.classList.contains('active')&&id){
        const esc=(window.CSS&&CSS.escape)?CSS.escape(id):id.replace(/["\\]/g,'\\$&');
        root.querySelector(`tr[data-corr773-wo="${esc}"]`)?.scrollIntoView({block:'nearest',behavior:'auto'});
      }
    });
    window.AIP_CORRECTIVE_WO_CONTEXT=null;return true;
  }
  function owns(){
    return !!window.AIP_CORRECTIVE_WO_CONTEXT?.active && !!document.getElementById('view-workorderintelligence')?.classList.contains('active');
  }
  window.addEventListener('click',e=>{
    const b=e.target?.closest?.('#aipBackBtn');if(!b||!owns())return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();restore();
  },true);
  window.addEventListener('keydown',e=>{
    if(!e.altKey||e.key!=='ArrowLeft'||!owns())return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();restore();
  },true);
  window.corr773RestoreFromWO=restore;
})();
