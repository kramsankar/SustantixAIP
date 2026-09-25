
(function(){
  'use strict';
  function labelOf(card){
    return String(
      card.querySelector(':scope > .aip-kpi-display-label')?.textContent ||
      card.querySelector('.kpi-label')?.textContent || ''
    ).replace(/\s+/g,' ').trim();
  }
  function install(){
    const view=document.getElementById('view-overview');
    if(!view)return;
    const cards=[...view.querySelectorAll('.aip-overview-kpis > .card, .aip-overview-kpis > .aip-kpi-master')];

    cards.forEach(card=>{
      const label=labelOf(card);
      const isRevenue=/^Revenue at Risk$/i.test(label);
      const isCO2=/^CO₂ Avoided \(annualized\)$/i.test(label)||/^CO2 Avoided \(annualized\)$/i.test(label);
      const isOpenWO=/^Open Work Orders$/i.test(label);

      if(isOpenWO){
        card.classList.remove('aip-overview-drill-kpi');
        card.removeAttribute('role');
        card.removeAttribute('tabindex');
        card.removeAttribute('title');
        card.querySelectorAll(':scope > .aip-kpi-drill-icon').forEach(x=>x.remove());
        return;
      }
      if(!(isRevenue||isCO2))return;

      card.classList.add('aip-overview-drill-kpi');
      card.setAttribute('role','button');
      card.setAttribute('tabindex','0');
      card.setAttribute('title','View details');
      card.dataset.aipDrillTarget=isRevenue?'lossintelligence':'carbonwater';

      let icon=card.querySelector(':scope > .aip-kpi-drill-icon');
      if(!icon){
        icon=document.createElement('span');
        icon.className='aip-kpi-drill-icon';
        icon.setAttribute('aria-hidden','true');
        icon.textContent='↗';
        card.appendChild(icon);
      }
    });
  }

  function open(card){
    const target=card?.dataset?.aipDrillTarget;
    if(!target)return;
    window.AIP_HISTORY_NAV?.record?.('overview');
    window.AIP_HISTORY_NAV?.record?.(target);
    window.activate?.(target);
  }

  document.addEventListener('click',function(e){
    const card=e.target.closest?.('#view-overview .aip-overview-drill-kpi');
    if(!card)return;
    e.preventDefault();
    open(card);
  },true);

  document.addEventListener('keydown',function(e){
    if(e.key!=='Enter'&&e.key!==' ')return;
    const card=e.target.closest?.('#view-overview .aip-overview-drill-kpi');
    if(!card)return;
    e.preventDefault();
    open(card);
  },true);

  function refresh(){
    install();
    requestAnimationFrame(install);
    setTimeout(install,40);
    setTimeout(install,140);
  }
  document.addEventListener('click',function(e){
    if(e.target.closest?.('[data-view="overview"],.nav-item,.subnav-item'))setTimeout(refresh,0);
  },true);
  window.addEventListener('aip:data-rendered',refresh);
  window.addEventListener('aip:data-source-changed',refresh);

  const view=document.getElementById('view-overview');
  if(view){
    new MutationObserver(()=>requestAnimationFrame(install)).observe(view,{childList:true,subtree:true});
  }
  refresh();
})();
