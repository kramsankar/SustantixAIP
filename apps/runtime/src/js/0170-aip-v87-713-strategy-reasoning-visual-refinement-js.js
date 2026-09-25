
(function(){
  const names=['Preventive','Predictive','Corrective','Risk-Based','Adaptive'];

  function refine(){
    // The v710 Strategy Reasoning Detail is a dynamically generated modal.
    document.querySelectorAll('.ms686-modal,.ms686-panel').forEach(root=>{
      const txt=(root.textContent||'');
      if(!/Strategy Reasoning Detail/i.test(txt)) return;

      // Remove only the generic portfolio/all-assets averaging paragraph.
      root.querySelectorAll('p,div,small').forEach(el=>{
        if(el.children.length && !['P','SMALL'].includes(el.tagName)) return;
        const t=(el.textContent||'').trim();
        if(/portfolio\s*\/?\s*all assets view/i.test(t) ||
           (/displayed\s+(preventive|predictive|corrective|risk-based|adaptive)\s+score/i.test(t) &&
            /equal average of qualifying asset-level scores/i.test(t))){
          el.remove();
        }
      });

      // Keep the Suitability Basis explanatory sentence intact.
      // Accent the three summary boxes by locating their labels.
      ['Evidence Sufficiency','Strongest Fit','Policy Action'].forEach(label=>{
        root.querySelectorAll('div').forEach(el=>{
          const direct=Array.from(el.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ').trim();
          const full=(el.textContent||'').trim();
          if((direct===label || full.startsWith(label)) && el.parentElement){
            const card=el.closest('[class*="card"],[class*="box"]') || el.parentElement;
            card.classList.add('ms713-accent-summary');
          }
        });
      });

      // Accent the five calculation-basis strategy cards distinctly.
      names.forEach(name=>{
        root.querySelectorAll('div').forEach(el=>{
          const direct=Array.from(el.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ').trim();
          const full=(el.textContent||'').trim();
          if((direct===name || full===name || full.startsWith(name+' ')) && el.parentElement){
            const card=el.closest('[class*="card"],[class*="calc"],[class*="basis"]') || el.parentElement;
            card.classList.add('ms713-strategy-'+name.toLowerCase().replace(/[^a-z]/g,''));
          }
        });
      });
    });
  }
  let raf=0;
  function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;refine()})}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',()=>setTimeout(schedule,20),true);
  schedule();
})();
