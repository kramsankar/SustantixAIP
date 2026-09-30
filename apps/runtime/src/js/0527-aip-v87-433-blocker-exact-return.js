
(function(){
  'use strict';

  function restore(){
    const ctx=window.AIP_DI_BLOCKER_RETURN;
    if(!ctx)return false;

    window.AIP_DI_BLOCKER_RETURN=null;
    window.AIP_DI_RETURN_TO_OVERVIEW_ID=ctx.decisionId;
    window.AIP_DI_ACTIVE_ROW=ctx.decisionId;
    window.AIP_DI_SELECTED_CONTEXT={decisionId:ctx.decisionId};

    const finish=()=>{
      const s=window.AIP_DI_V401_STATE;
      if(!s)return;
      s.selected=ctx.decisionId;
      s.tab='overview';
      s.stage='map';
      window.AIP_DI_WORKSPACE_ORIGIN=null;
      if(typeof window.renderDecisionIntelligenceV401==='function')window.renderDecisionIntelligenceV401();
      else if(typeof window.renderDecisionIntelligence==='function')window.renderDecisionIntelligence();
      setTimeout(()=>window.AIPDecisionOverviewReturnV423?.restore?.(),0);
      setTimeout(()=>window.AIPDecisionOverviewReturnV423?.restore?.(),80);
    };

    const view=document.getElementById('view-decisionintelligence');
    if(view?.classList.contains('active')){finish();return true;}

    const nav=document.querySelector('.nav-item[data-view="decisionintelligence"]');
    if(nav)nav.click();
    else if(typeof window.activate==='function')window.activate('decisionintelligence');
    setTimeout(finish,0);
    setTimeout(finish,80);
    return true;
  }

  // Product Back from any blocker destination returns to the exact Decision Overview row.
  window.addEventListener('click',function(e){
    const back=e.target?.closest?.('#aipBackBtn');
    if(!back||!window.AIP_DI_BLOCKER_RETURN)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    restore();
  },true);

  window.addEventListener('keydown',function(e){
    if(!e.altKey||e.key!=='ArrowLeft'||!window.AIP_DI_BLOCKER_RETURN)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    restore();
  },true);

  window.AIPDecisionBlockerReturnV433={restore};
})();
