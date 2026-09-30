
(function(){
  const STRATEGY_VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];

  function activatePreventiveFresh(){
    const maint=document.getElementById('view-maintenance');
    const prev=document.getElementById('view-preventive');
    if(!prev)return;

    // Fresh-entry default: Preventive.
    STRATEGY_VIEWS.forEach(v=>{
      const pane=document.getElementById('view-'+v);
      if(pane) pane.classList.toggle('active',v==='preventive');
    });

    // Normalize any maintenance-strategy subtab/button state.
    document.querySelectorAll(
      '[data-view="preventive"],[data-tab="preventive"],[data-target="preventive"],' +
      '[onclick*="preventive"]'
    ).forEach(el=>{
      const txt=(el.textContent||'').toLowerCase();
      if(txt.includes('prevent')) el.classList.add('active');
    });

    document.querySelectorAll(
      '[data-view="predictive"],[data-tab="predictive"],[data-target="predictive"],' +
      '[data-view="corrective"],[data-tab="corrective"],[data-target="corrective"],' +
      '[data-view="riskbased"],[data-tab="riskbased"],[data-target="riskbased"],' +
      '[data-view="adaptive"],[data-tab="adaptive"],[data-target="adaptive"]'
    ).forEach(el=>el.classList.remove('active'));

    try{
      if(typeof window.renderPreventive==='function') window.renderPreventive();
      if(typeof window.initPreventiveCharts==='function') setTimeout(()=>window.initPreventiveCharts(),20);
    }catch(_){}
  }

  // One-time per page/session: only force Preventive on the first fresh entry
  // into Maintenance Strategy. After that, normal user-selected subtabs persist.
  let firstMaintenanceEntry=true;

  document.addEventListener('click',e=>{
    const nav=e.target.closest('[data-view="maintenance"],[data-target="maintenance"],[onclick*="maintenance"]');
    if(!nav)return;

    const label=(nav.textContent||'').trim().toLowerCase();
    if(!label.includes('maintenance strategy') && !label.includes('maintenance')) return;

    if(firstMaintenanceEntry){
      firstMaintenanceEntry=false;
      setTimeout(activatePreventiveFresh,35);
      setTimeout(activatePreventiveFresh,160);
    }
  },true);

  // If the app's initial route itself lands in Maintenance Strategy on login,
  // correct the initial subtab once after startup.
  window.addEventListener('load',()=>{
    setTimeout(()=>{
      const prev=document.getElementById('view-preventive');
      const pred=document.getElementById('view-predictive');
      const corr=document.getElementById('view-corrective');
      const risk=document.getElementById('view-riskbased');
      const adap=document.getElementById('view-adaptive');
      const anyStrategyActive=[prev,pred,corr,risk,adap].some(x=>x&&x.classList.contains('active'));
      const maintenanceVisible=
        document.querySelector('[data-view="maintenance"].active,[data-target="maintenance"].active') ||
        (prev&&getComputedStyle(prev).display!=='none') ||
        (pred&&getComputedStyle(pred).display!=='none');

      if(anyStrategyActive && maintenanceVisible){
        activatePreventiveFresh();
        firstMaintenanceEntry=false;
      }
    },220);
  });
})();
