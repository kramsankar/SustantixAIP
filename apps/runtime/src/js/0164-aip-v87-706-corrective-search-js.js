
(function(){
  window.filterCorrectiveWorkOrders=function(q){
    const table=document.getElementById('correctiveWorkOrdersTable');
    if(!table)return;
    const term=String(q||'').trim().toLocaleLowerCase();
    const rows=table.querySelectorAll('tbody tr');
    rows.forEach(tr=>{
      const cells=[...tr.querySelectorAll('td')];
      const hay=cells.map(td=>(td.textContent||'').trim()).join(' ').toLocaleLowerCase();
      tr.style.display=(!term || hay.includes(term)) ? '' : 'none';
    });
  };

  // Event delegation keeps search functional even after the Corrective view re-renders.
  document.addEventListener('input',function(e){
    if(e.target && e.target.id==='corr704WorkOrderSearch'){
      window.filterCorrectiveWorkOrders(e.target.value);
    }
  },true);
})();
