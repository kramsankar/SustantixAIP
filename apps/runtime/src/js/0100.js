
(function(){
  function removeObsoletePortfolioLowerTables(){
    var host = document.getElementById('view-portfoliobenchmarking');
    if(!host) return;

    host.querySelectorAll('[data-portfolio-performance-ranking="true"], .portfolio-performance-ranking-section').forEach(function(el){
      el.remove();
    });

    host.querySelectorAll('.site-performance-league-card').forEach(function(card){
      if(!card.closest('.v51-pp-panel')) card.remove();
    });

    host.querySelectorAll(':scope > .card, :scope > section > .card').forEach(function(card){
      if(card.closest('.v51-pp-panel')) return;
      var h = card.querySelector('h3');
      var title = h ? (h.textContent || '').trim().toLowerCase() : '';
      if(title === 'site performance ranking' || title === 'portfolio league table') card.remove();
    });
  }

  window.AIPRemoveObsoletePortfolioLowerTables = removeObsoletePortfolioLowerTables;

  document.addEventListener('aip:runtime-ready', function(){
    setTimeout(removeObsoletePortfolioLowerTables, 0);
    setTimeout(removeObsoletePortfolioLowerTables, 120);
  });
  document.addEventListener('aip:data-source-changed', function(){
    setTimeout(removeObsoletePortfolioLowerTables, 0);
    setTimeout(removeObsoletePortfolioLowerTables, 120);
  });
  document.addEventListener('apm:datasource-refreshed', function(){
    setTimeout(removeObsoletePortfolioLowerTables, 60);
  });
  document.addEventListener('click', function(e){
    var b = e.target && e.target.closest ? e.target.closest('.v51-pp-tab') : null;
    if(b) setTimeout(removeObsoletePortfolioLowerTables, 0);
  }, true);

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(removeObsoletePortfolioLowerTables, 0); });
  } else {
    setTimeout(removeObsoletePortfolioLowerTables, 0);
  }
})();
