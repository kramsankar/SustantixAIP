
(function(){
  function purgeLegacyLowerRanking(){
    var h=document.getElementById('view-portfoliobenchmarking'); if(!h)return;
    h.querySelectorAll(':scope > [data-portfolio-performance-ranking="true"], :scope > .portfolio-performance-ranking-section').forEach(function(x){x.remove();});
  }
  window.AIPPurgeLegacyLowerRanking=purgeLegacyLowerRanking;
  ['aip:runtime-ready','aip:data-source-changed','apm:datasource-refreshed'].forEach(function(ev){document.addEventListener(ev,function(){setTimeout(purgeLegacyLowerRanking,0);});});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',purgeLegacyLowerRanking);else purgeLegacyLowerRanking();
})();
