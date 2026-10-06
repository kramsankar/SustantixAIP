
(function(){
  function planningUI(){return window.PLAN_UI||{}}
  function currentScroll(){
    return window.scrollY||document.documentElement.scrollTop||document.body.scrollTop||0;
  }
  function applyPlanningIntegrationFocus(){
    if(!window.AIP_PLAN_INTEGRATIONS_CONTEXT)return false;
    const root=document.getElementById('view-integrations');
    const card=root?.querySelector('.po-tech-landscape');
    if(!card)return false;
    card.classList.add('po-v132-planning-focus');
    let h3=card.querySelector(':scope > h3');
    if(h3&&!h3.querySelector('.po-v132-clear-context')){
      const b=document.createElement('button');
      b.type='button';
      b.className='po-v132-clear-context';
      b.textContent='× Clear';
      b.title='Clear Planning & Optimization context highlight';
      b.onclick=function(ev){
        ev.preventDefault();ev.stopPropagation();
        window.planClearIntegrationContext?.();
      };
      h3.appendChild(b);
    }
    try{card.scrollIntoView({block:'start',behavior:'auto'});}catch(_){}
    return true;
  }
  window.planClearIntegrationContext=function(){
    window.AIP_PLAN_INTEGRATIONS_CONTEXT=false;
    const card=document.querySelector('#view-integrations .po-tech-landscape');
    card?.classList.remove('po-v132-planning-focus');
    card?.querySelector('.po-v132-clear-context')?.remove();
  };

  const prior=window.planOpenTech;
  window.planOpenTech=function(){
    const U=planningUI();
    window.AIP_PLAN_INTEGRATIONS_CONTEXT=true;
    window.AIP_PLAN_EXTERNAL_RETURN={
      target:'integrations',
      tab:U.tab||'overview',
      selected:U.selected||'',
      scrollY:currentScroll()
    };
    window.AIP_CONTEXT_NAV={
      source:'Planning & Optimization',
      target:'integrations',
      contextToken:'PLAN-INT-'+Date.now()
    };
    try{sessionStorage.setItem('aip.context.nav',JSON.stringify(window.AIP_CONTEXT_NAV));}catch(_){}
    try{window.activate?.('integrations')}
    catch(_){document.querySelector('[data-view="integrations"]')?.click()}
    [20,70,150,300,600].forEach(ms=>setTimeout(applyPlanningIntegrationFocus,ms));
  };
  window.planOpenTech.__v132context=true;
  window.planOpenTech.__previous=prior;

  const integ=document.getElementById('view-integrations');
  if(integ){
    new MutationObserver(function(){
      if(window.AIP_PLAN_INTEGRATIONS_CONTEXT)setTimeout(applyPlanningIntegrationFocus,15);
    }).observe(integ,{childList:true,subtree:false});
  }

  function restorePlanningFromIntegrations(e){
    const ret=window.AIP_PLAN_EXTERNAL_RETURN;
    const active=document.querySelector('.view.active[id]')?.id||'';
    if(!ret||ret.target!=='integrations'||active!=='view-integrations')return false;
    if(e){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    }
    window.planClearIntegrationContext?.();
    try{window.activate?.('resourceplanning')}
    catch(_){document.querySelector('[data-view="resourceplanning"]')?.click()}
    const restore=function(){
      const U=planningUI();
      if(ret.selected)U.selected=ret.selected;
      try{window.planSetTab?.(ret.tab||'overview')}catch(_){}
      setTimeout(()=>window.scrollTo(0,Number(ret.scrollY)||0),25);
    };
    requestAnimationFrame(()=>requestAnimationFrame(restore));
    setTimeout(restore,130);
    window.AIP_PLAN_EXTERNAL_RETURN=null;
    return true;
  }

  window.addEventListener('click',function(e){
    if(e.target?.closest?.('#aipBackBtn'))restorePlanningFromIntegrations(e);
  },true);
  window.addEventListener('keydown',function(e){
    if(e.altKey&&e.key==='ArrowLeft'){
      const ret=window.AIP_PLAN_EXTERNAL_RETURN;
      const active=document.querySelector('.view.active[id]')?.id||'';
      if(ret?.target==='integrations'&&active==='view-integrations'){
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        restorePlanningFromIntegrations();
      }
    }
  },true);

  window.AIP_V132_AUDIT={
    release:'v1.32',baseline:'v1.31',excelBusinessDataChanged:false,
    changes:[
      'Renamed visible Planning readiness dimension Outage to Outage Window while preserving Outage_Status data keys',
      'Removed redundant explanatory note under Planning & Execution Responsibility Matrix',
      'Removed redundant explanatory note under Systems & Interfaces · Planning configuration',
      'Planning-origin Interfaces navigation highlights the planning configuration card and its two tables in Enterprise Integrations',
      'Added × Clear to remove only the Planning-origin integration highlight',
      'Back and Alt+Left from Enterprise Integrations restore the originating Planning & Optimization tab, selection and scroll context'
    ]
  };
})();
