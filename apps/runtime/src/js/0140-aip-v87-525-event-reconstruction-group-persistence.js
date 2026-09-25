
(function(){
  function redecorateEventReconstruction(){
    try{
      if(typeof window.applyMaintenanceGroupingSubtabs==='function'){
        window.applyMaintenanceGroupingSubtabs('eventreconstruction');
      }
    }catch(e){console.error('Event Reconstruction group decoration failed',e);}
  }
  if(window.AIP_V21 && window.AIP_V21.renderers && typeof window.AIP_V21.renderers.eventreconstruction==='function'){
    const original=window.AIP_V21.renderers.eventreconstruction;
    if(!original.__aip525Wrapped){
      const wrapped=function(){
        const result=original.apply(this,arguments);
        requestAnimationFrame(()=>requestAnimationFrame(redecorateEventReconstruction));
        return result;
      };
      wrapped.__aip525Wrapped=true;
      window.AIP_V21.renderers.eventreconstruction=wrapped;
    }
  }
})();
