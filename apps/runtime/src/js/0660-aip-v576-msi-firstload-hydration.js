
(function(){
  'use strict';
  let repairing=false, timer=0, attempts=0;

  function isActiveOverview(){
    const root=document.getElementById('view-spares');
    if(!root || !root.classList.contains('active')) return false;
    const activeTab=root.querySelector('.msi-tabs button.active');
    return !activeTab || /overview/i.test(activeTab.textContent||'');
  }

  function overviewNeedsHydration(){
    const root=document.getElementById('view-spares');
    if(!root) return false;
    const cards=[...root.querySelectorAll('.msi-kpis > .msi-kpi')];
    if(cards.length!==5) return true;
    const values=cards.map(c=>(c.querySelector('.aip-kpi-number')?.textContent||'').trim());
    return values.some(v=>v==='');
  }

  function repair(){
    clearTimeout(timer);
    timer=setTimeout(()=>{
      if(repairing || !isActiveOverview() || !overviewNeedsHydration()) return;
      if(typeof window.msiSetTab!=='function') return;
      repairing=true;
      try{
        window.msiSetTab('overview');
        attempts++;
      } finally {
        requestAnimationFrame(()=>{ repairing=false; });
      }
    },35);
  }

  function settle(){
    if(!isActiveOverview()) return;
    repair();
    setTimeout(repair,120);
    setTimeout(repair,350);
    setTimeout(repair,800);
  }

  const root=document.getElementById('view-spares');
  if(root){
    new MutationObserver(()=>{
      if(!repairing) repair();
    }).observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
  }

  document.addEventListener('click',()=>setTimeout(settle,30),true);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(settle,60));
  window.addEventListener('load',()=>setTimeout(settle,100));
  document.addEventListener('aip:data-source-changed',()=>setTimeout(settle,60));
  setTimeout(settle,0);

  window.AIP_V576_MSI_FIRSTLOAD_AUDIT={
    release:'v576',
    baseline:'v575',
    fixes:[
      'Rehydrates the five MSI Overview KPI cards if a later boot-time decorator leaves the first render blank',
      'Keeps the five ERP/AIP/Governance boundary cards and four arrows in one nine-column row'
    ],
    dataChanged:false,
    calculationChanged:false
  };
  window.AIP_CURRENT_BUILD='v576';
})();
