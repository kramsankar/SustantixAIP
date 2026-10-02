
(function(){
  'use strict';

  function scenarioFromGF(){
    if(!window.AIP_GF_SCENARIO_ORIGIN)return false;
    const view=document.getElementById('view-operationaltwin');
    if(!view)return false;
    const active=[...view.querySelectorAll('#tLayers .xi-tab')].find(b=>b.classList.contains('active'));
    return !!active && active.textContent.trim()==='Scenario Lab';
  }

  function restoreGenerationForecast(){
    const origin=window.AIP_GF_SCENARIO_ORIGIN;
    if(!origin)return false;

    const view=document.getElementById('view-operationaltwin');
    if(!view)return false;

    const site=view.querySelector('#tSite');
    if(site&&origin.site&&[...site.options].some(o=>o.value===origin.site)){
      site.value=origin.site;
    }

    window.AIP_GF_SCENARIO_ORIGIN=null;

    if(typeof window.AIPActivateOperationalTwinLayer==='function'){
      window.AIPActivateOperationalTwinLayer('Generation Forecast');
      return true;
    }

    const btn=[...view.querySelectorAll('#tLayers .xi-tab')].find(
      b=>b.textContent.trim()==='Generation Forecast'||b.dataset.v291==='predict'
    );
    if(btn){
      if(typeof btn.onclick==='function')btn.onclick();
      else btn.click();
      return true;
    }
    return false;
  }

  // Capture the product Back button before the view-history handler runs.
  document.addEventListener('click',function(e){
    const back=e.target.closest?.('#aipBackBtn');
    if(!back||!scenarioFromGF())return;
    e.preventDefault();
    e.stopImmediatePropagation();
    restoreGenerationForecast();
  },true);

  // Same behavior for Alt+Left while Scenario Lab was opened from Generation Forecast.
  document.addEventListener('keydown',function(e){
    if(!e.altKey||e.key!=='ArrowLeft'||!scenarioFromGF())return;
    e.preventDefault();
    e.stopImmediatePropagation();
    restoreGenerationForecast();
  },true);
})();
