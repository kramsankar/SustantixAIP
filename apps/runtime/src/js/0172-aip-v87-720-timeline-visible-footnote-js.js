
(function(){
  const views=['preventive','predictive','corrective','riskbased','adaptive'];
  function apply(){
    views.forEach(v=>{
      const root=document.getElementById('view-'+v);
      if(!root)return;
      root.querySelectorAll('.ms686-card').forEach(card=>{
        const h=(card.querySelector('.ms686-head h3')?.textContent||'').toLowerCase();
        if(!h.includes('timeline') && !h.includes('policy evolution') && !h.includes('reassessment'))return;
        if(card.querySelector('.ms720-timeline-footnote'))return;
        const note=document.createElement('div');
        note.className='ms720-timeline-footnote';
        note.textContent='Click a date circle to pin and inspect its details.';
        card.appendChild(note);
      });
    });
  }
  let raf=0;function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;apply()})}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',()=>setTimeout(schedule,20),true);
  schedule();setTimeout(schedule,150);
})();
