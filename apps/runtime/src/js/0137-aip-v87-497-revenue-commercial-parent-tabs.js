
(function(){
 'use strict';
 document.addEventListener('click',function(e){
   const b=e.target.closest('#view-revenuecommercial [data-aip497-tab]');
   if(!b)return;
   e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
   window.openRevenueCommercialTab?.(b.dataset.aip497Tab);
 },true);
})();
