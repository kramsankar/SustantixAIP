
(function(){
 'use strict';
 document.addEventListener('click',function(e){
   const row=e.target.closest('#view-commercialppa .cppa494-pathway');
   if(!row || e.target.closest('[data-cause]')) return;
   const cause=row.querySelector('[data-cause]');
   if(cause) cause.click();
 },true);
})();
