
(function(){
  function rerenderActiveOverviewDrilldown(){
    const active=document.querySelector('.view.active[id]');
    if(!active)return;
    const id=active.id;
    try{
      if(id==='view-workorderintelligence')renderWorkOrderIntelligence();
      else if(id==='view-financialimpact')renderFinancialImpact();
      else if(id==='view-scenariosimulator')renderScenarioSimulator();
    }catch(e){
      console.error('Overview drilldown refresh failed',id,e);
    }
  }
  document.addEventListener('aip:data-source-changed',()=>requestAnimationFrame(()=>requestAnimationFrame(rerenderActiveOverviewDrilldown)));
  document.addEventListener('apm:datasource-refreshed',()=>requestAnimationFrame(()=>requestAnimationFrame(rerenderActiveOverviewDrilldown)));
})();
