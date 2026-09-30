
(function(){
  let pop=null;
  let pinned=false;
  let pinnedEvent=null;

  function eventClass(kind){
    const k=String(kind||'').toLowerCase();
    if(k.includes('maintenance'))return 'maintenance';
    if(k.includes('condition'))return 'condition';
    if(k.includes('risk'))return 'risk';
    return 'evidence';
  }

  function parse(ev){
    const raw=ev.dataset.ms712Raw || '';
    const parts=raw.split(' · ');
    const kind=parts[1]||'Evidence event';
    let record=parts[2]||'';
    // Keep just the WO / record identifier; remove generic "Maintenance Record" wording.
    record=record.replace(/^maintenance\s*record\s*:?\s*/i,'').trim();
    return {
      kind,
      record,
      detail:parts.slice(3).join(' · ')||'Evidence recorded'
    };
  }

  function ensure(){
    if(pop)return pop;
    pop=document.createElement('div');
    pop.className='ms714-popover';
    pop.innerHTML=
      '<div class="ms714-top"><button class="ms714-close" aria-label="Close">×</button></div>'+
      '<div class="ms714-body"></div>'+
      '<div class="ms714-pin-hint">Pin to lock</div>';
    document.body.appendChild(pop);

    pop.querySelector('.ms714-close').addEventListener('click',function(e){
      e.preventDefault();
      e.stopPropagation();
      closePinned();
    });
    return pop;
  }

  function closePinned(){
    pinned=false;
    pinnedEvent=null;
    if(!pop)return;
    pop.classList.remove('pinned');
    pop.style.display='none';
  }

  function place(e){
    if(!pop)return;
    const x0=e?.clientX||100,y0=e?.clientY||100;
    pop.style.left=(x0+14)+'px';
    pop.style.top=(y0+14)+'px';
    const r=pop.getBoundingClientRect();
    if(r.right>innerWidth-10) pop.style.left=Math.max(10,x0-r.width-14)+'px';
    if(r.bottom>innerHeight-10) pop.style.top=Math.max(10,y0-r.height-14)+'px';
  }

  function render(ev,e,lock){
    const d=parse(ev),p=ensure(),ec=eventClass(d.kind);
    p.className='ms714-popover'+(lock?' pinned':'');
    p.querySelector('.ms714-body').innerHTML=
      `<div class="ms714-tags">
        ${d.record?`<span class="ms714-tag record">${d.record.replace(/</g,'&lt;')}</span>`:''}
       </div>
       <div class="ms714-section">${ec==='maintenance'?'Maintenance Information':ec==='condition'?'Condition Information':ec==='risk'?'Risk Information':'Evidence Information'}</div>
       <div class="ms714-detail">${d.detail.replace(/</g,'&lt;')}</div>`;
    p.style.display='block';

    pinned=!!lock;
    pinnedEvent=lock?ev:null;
    if(lock){
      // Fixed position once pinned; no hover movement/hide can alter it.
      p.classList.add('pinned');
    }
    place(e);
  }

  function evt(node){
    return node?.closest?.('.ms686-event')||null;
  }

  // Hover only previews. It never modifies a pinned card.
  document.addEventListener('mouseover',function(e){
    if(pinned)return;
    const ev=evt(e.target);
    if(!ev)return;
    render(ev,e,false);
  },false);

  document.addEventListener('mousemove',function(e){
    if(pinned)return;
    const ev=evt(e.target);
    if(ev && pop && pop.style.display!=='none') place(e);
  },false);

  document.addEventListener('mouseout',function(e){
    if(pinned)return;
    const ev=evt(e.target);
    if(!ev)return;
    if(pop)pop.style.display='none';
  },false);

  // Pointerdown on the actual timeline marker is the authoritative lock action.
  // Using bubble phase avoids competing with older capture-phase handlers.
  document.addEventListener('pointerdown',function(e){
    const ev=evt(e.target);
    if(!ev)return;
    e.preventDefault();
    render(ev,e,true);
  },false);

  // Click is a backup for browsers/environments without pointerdown.
  document.addEventListener('click',function(e){
    const ev=evt(e.target);
    if(ev){
      e.preventDefault();
      if(!pinned || pinnedEvent!==ev) render(ev,e,true);
      return;
    }
    if(e.target.closest?.('.ms714-popover')) return;
  },false);
})();
