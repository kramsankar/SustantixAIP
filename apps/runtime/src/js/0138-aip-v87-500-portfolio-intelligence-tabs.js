
(function(){
 'use strict';
 document.addEventListener('click',function(e){
   const b=e.target.closest('#view-portfoliointelligence [data-aip500-tab]');
   if(!b)return;
   e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
   window.openPortfolioIntelligenceTab?.(b.dataset.aip500Tab);
 },true);
})();
