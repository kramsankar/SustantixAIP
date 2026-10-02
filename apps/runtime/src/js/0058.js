
/* Authoritative Decision Intelligence review interaction — works in Synthetic and Excel modes. */
(function(){
  function esc(v){
    return String(v ?? '').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
  }
  function rows(){return Array.isArray(window.DECISION_INTELLIGENCE_ROWS)?window.DECISION_INTELLIGENCE_ROWS:[];}
  function findDecision(id){return rows().find(function(r){return String(r.id)===String(id);});}
  function close(){
    var host=document.getElementById('decisionDetailBackdrop');
    if(host){host.classList.remove('open');host.setAttribute('aria-hidden','true');}
    document.body.classList.remove('decision-detail-open');
  }
  function open(id){
    var x=findDecision(id);
    if(!x){
      console.warn('Decision not found for Review Decision:',id,rows());
      return;
    }
    var host=document.getElementById('decisionDetailBackdrop');
    if(!host){
      host=document.createElement('div');
      host.id='decisionDetailBackdrop';
      host.className='decision-drawer-backdrop';
      document.body.appendChild(host);
    } else if(host.parentElement!==document.body){
      document.body.appendChild(host);
    }
    host.setAttribute('aria-hidden','false');
    host.innerHTML='<div class="decision-drawer" role="dialog" aria-modal="true" aria-labelledby="decisionDetailTitle">'
      +'<div class="decision-drawer-head"><div><div class="eyebrow" style="color:var(--teal)">'+esc(x.category)+' · '+esc(x.id)+'</div><h2 id="decisionDetailTitle" style="margin:5px 0 0">'+esc(x.title)+'</h2></div><button class="decision-drawer-close" type="button" data-decision-close aria-label="Close decision review">×</button></div>'
      +'<div class="decision-evidence"><b>Why this decision is ranked</b><div style="margin-top:6px">'+esc(x.reason)+'</div></div>'
      +'<div class="decision-detail-grid">'
      +'<div class="decision-detail-box"><span>Decision score</span><b>'+Number(x.decisionScore||0).toFixed(1)+' / 100</b></div>'
      +'<div class="decision-detail-box"><span>Priority</span><b>'+esc(x.priority)+'</b></div>'
      +'<div class="decision-detail-box"><span>Gross value at stake</span><b>'+(typeof fmtINR==='function'?fmtINR(Number(x.impactValue)||0):esc(x.impact))+'</b></div>'
      +'<div class="decision-detail-box"><span>AI confidence</span><b>'+Number(x.confidence||0).toFixed(2)+'%</b></div>'
      +'<div class="decision-detail-box"><span>Execution readiness</span><b>'+Number(x.executionReadiness||0).toFixed(2)+'%</b></div>'
      +'<div class="decision-detail-box"><span>Owner / due date</span><b>'+esc(x.owner)+' · '+esc(x.dueDate)+'</b></div>'
      +'<div class="decision-detail-box"><span>Decision status</span><b>'+esc(x.status)+'</b></div>'
      +'<div class="decision-detail-box"><span>Value basis</span><b>'+esc(x.valueBasis)+'</b></div>'
      +'<div class="decision-detail-box"><span>Decision age</span><b>'+decisionAgeDays(x.raisedDate)+' days</b><small>Raised '+esc(x.raisedDate)+'</small></div>'
      +'<div class="decision-detail-box"><span>Time remaining</span><b>'+esc(decisionTimingText(x))+'</b><small>Due '+esc(x.dueDate)+'</small></div>'
      +'</div>'
      +'<div class="decision-evidence"><b>Decision score composition</b><div class="decision-score-breakdown">'
      +'<div><span>Priority & urgency</span><b>'+Number(x.scoreParts?.priority||0).toFixed(1)+'</b><small>30%</small></div>'
      +'<div><span>Value at stake</span><b>'+Number(x.scoreParts?.value||0).toFixed(1)+'</b><small>25%</small></div>'
      +'<div><span>AI confidence</span><b>'+Number(x.scoreParts?.confidence||0).toFixed(1)+'</b><small>20%</small></div>'
      +'<div><span>Time urgency</span><b>'+Number(x.scoreParts?.urgency||0).toFixed(1)+'</b><small>15%</small></div>'
      +'<div><span>Execution readiness</span><b>'+Number(x.scoreParts?.readiness||0).toFixed(1)+'</b><small>10%</small></div>'
      +'</div></div>'
      +'<div class="decision-evidence"><b>Risk if deferred</b><div style="margin-top:6px">'+esc(x.riskIfDeferred)+'</div></div>'
      +'<div class="decision-evidence"><b>Calculation basis</b><div style="margin-top:6px">'+esc(x.calculationBasis)+'</div></div>'
      +'<div class="decision-evidence"><b>Related decision / exposure group</b><div style="margin-top:6px">Group <b>'+esc(x.exposureGroup||x.id)+'</b> · '+rows().filter(function(r){return String(r.exposureGroup||r.id)===String(x.exposureGroup||x.id);}).length+' related recommendation(s). Gross value is counted once for this group.</div></div>'
      +'<div class="decision-meta">Source: <b>'+esc(x.source)+'</b> · Record: <b>'+esc(x.sourceRecordId)+'</b></div>'
      +'<div class="decision-drawer-actions"><button class="decision-review-btn" type="button" data-decision-source="'+esc(x.target||'overview')+'">Open source module →</button>'+(x.scenarioEligible?'<button class="decision-secondary-btn" type="button" data-decision-simulate="'+esc(x.id)+'">Simulate options →</button>':'')+'<button class="decision-secondary-btn" type="button" data-decision-close>Close</button></div>'
      +'</div>';
    host.classList.add('open');
    document.body.classList.add('decision-detail-open');
    requestAnimationFrame(function(){host.querySelector('[data-decision-close]')?.focus({preventScroll:true});});
  }

  document.addEventListener('click',function(e){
    var review=e.target.closest && e.target.closest('#view-decisionintelligence .decision-review-btn[data-decision-id]');
    if(review){
      e.preventDefault();e.stopPropagation();open(review.getAttribute('data-decision-id'));return;
    }
    var closeBtn=e.target.closest && e.target.closest('#decisionDetailBackdrop [data-decision-close]');
    if(closeBtn){e.preventDefault();close();return;}
    var simulate=e.target.closest && e.target.closest('#decisionDetailBackdrop [data-decision-simulate]');
    if(simulate){
      e.preventDefault();
      var decisionId=simulate.getAttribute('data-decision-simulate')||'';
      try{sessionStorage.setItem('aipScenarioDecisionId',decisionId);}catch(_){}
      close();
      if(typeof window.activate==='function')window.activate('scenariosimulator');
      else if(typeof activate==='function')activate('scenariosimulator');
      if(typeof showToast==='function')showToast('Scenario context','Scenario Simulator opened for '+decisionId);
      return;
    }
    var source=e.target.closest && e.target.closest('#decisionDetailBackdrop [data-decision-source]');
    if(source){
      e.preventDefault();
      var target=source.getAttribute('data-decision-source')||'overview';
      close();
      if(typeof window.activate==='function')window.activate(target);
      else if(typeof activate==='function')activate(target);
      return;
    }
    var backdrop=document.getElementById('decisionDetailBackdrop');
    if(backdrop && e.target===backdrop)close();
  },true);

  document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
  window.decisionOpenDetail=open;
  window.decisionCloseDetail=close;
})();
