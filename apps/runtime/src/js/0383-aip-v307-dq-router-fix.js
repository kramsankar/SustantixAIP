
(function(){
  window.AIP_V307_AUDIT={
    release:'v307',baseline:'v306',
    scope:'Technology Foundations · Data Quality & Observability router correction only',
    cause:'Technology router captured original renderDQ function before governed v306 renderer was installed',
    fix:'Router now resolves window.renderDQ at render time',
    excelChanged:false,syntheticChanged:false,startupChanged:false
  };
})();
