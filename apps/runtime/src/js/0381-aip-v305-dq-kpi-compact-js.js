
(function(){
  function decorateDQKpis(){
    const root=document.getElementById('view-dataquality');
    if(!root) return;
    root.querySelectorAll('.xi-kpi').forEach(card=>{
      if(card.dataset.aip305Done==='1') return;
      card.dataset.aip305Done='1';

      /* kpi() renders label/value/supporting text using spans and b.
         Give the supporting text its own compact class without changing content. */
      const spans=card.querySelectorAll(':scope > span');
      if(spans.length>1) spans[spans.length-1].classList.add('aip305-dq-note');

      const bars=document.createElement('div');
      bars.className='aip305-mini-bars';
      bars.setAttribute('aria-hidden','true');
      bars.innerHTML='<i></i><i></i><i></i><i></i><i></i>';
      card.appendChild(bars);
    });
  }

  const root=document.getElementById('view-dataquality');
  if(root){
    new MutationObserver(()=>queueMicrotask(decorateDQKpis)).observe(root,{childList:true,subtree:true});
  }
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-view="dataquality"]')) setTimeout(decorateDQKpis,0);
  },true);
  setTimeout(decorateDQKpis,0);

  window.AIP_V305_AUDIT={
    release:'v305',baseline:'v304',
    scope:'Technology Foundations · Data Quality & Observability KPI cards only',
    startupChanged:false,excelChanged:false,dataLogicChanged:false,
    changes:['Compact KPI cards','Reduced label/value/supporting-text typography',
             'Left-aligned KPI contents','Added five-bar colored mini indicator with bottom clearance']
  };
})();
