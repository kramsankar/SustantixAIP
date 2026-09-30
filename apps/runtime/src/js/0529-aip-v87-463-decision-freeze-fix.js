
(()=>{
  'use strict';
  // v87_464: v87_461 Alternative Analysis runtime is intentionally superseded.
  // It contained a MutationObserver that recreated #aa461Compare while v87_462
  // removed it, producing an endless DOM-mutation loop in Decision Workspace.
  const bind=()=>{
    try{
      if(typeof window.AIPRenderAlternativeComparison462==='function'){
        window.AIPRenderAlternativeAnalysis461=window.AIPRenderAlternativeComparison462;
        window.AIPRenderScenarioAnalysis453=window.AIPRenderAlternativeComparison462;
        if(window.AIP_V21?.renderers){
          window.AIP_V21.renderers.scenariosimulator2=window.AIPRenderAlternativeComparison462;
          window.AIP_V21.renderers.scenariosimulator=window.AIPRenderAlternativeComparison462;
        }
        if(typeof renderFns!=='undefined'){
          renderFns.scenariosimulator2=window.AIPRenderAlternativeComparison462;
          renderFns.scenariosimulator=window.AIPRenderAlternativeComparison462;
        }
      }
    }catch(e){console.error('v87_464 Alternative Comparison authority bind failed',e)}
  };
  bind();
  setTimeout(bind,0);
  setTimeout(bind,250);
})();
