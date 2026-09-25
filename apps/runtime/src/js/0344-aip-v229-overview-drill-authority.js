
(function(){
 'use strict';
 function selectSustainabilityEnergy(){
   const apply=()=>{
     const root=document.getElementById('view-sustainabilityintelligence');
     const tab=root?.querySelector('[data-sus8-tab="energy"]');
     if(tab&&!tab.classList.contains('active'))tab.click();
   };
   requestAnimationFrame(apply);[50,140,320].forEach(ms=>setTimeout(apply,ms));
 }
 function open(card){
   if(!card)return;
   const label=String(card.querySelector('.aip-kpi-display-label')?.textContent||'').trim();
   if(/^Revenue at Risk$/i.test(label)){
     window.AIP_REVENUE_COMMERCIAL_TAB='commercialppa';
     window.AIP_PORTFOLIO_INTELLIGENCE_TAB='overview';
     window.AIP_HISTORY_NAV?.recordPath?.('portfoliointelligence','revenuecommercial');
     window.activate?.('commercialppa');
     return;
   }
   if(/CO[₂2] Avoided/i.test(label)){
     window.AIP_PORTFOLIO_INTELLIGENCE_TAB='overview';
     window.AIP_HISTORY_NAV?.recordPath?.('portfoliointelligence','sustainabilityintelligence');
     window.activate?.('sustainabilityintelligence');
     selectSustainabilityEnergy();
   }
 }
 document.addEventListener('click',function(e){const c=e.target.closest?.('#view-overview .ov527-all-kpis>.ov507-drill');if(!c)return;e.preventDefault();e.stopImmediatePropagation();open(c);},true);
 document.addEventListener('keydown',function(e){if(e.key!=='Enter'&&e.key!==' ')return;const c=e.target.closest?.('#view-overview .ov527-all-kpis>.ov507-drill');if(!c)return;e.preventDefault();e.stopImmediatePropagation();open(c);},true);
})();
