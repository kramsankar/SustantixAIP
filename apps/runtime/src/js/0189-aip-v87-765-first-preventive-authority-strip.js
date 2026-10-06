
(function(){
  function ensure(){
    const root=document.getElementById('view-preventive');
    if(!root?.classList.contains('active'))return;
    if(!root.querySelector(':scope>.aip675-strategy-chain')){
      window.aip675DecorateStrategy?.('preventive');
    }
  }
  window.addEventListener('aip:runtime-ready',()=>setTimeout(ensure,80));
  document.addEventListener('click',e=>{
    const nav=e.target.closest?.('.nav-item[data-view="predictive"],.nav-item[data-view="preventive"]');
    if(nav)requestAnimationFrame(()=>setTimeout(ensure,20));
  },true);
})();
