
(function(){
  function restoreOrigin(){
    const ctx=window.AIP_PREDICTIVE_WO_CONTEXT;
    if(!ctx||!ctx.active)return false;
    const origin=String(ctx.returnView||'predictive');

    if(origin==='predictive'){
      if(ctx.predictiveClass)P754_SELECTED_CLASS=ctx.predictiveClass;
      if(ctx.predictiveAlert)P754_SELECTED_ALERT=ctx.predictiveAlert;
      P766_PREDICTION_PINNED=!!ctx.predictivePinned;
      if(ctx.predictiveThreshold==='All'||Number.isFinite(Number(ctx.predictiveThreshold)))P771_THRESHOLD_DAYS=ctx.predictiveThreshold==='All'?'All':Number(ctx.predictiveThreshold);
      if(typeof ctx.predictiveSearch==='string')P758_PREDICTION_SEARCH=ctx.predictiveSearch;
    }

    try{activate(origin,true)}catch(_){try{activate(origin)}catch(__){}}

    if(origin==='predictive'){
      try{if(typeof renderPredictive==='function')renderPredictive()}catch(_){}
      requestAnimationFrame(()=>{
        const root=document.getElementById('view-predictive');
        const id=String(ctx.predictiveAlert||'');
        if(root?.classList.contains('active')&&id){
          const escId=(window.CSS&&CSS.escape)?CSS.escape(id):id.replace(/["\\]/g,'\\$&');
          root.querySelector(`tr[data-p754-alert="${escId}"]`)?.scrollIntoView({block:'nearest',behavior:'auto'});
        }
      });
    }

    window.AIP_PREDICTIVE_WO_CONTEXT=null;
    return true;
  }

  function shouldOwnBack(){
    const ctx=window.AIP_PREDICTIVE_WO_CONTEXT;
    const wo=document.getElementById('view-workorderintelligence');
    return !!ctx?.active && !!wo?.classList.contains('active');
  }

  // The visible product Back control beside the Sustantix logo is #aipBackBtn.
  window.addEventListener('click',function(e){
    const back=e.target?.closest?.('#aipBackBtn');
    if(!back||!shouldOwnBack())return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    restoreOrigin();
  },true);

  window.addEventListener('keydown',function(e){
    if(!e.altKey||e.key!=='ArrowLeft'||!shouldOwnBack())return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    restoreOrigin();
  },true);

  window.p762RestorePredictiveFromWO=restoreOrigin;
})();
