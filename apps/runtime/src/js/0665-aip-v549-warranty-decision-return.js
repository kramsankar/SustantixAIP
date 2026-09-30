
(function(){
  const prevOpen=window.AIPOpenWarrantyClaims;
  if(typeof prevOpen==='function'){
    window.AIPOpenWarrantyClaims=function(ctx){
      try{
        const c=ctx||{};
        if(c.decisionId || window.AIP_DI_EVIDENCE_CONTEXT?.decisionId){
          window.AIP_WARRANTY_RETURN_CONTEXT={
            view:'decisionintelligence',
            tab:'assetvalue',
            decisionId:String(c.decisionId||window.AIP_DI_EVIDENCE_CONTEXT?.decisionId||''),
            atvMode:String(window.AIP_ATV_RETURN_CONTEXT?.mode||'business'),
            ts:Date.now()
          };
        }
      }catch(e){}
      return prevOpen.apply(this,arguments);
    };
  }

  window.AIPReturnFromWarrantyToDecision=function(){
    const rc=window.AIP_WARRANTY_RETURN_CONTEXT;
    if(!rc || rc.view!=='decisionintelligence') return false;
    try{
      window.AIP_WARRANTY_CONTEXT=null;
      window.AIP_WARRANTY_NAV_PENDING=false;
      window.__ml534SelectedClaim='';
      if(window.AIP_DI_V401_STATE){
        window.AIP_DI_V401_STATE.tab='assetvalue';
      }
      window.AIP_ATV_MODE_BY_DECISION=window.AIP_ATV_MODE_BY_DECISION||{};
      window.AIP_ATV_MODE_BY_DECISION[String(rc.decisionId||'')]=rc.atvMode==='lineage'?'lineage':'business';
      window.AIP_ATV_RETURN_CONTEXT={decisionId:rc.decisionId,mode:window.AIP_ATV_MODE_BY_DECISION[String(rc.decisionId||'')],tab:'assetvalue',ts:Date.now()};
      if(typeof activate==='function') activate('decisionintelligence');
      setTimeout(function(){
        try{
          if(window.AIP_DI_V401_STATE) window.AIP_DI_V401_STATE.tab='assetvalue';
          if(typeof renderDecisionIntelligenceV401==='function') renderDecisionIntelligenceV401();
          const v=document.getElementById('view-decisionintelligence');
          if(v){
            const candidates=[...v.querySelectorAll('button,[role="tab"],.tab,.di-tab')];
            const b=candidates.find(x=>/asset[\s-]*to[\s-]*value/i.test((x.textContent||'').trim()));
            if(b && typeof b.click==='function') b.click();
          }
        }catch(e){}
      },0);
      window.AIP_WARRANTY_RETURN_CONTEXT=null;
      return true;
    }catch(e){return false;}
  };

  /* Capture the top-left application Back control only while in contextual Warranty & Claims. */
  document.addEventListener('click',function(e){
    const v=document.getElementById('view-maintenancelearning');
    const rc=window.AIP_WARRANTY_RETURN_CONTEXT;
    if(!v || !v.classList.contains('active') || !rc) return;
    const el=e.target && e.target.closest ? e.target.closest('button,a,[role="button"]') : null;
    if(!el) return;
    const txt=((el.getAttribute('aria-label')||'')+' '+(el.getAttribute('title')||'')+' '+(el.textContent||'')).trim();
    const r=el.getBoundingClientRect();
    const isTopLeftBack=/\bback\b/i.test(txt) || ((r.left<220 && r.top<150) && /[←‹⟵]/.test(el.textContent||''));
    if(!isTopLeftBack) return;
    if(window.AIPReturnFromWarrantyToDecision()){
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },true);
})();
window.AIP_CURRENT_BUILD='v549';
