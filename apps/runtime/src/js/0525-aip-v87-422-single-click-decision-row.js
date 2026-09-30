
(function(){
  'use strict';

  function state(){ return window.AIP_DI_V401_STATE || null; }

  function openDecision(id){
    if(!id)return;
    const s=state();
    if(!s)return;

    window.AIP_DI_ACTIVE_ROW=id;
    window.AIP_DI_SELECTED_CONTEXT={decisionId:id};
    window.AIP_DI_WORKSPACE_ORIGIN={from:'overview',decisionId:id};
    s.selected=id;
    s.tab='workspace';
    s.stage='map';

    if(typeof window.renderDecisionIntelligenceV401==='function'){
      window.renderDecisionIntelligenceV401();
    }else if(typeof window.renderDecisionIntelligence==='function'){
      window.renderDecisionIntelligence();
    }
  }

  // Single click on a row opens that exact decision.
  // Existing row controls keep their own actions.
  window.addEventListener('click',function(e){
    const row=e.target?.closest?.('#view-decisionintelligence #di401Rows tr[data-di-row-id]');
    if(!row)return;

    // Let dedicated controls retain their own click behavior.
    if(e.target.closest?.(
      '[data-di-review],[data-di-priority],[data-di-blockers],button,input,select,a'
    )){
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    openDecision(row.dataset.diRowId);
  },true);

  window.AIPDecisionRowSingleClickV422={open:openDecision};
})();
