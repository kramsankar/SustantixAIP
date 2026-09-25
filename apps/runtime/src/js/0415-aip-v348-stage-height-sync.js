
(function(){
  function syncStageHeights(){
    const root=document.getElementById('view-models');
    if(!root)return;
    const chain=root.querySelector('.aip328-chain');
    const stages=[...root.querySelectorAll('.aip328-stage')];
    if(!chain||!stages.length)return;
    stages.forEach(s=>s.style.removeProperty('min-height'));
    requestAnimationFrame(()=>{
      const h=Math.max(...stages.map(s=>s.scrollHeight), chain.scrollHeight);
      stages.forEach(s=>s.style.setProperty('min-height',h+'px','important'));
    });
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(syncStageHeights,800));
  window.addEventListener('resize',()=>setTimeout(syncStageHeights,80));
  const prev=window.renderModels;
  if(typeof prev==='function'){
    window.renderModels=function(){
      const r=prev.apply(this,arguments);
      setTimeout(syncStageHeights,0);
      return r;
    };
  }
})();
