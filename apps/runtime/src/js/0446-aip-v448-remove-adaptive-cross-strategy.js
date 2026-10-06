
(function(){
  'use strict';
  const VIEWS=['preventive','conditionbased','predictive','corrective','riskbased'];

  function removeAdaptive(root){
    if(!root) return;
    const cards=[...root.querySelectorAll('.ms686-card')];
    cards.forEach(card=>{
      const text=(card.textContent||'').replace(/\s+/g,' ').trim();
      const scores=[...card.querySelectorAll('.ms686-score')];
      if(scores.length<4) return;

      // Cross-Strategy Suitability is the score-card containing strategy names.
      const names=scores.map(x=>(x.querySelector('span,.ms721-strategy-name')?.textContent||'').trim());
      if(!names.some(x=>/^Preventive$/i.test(x)) ||
         !names.some(x=>/^Predictive$/i.test(x)) ||
         !names.some(x=>/^Corrective$/i.test(x)) ||
         !names.some(x=>/^Risk-Based$/i.test(x))) return;

      scores.forEach(score=>{
        const name=(score.querySelector('span,.ms721-strategy-name')?.textContent||'').trim();
        if(/^Adaptive$/i.test(name)) score.remove();
      });
    });
  }

  function run(){
    VIEWS.forEach(v=>removeAdaptive(document.getElementById('view-'+v)));
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>setTimeout(run,0),{once:true});
  }else setTimeout(run,0);

  document.addEventListener('click',e=>{
    if(e.target.closest?.('.aip-maint-subtab,[data-aip-maint-nav],button')) setTimeout(run,0);
  },true);
  document.addEventListener('aip:data-source-changed',()=>setTimeout(run,0));

  window.AIP_V448_REMOVE_ADAPTIVE_CROSS_STRATEGY=run;
})();
