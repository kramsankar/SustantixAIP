
(function(){
  const groups={
    strategy:{title:'Maintenance Strategy',views:['preventive','conditionbased','predictive','corrective','riskbased'],tabs:[['preventive','Preventive Maintenance'],['conditionbased','Condition-Based Maintenance'],['predictive','Predictive Maintenance'],['corrective','Corrective Maintenance'],['riskbased','Risk-Based Maintenance']]},
    reliability:{title:'Reliability Engineering',views:['rootcause','eventreconstruction','aivision','rcm','reliabilityengineering'],tabs:[['rootcause','Event & Root Cause'],['eventreconstruction','Event Reconstruction & Forensics'],['aivision','AI Vision & Inspection'],['rcm','RCM Framework'],['reliabilityengineering','Operational Reliability']]},
    learning:{title:'Maintenance Learning & Recovery',views:['maintenancelearning'],tabs:[['maintenancelearning','Maintenance Learning & Recovery']]}
  };
  window.AIP_MAINTENANCE_NAV_ALIAS={preventive:'predictive',conditionbased:'predictive',predictive:'predictive',corrective:'predictive',riskbased:'predictive',adaptive:'predictive',rootcause:'rootcause',eventreconstruction:'rootcause',aivision:'rootcause',rcm:'rootcause',reliabilityengineering:'rootcause',maintenancelearning:'maintenancelearning',warrantyrecovery:'maintenancelearning'};
  function esc(s){return String(s).replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]));}
  function findGroup(view){return Object.values(groups).find(g=>g.views.includes(view));}
  function normalizeHeading(root,g){
    const h1=root.querySelector('.view-head h1,.xi-head h1');
    if(h1 && h1.textContent.trim()!==g.title) h1.textContent=g.title;
  }
  function openTab(view){
    const target=document.getElementById('view-'+view);
    if(!target) return;
    // Event Reconstruction has a custom authoritative renderer. Build that view
    // while it is still hidden, then activate the already-complete DOM. This avoids
    // exposing the legacy/empty intermediate frame that made the entire Reliability
    // Engineering pane jump and briefly change heading geometry.
    if(view==='eventreconstruction' && window.AIP_V21 && window.AIP_V21.renderers && typeof window.AIP_V21.renderers.eventreconstruction==='function'){
      try{
        window.AIP_V21.renderers.eventreconstruction();
        if(typeof viewRendered!=='undefined') viewRendered[view]=true;
      }catch(e){ console.error('Event Reconstruction render failed',e); }
    }
    if(view==='reliabilityengineering' && typeof window.renderReliabilityEngineering==='function'){
      try{
        window.renderReliabilityEngineering();
        if(typeof viewRendered!=='undefined') viewRendered[view]=true;
      }catch(e){ console.error('Operational Reliability render failed',e); }
    }
    if(typeof window.activate==='function') window.activate(view);
    requestAnimationFrame(()=>window.applyMaintenanceGroupingSubtabs(view));
  }
  window.applyMaintenanceGroupingSubtabs=function(view){
    const g=findGroup(view); if(!g) return;
    const root=document.getElementById('view-'+view); if(!root) return;
    const head=root.querySelector('.view-head,.xi-head'); if(!head) return;
    normalizeHeading(root,g);
    root.querySelectorAll(':scope > .aip-maint-subtabs').forEach(x=>x.remove());
    const bar=document.createElement('div');
    bar.className='aip-maint-subtabs';
    g.tabs.forEach(t=>{
      const b=document.createElement('button');
      b.type='button';
      b.className='aip-maint-subtab'+(t[0]===view?' active':'');
      b.dataset.aipMaintNav=t[0];
      b.textContent=t[1];
      b.setAttribute('aria-current',t[0]===view?'page':'false');
      b.addEventListener('click',function(ev){ev.preventDefault();ev.stopImmediatePropagation();openTab(t[0]);});
      bar.appendChild(b);
    });
    if(view==='eventreconstruction'){
      const reg=document.createElement('button');
      reg.type='button';
      reg.className='aip-maint-subtab er-incident-register-tams aip-incident-register-green';
      reg.textContent='Incident Register';
      /* v649: force the action's default visual state at element creation; do not depend on cascade/hover timing. */
      reg.style.setProperty('background','#17866B','important');
      reg.style.setProperty('background-color','#17866B','important');
      reg.style.setProperty('color','#fff','important');
      reg.style.setProperty('border-color','#17866B','important');
      reg.addEventListener('click',function(ev){ev.preventDefault();ev.stopImmediatePropagation();if(typeof window.erOpenRegister==='function')window.erOpenRegister();});
      bar.appendChild(reg);
    }
    head.insertAdjacentElement('afterend',bar);
  };
  const obs=new MutationObserver(()=>{
    const active=document.querySelector('.view.active[id^="view-"]');
    if(!active) return;
    const view=active.id.replace('view-','');
    const g=findGroup(view);
    if(g){
      normalizeHeading(active,g);
      if(!active.querySelector(':scope > .aip-maint-subtabs')) window.applyMaintenanceGroupingSubtabs(view);
    }
  });
  function boot(){
    obs.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    const active=document.querySelector('.view.active[id^="view-"]');
    if(active) window.applyMaintenanceGroupingSubtabs(active.id.replace('view-',''));
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
