
(function(){
  const views=['preventive','predictive','corrective','riskbased','adaptive'];

  function refineTimelineHint(){
    document.querySelectorAll('.ms714-popover .ms714-pin-hint').forEach(el=>{
      el.textContent='Click a circle or date to pin and inspect details';
    });
  }

  function refineSuitability(root){
    root.querySelectorAll('*').forEach(el=>{
      if(el.children.length)return;
      const t=(el.textContent||'').trim();
      if(/^(low|moderate|high|strong)\s+fit$/i.test(t)){
        el.classList.add('ms718-fit-label');
      }
    });

    // Suitability scores are typically the numeric values adjacent to strategy names/cards.
    root.querySelectorAll('*').forEach(el=>{
      if(el.children.length)return;
      const t=(el.textContent||'').trim();
      if(!/^\d{1,3}(?:\.\d+)?(?:\s*\/\s*100)?$/.test(t))return;
      const card=el.closest('[class*="suit"],[class*="strategy"],[class*="fit"],[class*="score"],.ms686-card');
      if(!card)return;
      const cardText=(card.textContent||'');
      if(/Preventive|Predictive|Corrective|Risk-Based|Adaptive/i.test(cardText) &&
         /Low Fit|Moderate Fit|High Fit|Strong Fit/i.test(cardText)){
        el.classList.add('ms718-fit-value');
      }
    });
  }

  function clean(){
    refineTimelineHint();
    views.forEach(v=>{
      const root=document.getElementById('view-'+v);
      if(root)refineSuitability(root);
    });
  }

  let raf=0;
  function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;clean()})}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('mouseover',()=>setTimeout(schedule,0),true);
  document.addEventListener('click',()=>setTimeout(schedule,20),true);
  schedule();setTimeout(schedule,180);
})();
