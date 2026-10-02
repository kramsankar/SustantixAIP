
(function(){
  const views=['preventive','predictive','corrective','riskbased','adaptive'];
  function apply(){
    views.forEach(v=>{
      const root=document.getElementById('view-'+v);
      if(!root)return;
      root.querySelectorAll('label,div,span,small').forEach(el=>{
        if(el.children.length)return;
        const t=(el.textContent||'').trim();
        if(/asset\s*\/?\s*object\s*\/?\s*component\s*evidence\s*scope/i.test(t) ||
           /asset.*component.*evidence\s*scope/i.test(t)){
          el.classList.add('ms719-nowrap-scope');
        }
      });
    });
  }
  let raf=0;function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;apply()})}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',()=>setTimeout(schedule,20),true);
  schedule();setTimeout(schedule,150);
})();
