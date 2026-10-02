
(function(){
  'use strict';
  function state(){return window.AIP_DI_V401_STATE||null}
  function sync(id){if(!id)return;window.AIP_DI_ACTIVE_ROW=id;window.AIP_DI_SELECTED_CONTEXT={decisionId:id};window.AIP_DI_RETURN_TO_OVERVIEW_ID=id;const s=state();if(s)s.selected=id}
  window.addEventListener('pointerdown',function(e){const row=e.target?.closest?.('#view-decisionintelligence #di401Rows tr[data-di-row-id]');if(row)sync(row.dataset.diRowId)},true);
  window.addEventListener('click',function(e){const review=e.target?.closest?.('#view-decisionintelligence [data-di-review]');if(review)sync(review.dataset.diReview)},true);
  window.addEventListener('click',function(e){const tab=e.target?.closest?.('#view-decisionintelligence .di401-tab[data-di-tab="workspace"]');if(!tab)return;const st=state();if(!st)return;const id=window.AIP_DI_RETURN_TO_OVERVIEW_ID||window.AIP_DI_ACTIVE_ROW||window.AIP_DI_SELECTED_CONTEXT?.decisionId||st.selected;if(!id)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();sync(id);st.tab='workspace';if(!st.stage)st.stage='map';if(typeof window.renderDecisionIntelligenceV401==='function')window.renderDecisionIntelligenceV401();else if(typeof window.renderDecisionIntelligence==='function')window.renderDecisionIntelligence()},true);
  window.AIPDecisionHoverV421={get:function(){return window.AIP_DI_ACTIVE_ROW||null},set:sync};
})();
