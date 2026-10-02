
(function(){
  function editable(t){
    if(!t)return false;
    const tag=(t.tagName||'').toUpperCase();
    return tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||t.isContentEditable;
  }
  function shownRows(selector){
    return [...document.querySelectorAll(selector)].filter(r=>{
      const s=getComputedStyle(r);
      return s.display!=='none' && s.visibility!=='hidden' && r.offsetParent!==null;
    });
  }
  function focusSelected(row){
    if(!row)return;
    row.tabIndex=-1;
    try{row.focus({preventScroll:true})}catch(_){try{row.focus()}catch(__){}}
    try{row.scrollIntoView({block:'nearest',inline:'nearest'})}catch(_){}
  }

  function moveAttention(delta){
    const rows=shownRows('#sus8AttentionTable tbody tr[data-sus-priority-index]');
    const current=document.querySelector('#sus8AttentionTable tbody tr.sus8-context-mark');
    if(!rows.length || !current || !rows.includes(current))return false;

    const i=rows.indexOf(current);
    const j=Math.max(0,Math.min(rows.length-1,i+delta));
    const next=rows[j];
    if(!next)return false;

    rows.forEach(r=>r.classList.remove('sus8-context-mark'));
    next.classList.add('sus8-context-mark');
    focusSelected(next);
    return true;
  }

  function moveClimate(delta){
    const rows=shownRows('#sus8ClimateTable tbody tr.sus8-climate-row[data-sus-climate-index]');
    const current=document.querySelector('#sus8ClimateTable tbody tr.sus8-climate-row.selected');
    if(!rows.length || !current || !rows.includes(current))return false;

    const i=rows.indexOf(current);
    const j=Math.max(0,Math.min(rows.length-1,i+delta));
    const next=rows[j];
    if(!next)return false;

    // Use the Climate row's own click-selection path. That canonical handler
    // calls susClimateSelectRow(), moves the selected class, removes the old ×,
    // creates the new row-local ×, and refreshes the Asset Risk Pathway.
    // This avoids duplicating/losing the row-clear logic in keyboard navigation.
    next.click();

    const selected=document.querySelector('#sus8ClimateTable tbody tr.sus8-climate-row.selected')||next;
    focusSelected(selected);
    return true;
  }

  function handle(e){
    if(e.key!=='ArrowUp' && e.key!=='ArrowDown')return;
    if(editable(e.target))return;

    const delta=e.key==='ArrowDown'?1:-1;
    let handled=false;

    if(document.querySelector('#view-sustainabilityintelligence.active #sus8AttentionTable tbody tr.sus8-context-mark')){
      handled=moveAttention(delta);
    }else if(document.querySelector('#view-sustainabilityintelligence.active #sus8ClimateTable tbody tr.sus8-climate-row.selected')){
      handled=moveClimate(delta);
    }

    if(handled){
      e.preventDefault();
      e.stopPropagation();
      if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();
    }
  }

  // Window capture deliberately runs before document-level application navigation.
  window.addEventListener('keydown',handle,true);

  // Whenever a mouse selection is made, move keyboard focus into that row as well.
  document.addEventListener('pointerup',function(e){
    const a=e.target.closest?.('#sus8AttentionTable tbody tr[data-sus-priority-index]');
    if(a){
      setTimeout(()=>{
        const selected=document.querySelector('#sus8AttentionTable tbody tr.sus8-context-mark');
        if(selected)focusSelected(selected);
      },0);
      return;
    }
    const c=e.target.closest?.('#sus8ClimateTable tbody tr.sus8-climate-row[data-sus-climate-index]');
    if(c){
      setTimeout(()=>{
        const selected=document.querySelector('#sus8ClimateTable tbody tr.sus8-climate-row.selected');
        if(selected)focusSelected(selected);
      },0);
    }
  },true);
})();
