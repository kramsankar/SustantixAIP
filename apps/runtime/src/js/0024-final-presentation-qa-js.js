
(function(){
  const KPI_SELECTOR='.card,.ops-kpi,.aig-kpi,.sx-kpi,.vision-kpi,.avx-kpi,.dm-kpi,.ai3-kpi';
  function currentSource(){
    try{return String(window.APM_DATA_MODE||APM_DATA_MODE||'Synthetic data')}catch(e){return 'Synthetic data'}
  }
  function stampSource(root=document){
    const source=currentSource();
    document.documentElement.dataset.apmSource=source.toLowerCase().replace(/[^a-z0-9]+/g,'-');
    root.querySelectorAll('.qa-source-chip').forEach(chip=>chip.remove());
  }
  function polish(root=document){
    if(typeof window.enhanceAllKPIs==='function') window.enhanceAllKPIs(root);
    if(typeof window.updateKPIContext==='function') window.updateKPIContext(root);
    stampSource(root);
    root.querySelectorAll(KPI_SELECTOR).forEach((el,i)=>{
      el.style.setProperty('--qa-kpi-index',i);
      if(!el.getAttribute('aria-label')){
        const label=el.querySelector('.kpi-label,.lbl,.l,[class*="label"]')?.textContent?.trim();
        const value=el.querySelector('.kpi-value,.val,.n,[class*="value"]')?.textContent?.trim();
        if(label||value) el.setAttribute('aria-label',[label,value].filter(Boolean).join(': '));
      }
    });
    root.querySelectorAll('table').forEach(t=>{
      if(t.parentElement && !t.parentElement.classList.contains('qa-table-scroll')){
        const w=document.createElement('div');w.className='qa-table-scroll';w.style.cssText='max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch';
        t.parentNode.insertBefore(w,t);w.appendChild(t);
      }
    });
  }
  function run(){requestAnimationFrame(()=>requestAnimationFrame(()=>polish(document)))}
  const original=window.refreshAllAPM;
  if(typeof original==='function'){
    window.refreshAllAPM=function(){
      const result=original.apply(this,arguments);
      run();
      document.dispatchEvent(new CustomEvent('apm:datasource-refreshed',{detail:{source:currentSource()}}));
      return result;
    };
  }
  document.addEventListener('apm:datasource-refreshed',run);
  window.addEventListener('resize',()=>{clearTimeout(window.__qaResize);window.__qaResize=setTimeout(run,120)});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();
  const main=document.getElementById('main')||document.body;
  const Observer=window.__APMSafeMutationObserver||window.MutationObserver;
  if(Observer){let queued=false;new Observer(()=>{if(window.__aipScrollbarDragActive||window.__aipMainScrollActive)return;if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;if(!window.__aipScrollbarDragActive&&!window.__aipMainScrollActive)polish(main)})}).observe(main,{childList:true,subtree:true});}
})();
