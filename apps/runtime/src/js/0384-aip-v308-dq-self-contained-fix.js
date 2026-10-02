
(function(){
  window.AIP_V308_AUDIT={
    release:'v308',baseline:'v307',
    scope:'Technology Foundations · Data Quality & Observability only',
    cause:'Governed Data Quality renderer depended on private head() helper outside its scope',
    fix:'Renderer now builds its own standard xi-head markup and has no head() dependency',
    excelChanged:false,syntheticChanged:false,startupChanged:false
  };
})();
