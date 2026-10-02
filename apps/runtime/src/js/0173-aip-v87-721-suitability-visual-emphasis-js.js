
(function(){
  const views=['preventive','predictive','corrective','riskbased','adaptive'];
  const strategies=/^(Preventive|Predictive|Corrective|Risk-Based|Adaptive)$/i;
  const fits=/^(Low|Moderate|High|Strong)\s+Fit$/i;

  function apply(){
    document.querySelectorAll('.ms720-timeline-footnote').forEach(el=>{
      el.textContent='Click a date circle to pin and inspect its details.';
    });

    views.forEach(v=>{
      const root=document.getElementById('view-'+v);
      if(!root)return;
      root.querySelectorAll('.ms686-card').forEach(card=>{
        const heading=(card.querySelector('.ms686-head h3')?.textContent||'').toLowerCase();
        if(!heading.includes('cross-strategy suitability'))return;

        card.querySelectorAll('*').forEach(el=>{
          if(el.children.length)return;
          const t=(el.textContent||'').trim();
          if(strategies.test(t)) el.classList.add('ms721-strategy-name');
          if(fits.test(t)) el.classList.add('ms721-fit-label');
        });
      });
    });
  }

  let raf=0; function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;apply()})}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',()=>setTimeout(schedule,20),true);
  schedule(); setTimeout(schedule,160);
})();
