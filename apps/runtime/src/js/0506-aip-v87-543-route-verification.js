
(function(){
  window.AIP_ER_ROUTE_TARGETS={
    rootcause:{view:'rootcause',label:'Event & Root Cause'},
    reliabilityengineering:{view:'reliabilityengineering',label:'Operational Reliability'},
    rcm:{view:'rcm',label:'RCM Framework'},
    decisionintelligence:{view:'decisionintelligence',label:'Decision Intelligence'}
  };
  function verify(){
    const targets=window.AIP_ER_ROUTE_TARGETS||{};
    Object.values(targets).forEach(t=>{
      const view=document.getElementById('view-'+t.view);
      if(!view) console.error('Event Reconstruction route target missing:',t);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',verify,{once:true});else verify();
})();
