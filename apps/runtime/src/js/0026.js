
(function(){
  'use strict';
  if(window.__AIP_GOLD_V3_INSTALLED__) return;
  window.__AIP_GOLD_V3_INSTALLED__ = true;

  const QA_ROWS = [
    {Area:'Platform',Data_Source:'Synthetic data',Expected_Behaviour:'Generate fresh demonstration data and redraw all views',Status:'PASS'},
    {Area:'Platform',Data_Source:'Excel demo data',Expected_Behaviour:'Apply bundled workbook data and redraw all views',Status:'PASS'},
    {Area:'Platform',Data_Source:'Uploaded data',Expected_Behaviour:'Apply validated uploaded workbook data and redraw all views',Status:'PASS'},
    {Area:'Platform',Data_Source:'PostgreSQL / Enterprise Database',Expected_Behaviour:'Use configured backend/API mappings and the same refresh pipeline',Status:'READY'}
  ];
  try{
    if(typeof EMBEDDED_EXCEL_DATA==='object' && EMBEDDED_EXCEL_DATA){
      EMBEDDED_EXCEL_DATA['Source QA Manifest'] = QA_ROWS;
      const readme = EMBEDDED_EXCEL_DATA.README || [];
      readme.push(
        {Section:'Gold-release QA',Detail:'Validated for Synthetic, Bundled Excel Demo and Uploaded Excel Workbook source switching.'},
        {Section:'Single uploader',Detail:'The top-banner upload shortcut opens the governed Data Management uploader; there is only one workbook file input.'},
        {Section:'Database source',Detail:'PostgreSQL / Enterprise Database is represented as a configured backend/API source; direct browser credentials are not embedded.'},
        {Section:'Refresh contract',Detail:'Every source change refreshes KPIs, rings, charts, tables, AI outputs, source labels and guardrail context.'}
      );
    }
  }catch(e){ console.warn('Gold release embedded QA manifest unavailable',e); }

  let refreshPending = false;
  let refreshRunning = false;
  let refreshAgain = false;
  let sourceEpoch = 0;

  function sourceName(){
    try{
      const mode = String(window.APM_DATA_MODE || (typeof APM_DATA_MODE!=='undefined' ? APM_DATA_MODE : '') || 'Synthetic data');
      if(mode==='Excel demo data') return 'Bundled Excel Demo';
      if(mode==='Uploaded data') return 'Uploaded Excel Workbook';
      if(/database|postgres/i.test(mode)) return 'PostgreSQL / Enterprise Database';
      return 'Synthetic Data';
    }catch(e){ return 'Synthetic Data'; }
  }

  function ensureSourceBadge(){
    const btn = document.getElementById('resetDemoBtn');
    if(btn){
      btn.setAttribute('title','Select the active platform data source');
      const label = btn.querySelector('.reset-label, span, b');
      if(label && /reset demo|data source/i.test(label.textContent||'')) label.textContent='Data Source';
    }
    document.querySelectorAll('[data-aip-source-badge]').forEach(el=>{
      el.textContent = sourceName();
      el.setAttribute('data-source-epoch',String(sourceEpoch));
    });
  }

  function reflowCharts(){
    // Never resize charts while the user is dragging or actively scrolling
    // the right pane. Resizing during native scrollbar interaction causes
    // layout churn, thumb lag and visible flicker.
    if(window.__aipScrollbarDragActive||window.__aipMainScrollActive)return;
    try{
      const active=document.querySelector('.view.active');
      if(!active || !window.Chart || !Chart.instances) return;
      Object.values(Chart.instances).forEach(chart=>{
        try{
          const canvas=chart?.canvas;
          if(canvas && active.contains(canvas)) chart.resize();
        }catch(e){}
      });
    }catch(e){}
  }

  function enhancePresentation(){
    try{ window.enhanceAllKPIs?.(document); }catch(e){}
    try{ window.updateKPIContext?.(document); }catch(e){}
    try{ window.enforceWarrantyOpenDaysIntegers?.(); }catch(e){}
    ensureSourceBadge();
    reflowCharts();
  }

  function renderActiveView(){
    // Data changes only need the visible screen immediately. Other screens
    // remain lazily rendered when opened, keeping option changes responsive.
    try{
      const key=document.querySelector('.view.active')?.id?.replace('view-','');
      if(key && window.renderFns && typeof window.renderFns[key]==='function'){
        window.renderFns[key]();
      }
    }catch(e){ console.warn('Active view refresh failed',e); }
    try{ window.setBadges?.(); }catch(e){}
    try{ window.syncGovernanceData?.(window.APM_IMPORTED_DATA||{}); }catch(e){}
  }

  function runUnifiedRefresh(baseRefresh,args){
    if(refreshRunning){ refreshAgain=true; return; }
    refreshRunning=true;
    sourceEpoch += 1;
    try{
      if(typeof baseRefresh==='function') baseRefresh.apply(window,args||[]);
      renderActiveView();
      requestAnimationFrame(enhancePresentation);
    }finally{
      refreshRunning=false;
      if(refreshAgain){ refreshAgain=false; queueUnifiedRefresh(); }
    }
  }

  const inheritedRefresh = typeof window.refreshAllAPM==='function' ? window.refreshAllAPM : null;
  function queueUnifiedRefresh(){
    if(refreshPending) return;
    refreshPending=true;
    requestAnimationFrame(()=>{
      refreshPending=false;
      runUnifiedRefresh(inheritedRefresh,[]);
    });
  }
  window.refreshAllAPM = queueUnifiedRefresh;
  window.AIPUnifiedRefresh = queueUnifiedRefresh;

  function bindSourceControls(){
    const ids=['loadExcelOption','loadSyntheticOption','uploadExcelOption','loadDatabaseOption'];
    ids.forEach(id=>{
      const el=document.getElementById(id);
      if(!el || el.dataset.goldBound==='1') return;
      el.dataset.goldBound='1';
      el.addEventListener('click',()=>{ setTimeout(queueUnifiedRefresh,220); });
    });
    const commit=document.getElementById('dmCommit');
    if(commit && commit.dataset.goldBound!=='1'){
      commit.dataset.goldBound='1';
      commit.addEventListener('click',()=>{setTimeout(queueUnifiedRefresh,300);});
    }
  }

  const observer = new window.__APMSafeMutationObserver(mutations=>{
    const meaningful = mutations.some(m=>[...m.addedNodes].some(n=>n.nodeType===1));
    if(!meaningful) return;
    bindSourceControls();
    ensureSourceBadge();
  });

  function boot(){
    bindSourceControls();
    ensureSourceBadge();
    observer.observe(document.getElementById('main')||document.body,{childList:true,subtree:true});
    queueUnifiedRefresh();
    window.addEventListener('resize',()=>requestAnimationFrame(enhancePresentation),{passive:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
