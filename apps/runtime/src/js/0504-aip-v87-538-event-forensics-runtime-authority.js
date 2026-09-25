
(function(){
  function forceForensics(){
    try{
      const root=document.getElementById('view-eventreconstruction');
      if(!root || !root.classList.contains('active')) return;
      if(typeof window.renderEventReconstructionForensicsV537==='function'){
        window.renderEventReconstructionForensicsV537();
        setTimeout(()=>{ try{ window.applyMaintenanceGroupingSubtabs?.('eventreconstruction'); }catch(_){} },0);
      }
    }catch(e){ console.error('v87_592 Event Reconstruction force-render failed',e); }
  }

  function install(){
    try{
      if(window.AIP_V21){
        window.AIP_V21.renderers=window.AIP_V21.renderers||{};
        window.AIP_V21.renderers.eventreconstruction=window.renderEventReconstructionForensicsV537;

        if(typeof window.AIP_V21.open==='function' && !window.AIP_V21.open.__aip538Wrapped){
          const oldOpen=window.AIP_V21.open;
          const wrapped=function(view){
            const out=oldOpen.apply(this,arguments);
            if(view==='eventreconstruction'){
              setTimeout(forceForensics,0);
              setTimeout(forceForensics,40);
              setTimeout(forceForensics,120);
            }
            return out;
          };
          wrapped.__aip538Wrapped=true;
          window.AIP_V21.open=wrapped;
        }
      }
    }catch(e){ console.error('v87_592 renderer install failed',e); }
  }

  document.addEventListener('click',function(ev){
    const b=ev.target.closest?.('[data-aip-maint-nav="eventreconstruction"],#sidebar [data-view="eventreconstruction"]');
    if(!b) return;
    setTimeout(forceForensics,0);
    setTimeout(forceForensics,50);
    setTimeout(forceForensics,140);
  },true);

  const obs=new MutationObserver(function(muts){
    for(const m of muts){
      const el=m.target;
      if(el && el.id==='view-eventreconstruction' && el.classList.contains('active')){
        setTimeout(forceForensics,0);
        setTimeout(forceForensics,60);
        break;
      }
    }
  });

  function boot(){
    install();
    const root=document.getElementById('view-eventreconstruction');
    if(root) obs.observe(root,{attributes:true,attributeFilter:['class']});
    forceForensics();
    let tries=0;
    const t=setInterval(function(){
      install();
      if(++tries>20) clearInterval(t);
    },100);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
