
(function(){
  'use strict';

  function renderPredictive(){
    const view=document.getElementById('view-operationaltwin');
    if(!view)return;

    let body=view.querySelector('#twBody');
    if(!body){
      const exp=view.querySelector('#twExperienceBody');
      if(exp){
        body=document.createElement('div');
        body.id='twBody';
        exp.appendChild(body);
      }
    }

    if(typeof window.AIPRenderOperationalTwinPredictiveOutlook==='function'){
      try{
        if(typeof window.AIPOperationalTwinForecastSVG!=='function')throw new Error('Predictive chart helper did not initialize');
        window.AIPRenderOperationalTwinPredictiveOutlook();
        return;
      }catch(err){
        if(body){
          body.innerHTML='<div class="ot297-card" style="padding:18px"><h3 style="margin:0 0 6px">Predictive Outlook</h3><div class="xi-muted">Predictive Outlook could not render. Runtime error: '+String(err&&err.message||err)+'</div></div>';
        }
        return;
      }
    }

    if(body){
      body.innerHTML='<div class="ot297-card" style="padding:18px"><h3 style="margin:0 0 6px">Predictive Outlook</h3><div class="xi-muted">Predictive Outlook renderer did not initialize.</div></div>';
    }
  }

  document.addEventListener('click',function(e){
    const btn=e.target.closest?.('#view-operationaltwin #tLayers .xi-tab');
    if(!btn||btn.textContent.trim()!=='Predictive Outlook')return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const view=document.getElementById('view-operationaltwin');
    view?.querySelectorAll('#tLayers .xi-tab').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');

    window.AIP_V21=window.AIP_V21||{};
    window.AIP_V21.state=window.AIP_V21.state||{};
    window.AIP_V21.state.layer='Predictive Outlook';

    renderPredictive();
  },true);

  // Keep Predictive Outlook stable across site switches while it is active.
  document.addEventListener('change',function(e){
    if(!e.target?.matches?.('#view-operationaltwin #tSite'))return;
    const active=document.querySelector('#view-operationaltwin #tLayers .xi-tab.active')?.textContent.trim();
    if(active==='Predictive Outlook')setTimeout(renderPredictive,0);
  },false);
})();
