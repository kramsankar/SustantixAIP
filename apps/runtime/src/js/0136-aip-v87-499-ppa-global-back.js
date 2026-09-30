
(function(){
  'use strict';
  function frameworkIsOpen(){
    if(window.__cppaPpaFrameworkOpen===true)return true;
    const host=document.getElementById('view-commercialppa');
    if(!host)return false;
    return !!host.querySelector('.cppa-framework,[data-ppa-back]') ||
      /PPA Status Framework/i.test(host.querySelector('h1,h2,h3')?.textContent||'');
  }
  function closeToCommercialPPA(){
    window.AIP_REVENUE_COMMERCIAL_TAB='commercialppa';
    try{window.__cppaClosePpaFramework?.();}catch(_){window.__cppaPpaFrameworkOpen=false;}
    try{window.__renderCommercialPPA_v8768?.();}catch(_){}
    if(typeof window.openRevenueCommercialTab==='function'){
      window.openRevenueCommercialTab('commercialppa');
      requestAnimationFrame(()=>window.openRevenueCommercialTab?.('commercialppa'));
    }else{
      document.querySelector('.nav-item[data-view="revenuecommercial"]')?.click();
      setTimeout(()=>document.querySelector('#view-revenuecommercial [data-aip497-tab="commercialppa"]')?.click(),0);
    }
    return true;
  }
  document.addEventListener('click',function(e){
    if(!frameworkIsOpen())return;
    const b=e.target.closest('#backBtn,#navBack,#appBack,.back-btn,.nav-back,.top-back,.app-back,[data-back],[data-nav-back],button[title*="Back" i],button[aria-label*="Back" i]');
    if(!b)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    closeToCommercialPPA();
  },true);
  window.AIP_CLOSE_PPA_FRAMEWORK_TO_COMMERCIAL=closeToCommercialPPA;
})();
