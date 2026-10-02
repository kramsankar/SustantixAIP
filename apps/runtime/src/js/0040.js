
/* AIP v1(31): telemetry source/site/timestamp parity guard */
(function(){
  window.addEventListener('storage',function(e){
    if(e.key==='aip_telemetry_plant' && document.getElementById('view-predictive')?.classList.contains('active')){
      try{ window.renderTelemetryChart?.(e.newValue); }catch(_){}
    }
  });
})();
