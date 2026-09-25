
(function(){
  function restoreBaselineOrigin(e){
    const ret=window.AIP_PLAN_BASELINE_RETURN;
    const root=document.getElementById('view-resourceplanning');
    if(!ret||!root?.classList.contains('active'))return false;
    const U=window.PLAN_UI||{};
    if(U.tab!=='schedule')return false;
    if(e){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();}
    window.AIP_PLAN_BASELINE_RETURN=null;
    try{window.planSetTab?.(ret.tab||'optimize')}catch(_){U.tab=ret.tab||'optimize';try{window.renderPlanningOptimization?.()}catch(__){}}
    setTimeout(()=>window.scrollTo(0,Number(ret.scrollY)||0),20);
    return true;
  }
  window.addEventListener('click',function(e){
    if(e.target?.closest?.('#aipBackBtn,#aipGlobalBack'))restoreBaselineOrigin(e);
  },true);
  window.addEventListener('keydown',function(e){
    if(e.altKey&&e.key==='ArrowLeft')restoreBaselineOrigin(e);
  },true);
  window.AIP_V243_AUDIT={release:'v243',baseline:'v242',excelBusinessDataChanged:false,changes:[
    'Removed optimization-running ring from the top RS avatar; center spinner retained',
    'Optimize control labels slightly enlarged',
    'Planning Basis, Planning Horizon, Interventions in Scope, Optimization Engine and Optimization Objective selects use a subtle light-purple border',
    'View Baseline Schedule now stores an internal return context so Back/Alt+Left restores Optimize & Govern rather than a prior application-level view'
  ]};
})();
