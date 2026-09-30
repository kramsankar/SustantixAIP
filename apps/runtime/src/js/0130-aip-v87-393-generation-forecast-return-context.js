
(function(){
  function restoreGF(){
    const ctx=window.AIP_RETURN_CONTEXT;
    if(!ctx||ctx.view!=='operationaltwin')return;

    const view=document.getElementById('view-operationaltwin');
    if(!view)return;

    const r=view.getBoundingClientRect();
    if(r.width<=0||r.height<=0)return;

    const site=view.querySelector('#tSite');
    if(site&&ctx.site&&[...site.options].some(o=>o.value===ctx.site))site.value=ctx.site;

    window.AIP_V21=window.AIP_V21||{};
    window.AIP_V21.state=window.AIP_V21.state||{};
    window.AIP_V21.state.layer='Predictive Outlook';

    const btn=[...view.querySelectorAll('#tLayers .xi-tab')].find(
      b=>b.textContent.trim()==='Generation Forecast'||b.dataset.v291==='predict'
    );
    if(!btn)return;

    window.AIP_RETURN_CONTEXT=null;

    if(typeof window.AIPRenderGenerationForecast==='function'){
      view.querySelectorAll('#tLayers .xi-tab').forEach(x=>x.classList.remove('active'));
      btn.classList.add('active');
      window.AIPRenderGenerationForecast();
    }else{
      btn.click();
    }
  }

  document.addEventListener('click',function(){
    setTimeout(restoreGF,0);
    setTimeout(restoreGF,120);
  },false);

  window.addEventListener('popstate',function(){
    setTimeout(restoreGF,0);
    setTimeout(restoreGF,120);
  });
})();
