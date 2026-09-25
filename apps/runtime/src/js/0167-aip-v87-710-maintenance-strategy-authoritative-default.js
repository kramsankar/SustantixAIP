
(function(){
  function forcePreventive(){
    try{
      // Canonical strategy state used by the maintenance-strategy renderer.
      if(window.ms686State && typeof window.ms686State==='object'){
        window.ms686State.view='preventive';
      }
      if(window.MS686_STATE && typeof window.MS686_STATE==='object'){
        window.MS686_STATE.view='preventive';
      }
      if(window.maintenanceStrategyState && typeof window.maintenanceStrategyState==='object'){
        window.maintenanceStrategyState.view='preventive';
      }

      // Use the application's own strategy tab handler where available.
      if(typeof window.ms686Tab==='function'){
        window.ms686Tab('preventive');
        return;
      }
      if(typeof window.setMaintenanceStrategyTab==='function'){
        window.setMaintenanceStrategyTab('preventive');
        return;
      }

      // Deterministic DOM fallback.
      ['preventive','predictive','corrective','riskbased','adaptive'].forEach(v=>{
        const pane=document.getElementById('view-'+v);
        if(pane) pane.classList.toggle('active',v==='preventive');
      });
      const root=document.getElementById('view-maintenance')||document;
      root.querySelectorAll('[data-view],[data-tab],[data-target]').forEach(el=>{
        const key=String(el.dataset.view||el.dataset.tab||el.dataset.target||'').toLowerCase();
        if(['preventive','predictive','corrective','riskbased','adaptive'].includes(key)){
          el.classList.toggle('active',key==='preventive');
        }
      });
      if(typeof window.renderPreventive==='function') window.renderPreventive();
    }catch(_){}
  }

  function isMaintenanceStrategyView(v){
    const s=String(v||'').toLowerCase().replace(/[\s_-]+/g,'');
    return s==='maintenance'||s==='maintenancestrategy'||s==='strategy';
  }

  // Wrap canonical setView after startup. Every explicit opening of Maintenance Strategy
  // now lands on Preventive first. Subtab clicks inside Maintenance Strategy are untouched.
  function install(){
    const fn=window.setView;
    if(typeof fn!=='function' || fn.__v8710Wrapped)return false;
    function wrapped(v){
      const r=fn.apply(this,arguments);
      if(isMaintenanceStrategyView(v)){
        // Run after the native renderer so any remembered Predictive state cannot overwrite it.
        requestAnimationFrame(()=>forcePreventive());
        setTimeout(forcePreventive,25);
      }
      return r;
    }
    wrapped.__v8710Wrapped=true;
    wrapped.__v8710Original=fn;
    window.setView=wrapped;
    return true;
  }

  if(!install()){
    let tries=0;
    const t=setInterval(()=>{tries++;if(install()||tries>80)clearInterval(t)},25);
  }

  // Direct left-nav fallback for implementations that do not route through setView.
  document.addEventListener('click',function(e){
    const el=e.target.closest('button,a,[role="button"],.nav-item,.menu-item');
    if(!el)return;
    const txt=(el.textContent||'').trim().toLowerCase();
    if(txt==='maintenance strategy'){
      setTimeout(forcePreventive,0);
      setTimeout(forcePreventive,40);
    }
  },false);
})();
