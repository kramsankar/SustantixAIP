
(function(){
  'use strict';

  function label(card){
    return String(
      card.querySelector(':scope > .aip-kpi-display-label')?.textContent ||
      card.querySelector(':scope > .kpi-label')?.textContent || ''
    ).replace(/\s+/g,' ').trim();
  }

  function harden(){
    const host=document.querySelector('#view-overview .aip-overview-kpis');
    if(!host)return;

    [...host.children].forEach(card=>{
      const l=label(card);
      const open=/^Open Work Orders$/i.test(l);
      const rev=/^Revenue at Risk$/i.test(l);
      const co2=/^CO₂ Avoided \(annualized\)$/i.test(l)||/^CO2 Avoided \(annualized\)$/i.test(l);

      if(open){
        card.classList.add('aip-overview-static-kpi');
        card.classList.remove('aip-overview-drill-kpi');
        card.removeAttribute('onclick');
        card.removeAttribute('onkeydown');
        card.removeAttribute('role');
        card.removeAttribute('tabindex');
        card.removeAttribute('title');
        card.removeAttribute('data-aip-drill-target');
        card.querySelectorAll(':scope > .aip-kpi-drill-icon').forEach(x=>x.remove());
        return;
      }

      if(!(rev||co2))return;

      card.classList.add('aip-overview-drill-kpi');
      card.classList.remove('aip-overview-static-kpi');
      card.dataset.aipDrillTarget=rev?'lossintelligence':'carbonwater';
      card.setAttribute('role','button');
      card.setAttribute('tabindex','0');
      card.setAttribute('title','View details');

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
    const card=e.target.closest?.('#view-overview .aip-overview-kpis > .aip-overview-drill-kpi');
    if(!card)return;
    e.preventDefault();
    e.stopPropagation();
    open(card);
  },false);

  document.addEventListener('keydown',function(e){
    if(e.key!=='Enter'&&e.key!==' ')return;
    const card=e.target.closest?.('#view-overview .aip-overview-kpis > .aip-overview-drill-kpi');
    if(!card)return;
    e.preventDefault();
    open(card);
  },false);

  const host=document.getElementById('view-overview');
  if(host){
    new MutationObserver(()=>requestAnimationFrame(harden)).observe(host,{childList:true,subtree:true});
  }

  function refresh(){
    harden();
    requestAnimationFrame(harden);
    setTimeout(harden,30);
    setTimeout(harden,120);
  }

  document.addEventListener('click',function(e){
    if(e.target.closest?.('[data-view="overview"],.nav-item,.subnav-item'))setTimeout(refresh,0);
  },true);
  window.addEventListener('aip:data-rendered',refresh);
  window.addEventListener('aip:data-source-changed',refresh);
  refresh();
})();
