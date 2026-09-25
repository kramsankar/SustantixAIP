
(function(){
  'use strict';

  function authoritativeRender(){
    const fn=window.renderDecisionIntelligenceV401;
    if(typeof fn!=='function')return false;

    window.renderDecisionIntelligence=fn;

    try{
      if(typeof renderFns!=='undefined')renderFns.decisionintelligence=fn;
    }catch(_e){}

    try{
      if(window.AIP_V21?.renderers)window.AIP_V21.renderers.decisionintelligence=fn;
    }catch(_e){}

    try{
      if(window.AIP_V21?.state && document.getElementById('view-decisionintelligence')?.classList.contains('active')){
        fn();
      }
    }catch(_e){}

    return true;
  }

  function renderIfActive(){
    const view=document.getElementById('view-decisionintelligence');
    if(!view||!view.classList.contains('active'))return;
    authoritativeRender();
    if(typeof window.renderDecisionIntelligenceV401==='function'){
      window.renderDecisionIntelligenceV401();
    }
  }

  // Rebind the global renderer after every late initialization pass.
  authoritativeRender();
  setTimeout(authoritativeRender,0);
  setTimeout(authoritativeRender,100);
  setTimeout(authoritativeRender,400);
  setTimeout(authoritativeRender,1000);

  // When Decision Intelligence is selected in the left navigation, allow the
  // platform to activate the view, then replace its contents with the new thread.
  document.addEventListener('click',function(e){
    const nav=e.target.closest?.('#sidebar .nav-item[data-view="decisionintelligence"]');
    if(!nav)return;
    setTimeout(renderIfActive,0);
    setTimeout(renderIfActive,80);
    setTimeout(renderIfActive,220);
  },false);

  // Preserve the new renderer through data-source refreshes.
  document.addEventListener('aip:data-source-changed',function(){
    authoritativeRender();
    setTimeout(renderIfActive,0);
    setTimeout(renderIfActive,120);
  });
  document.addEventListener('apm:datasource-refreshed',function(){
    authoritativeRender();
    setTimeout(renderIfActive,0);
    setTimeout(renderIfActive,120);
  });

  window.AIPDecisionThreadAuthorityV402={
    render:renderIfActive,
    bind:authoritativeRender
  };
})();
