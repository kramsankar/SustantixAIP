
(function(){
 function filterTable(input,tableId){
   const q=String(input.value||'').trim().toLowerCase();
   document.querySelectorAll('#'+tableId+' tbody tr').forEach(tr=>{
     tr.style.display=!q||String(tr.textContent||'').toLowerCase().includes(q)?'':'none';
   });
 }
 document.addEventListener('click',function(e){
   const b=e.target.closest?.('.sus8-resource-tab');
   if(!b)return;
   const host=b.closest('.sus8-resource-workspace');
   if(!host)return;
   const key=b.dataset.susResourceTab;
   host.querySelectorAll('.sus8-resource-tab').forEach(x=>x.classList.toggle('active',x===b));
   host.querySelectorAll('.sus8-resource-panel').forEach(x=>x.classList.toggle('active',x.dataset.susResourcePanel===key));
 },true);
 document.addEventListener('input',function(e){
   if(e.target?.id==='sus8WaterSearch')filterTable(e.target,'sus8WaterTable');
   else if(e.target?.id==='sus8CarbonSearch')filterTable(e.target,'sus8CarbonTable');
 },true);
})();
