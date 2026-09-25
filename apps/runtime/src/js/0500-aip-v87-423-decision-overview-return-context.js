
(function(){
  'use strict';

  function restore(){
    const id=window.AIP_DI_RETURN_TO_OVERVIEW_ID;
    if(!id)return false;

    const view=document.getElementById('view-decisionintelligence');
    const state=window.AIP_DI_V401_STATE;
    if(!view||!view.classList.contains('active')||!state||state.tab!=='overview')return false;

    const row=view.querySelector(`#di401Rows tr[data-di-row-id="${CSS.escape(id)}"]`);
    if(!row)return false;

    // Clear older markers and mark the exact returned decision row.
    view.querySelectorAll('#di401Rows tr[data-di-row-id]').forEach(r=>{
      r.classList.remove('di423-returned-row','di419-context-row','di417-selected-row','di416-key-selected');
    });

    row.classList.add('di423-returned-row','di477-selected-context');

    // Keep all Decision Intelligence selection sources aligned to this row.
    state.selected=id;
    window.AIP_DI_ACTIVE_ROW=id;
    window.AIP_DI_SELECTED_CONTEXT={decisionId:id};
    window.AIP_DI_RETURN_TO_OVERVIEW_ID=id;

    row.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});

    // Keep the highlight persistent until another row becomes active.
    return true;
  }

  // Restore after overview render paths.
  window.AIPDecisionOverviewReturnV423={restore};

  document.addEventListener('click',function(e){
    const tab=e.target?.closest?.('#view-decisionintelligence .di401-tab[data-di-tab="overview"]');
    if(!tab)return;
    setTimeout(restore,0);
    setTimeout(restore,60);
  },true);

  // Once another row is interacted with, remove the return marker.
  document.addEventListener('pointerdown',function(e){
    const row=e.target?.closest?.('#view-decisionintelligence #di401Rows tr[data-di-row-id]');
    if(!row)return;
    document.querySelectorAll('#view-decisionintelligence #di401Rows tr.di423-returned-row').forEach(r=>{
      if(r!==row)r.classList.remove('di423-returned-row');
    });
    window.AIP_DI_RETURN_TO_OVERVIEW_ID=row.dataset.diRowId;
  },true);
})();
