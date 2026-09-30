
(function(){
  function metricText(card){
    return [
      card.querySelector('.kpi-label')?.textContent||'',
      card.querySelector('.kpi-value')?.textContent||'',
      card.querySelector('.kpi-delta')?.textContent||''
    ].join(' ').trim();
  }

  function numericValue(card){
    const raw=(card.querySelector('.kpi-value')?.textContent||'').replace(/,/g,'');
    const match=raw.match(/-?\d+(?:\.\d+)?/);
    return match?Number(match[0]):null;
  }

  function sourceLabel(card){
    const text=metricText(card);

    if(/forecast|predicted|prediction|expected|next \d|future|probability|remaining useful life|rul/i.test(text)) return 'Predicted';
    if(/estimated|at risk|potential|avoided|annualized|opportunity|exposure|impact/i.test(text)) return 'Estimated';
    if(/simulated|scenario|what-if|score|index|rate|ratio|share|compliance|mttr|mtbf|average|avg\.|blended|efficiency/i.test(text)) return 'Calculated';
    return 'Measured';
  }

  function siblingMetricCards(card){
    const parent=card.parentElement;
    if(!parent) return [card];
    return [...parent.children].filter(el=>el.classList?.contains('enhanced-kpi'));
  }

  function relation(card){
    const text=metricText(card);
    const value=numericValue(card);
    if(value===null) return {pct:0,label:'No numeric relationship available'};

    const valueText=card.querySelector('.kpi-value')?.textContent||'';
    if(/%/.test(valueText) || /\/100/.test(valueText) || /health index|health score|compliance rate|availability|performance ratio|portfolio pr/i.test(text)){
      const pct=Math.max(0,Math.min(100,value));
      return {pct,label:`Ring = KPI value on a 0–100 scale (${pct.toFixed(pct%1?1:0)}%)`};
    }

    if(/target/i.test(text)){
      const targetMatch=text.match(/target\s*[:\-]?\s*(\d+(?:\.\d+)?)/i);
      if(targetMatch){
        const target=Number(targetMatch[1]);
        const pct=target?Math.max(0,Math.min(100,(value/target)*100)):0;
        return {pct,label:`Ring = ${pct.toFixed(0)}% of stated target`};
      }
    }

    const siblings=siblingMetricCards(card)
      .map(c=>({card:c,value:numericValue(c)}))
      .filter(x=>Number.isFinite(x.value) && x.value>=0);
    const max=Math.max(...siblings.map(x=>x.value),0);
    const pct=max>0?Math.max(0,Math.min(100,(value/max)*100)):0;
    return {
      pct,
      label:max>0
        ? `Ring = ${pct.toFixed(0)}% relative to the largest KPI in this row`
        : 'Ring = relative scale unavailable'
    };
  }

  function updateCard(card){
    if(!card.classList.contains('enhanced-kpi')) return;

    const pill=card.querySelector('.kpi-status-pill');
    if(pill) pill.textContent=sourceLabel(card);

    const rel=relation(card);
    const ring=card.querySelector('.kpi-mini-ring');
    if(ring){
      ring.style.setProperty('--ring-val',String(rel.pct));
      const span=ring.querySelector('span');
      if(span) span.textContent=String(Math.round(rel.pct));
      ring.setAttribute('title',rel.label);
      ring.setAttribute('aria-label',rel.label);
    }

    let context=card.querySelector('.kpi-ring-context');
    if(!context){
      context=document.createElement('div');
      context.className='kpi-ring-context';
      card.appendChild(context);
    }
    context.textContent=rel.label.replace(/^Ring\s*=\s*/i,'');
  }

  function updateAll(root=document){
    root.querySelectorAll('.enhanced-kpi').forEach(card=>{
      if(card.closest('#view-overview')) return;
      updateCard(card);
    });
  }

  function boot(){
    updateAll();
    const main=document.getElementById('main')||document.body;
    const observer=new window.__APMSafeMutationObserver(()=>updateAll(main));
    observer.observe(main,{childList:true,subtree:true});
    window.updateKPIContext=updateAll;
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();
