
(function(){
  /* Sidebar re-entry into Reliability Engineering always starts at Operational Reliability.
     Contextual/drill navigation to a specific Reliability Engineering sub-view is untouched. */
  document.addEventListener('click',function(ev){
    const nav=ev.target.closest?.('#sidebar .nav-item[data-view="rootcause"]');
    if(!nav) return;
    setTimeout(function(){
      try{
        const tab=document.querySelector('.view.active .aip-maint-subtabs [data-aip-maint-nav="reliabilityengineering"]') ||
                  document.querySelector('#view-rootcause .aip-maint-subtabs [data-aip-maint-nav="reliabilityengineering"]');
        if(tab){ tab.click(); return; }
        if(typeof window.activate==='function') window.activate('reliabilityengineering');
        else window.AIP_V21?.open?.('reliabilityengineering');
      }catch(err){ console.error('v816 Reliability Engineering default-entry failed',err); }
    },0);
  },false);
  window.AIP_V816_AUDIT={release:'v816',baseline:'v815',changes:[
    'Fresh sidebar entry to Reliability Engineering defaults to Operational Reliability',
    'Operations Hub circular navigation affordances reduced and arrows standardized to green',
    'Operations Hub KPI title area protected from navigation-circle overlap'
  ],excelBusinessDataChanged:false};
})();
