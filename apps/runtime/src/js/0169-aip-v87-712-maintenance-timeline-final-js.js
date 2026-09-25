
(function(){
  const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
  let pop=null,pinned=false,current=null;

  function ordinal(n){
    n=Number(n);
    const mod100=n%100;
    if(mod100>=11&&mod100<=13)return n+'th';
    return n+({1:'st',2:'nd',3:'rd'}[n%10]||'th');
  }
  function fullDate(s){
    const str=String(s||'').trim();
    let y,m,d,hit=str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(hit){y=+hit[1];m=+hit[2];d=+hit[3]}
    else if((hit=str.match(/^(\d{1,2})[-\/](\d{1,2})(?:[-\/](\d{2,4}))?$/))){
      m=+hit[1];d=+hit[2];y=hit[3]?+(hit[3].length===2?'20'+hit[3]:hit[3]):2026;
    } else return str;
    const dt=new Date(y,m-1,d);
    if(isNaN(dt))return str;
    return `${ordinal(d)} ${dt.toLocaleString('en-US',{month:'long'})} ${y}`;
  }
  function labelDate(s){
    const str=String(s||'').trim();
    let y,m,d,hit=str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(hit){y=+hit[1];m=+hit[2];d=+hit[3]}
    else if((hit=str.match(/^(\d{1,2})[-\/](\d{1,2})(?:[-\/](\d{2,4}))?$/))){
      m=+hit[1];d=+hit[2];y=hit[3]?+(hit[3].length===2?'20'+hit[3]:hit[3]):2026;
    } else return str;
    const dt=new Date(y,m-1,d);
    if(isNaN(dt))return str;
    return `${ordinal(d)} ${dt.toLocaleString('en-US',{month:'long'})}`;
  }
  function eventClass(kind){
    const k=String(kind||'').toLowerCase();
    if(k.includes('maintenance'))return 'maintenance';
    if(k.includes('condition'))return 'condition';
    if(k.includes('risk'))return 'risk';
    return 'evidence';
  }
  function prepareEvents(root){
    root.querySelectorAll('.ms686-card').forEach(card=>{
      const heading=(card.querySelector('.ms686-head h3')?.textContent||'').toLowerCase();
      const sub=card.querySelector('.ms686-head .ms686-sub');
      if(heading.includes('timeline')||heading.includes('policy evolution')){
        if(sub)sub.remove();
        card.querySelectorAll('.ms686-event').forEach(ev=>{
          const raw=ev.dataset.ms712Raw || ev.getAttribute('title') || ev.getAttribute('aria-label') || '';
          if(raw&&!ev.dataset.ms712Raw)ev.dataset.ms712Raw=raw;
          // Stop native browser tooltip; our structured card is authoritative.
          ev.removeAttribute('title');
          ev.removeAttribute('aria-label');

          const parts=raw.split(' · ');
          const iso=parts[0]||'';
          const b=ev.querySelector('b');
          if(b&&iso)b.textContent=labelDate(iso);
        });
      }
      if(heading.includes('cross-strategy suitability')){
        if(sub)sub.remove();
      }
    });
  }
  function parse(ev){
    const raw=ev.dataset.ms712Raw||'';
    const parts=raw.split(' · ');
    return {
      date:parts[0]||'',
      kind:parts[1]||'Evidence event',
      record:parts[2]||'',
      detail:parts.slice(3).join(' · ')||'Evidence recorded'
    };
  }
  function ensurePop(){
    if(pop)return pop;
    pop=document.createElement('div');
    pop.className='ms711-popover';
    pop.innerHTML='<div class="ms711-head"><div class="ms711-title">Timeline Detail</div><button class="ms711-close" aria-label="Close">×</button></div><div class="ms711-body"></div><div class="ms711-hint">Click to pin this detail</div>';
    document.body.appendChild(pop);
    pop.querySelector('.ms711-close').onclick=close;
    return pop;
  }
  function close(){
    if(pop)pop.style.display='none';
    pinned=false;current=null;
    pop?.classList.remove('pinned');
  }
  function place(e){
    if(!pop)return;
    const x0=e?.clientX||100,y0=e?.clientY||100;
    pop.style.left=(x0+14)+'px';pop.style.top=(y0+14)+'px';
    const r=pop.getBoundingClientRect();
    if(r.right>innerWidth-10)pop.style.left=Math.max(10,x0-r.width-14)+'px';
    if(r.bottom>innerHeight-10)pop.style.top=Math.max(10,y0-r.height-14)+'px';
  }
  function show(ev,e,pin){
    const d=parse(ev),p=ensurePop(),ec=eventClass(d.kind);
    p.className='ms711-popover '+(pin?'pinned':'');
    p.querySelector('.ms711-title').textContent='Timeline Detail';
    p.querySelector('.ms711-body').innerHTML=
      `<div class="ms712-date">${fullDate(d.date)}</div>
       <div class="ms712-tags">
         <span class="ms712-tag event ${ec}">${d.kind.replace(/</g,'&lt;')}</span>
         ${d.record?`<span class="ms712-tag record">${d.record.replace(/</g,'&lt;')}</span>`:''}
       </div>
       <div class="ms712-section-label">${ec==='maintenance'?'Maintenance Information':ec==='condition'?'Condition Information':ec==='risk'?'Risk Information':'Evidence Information'}</div>
       <div class="ms712-detail">${d.detail.replace(/</g,'&lt;')}</div>`;
    p.style.display='block';
    pinned=!!pin;current=ev;
    place(e);
  }
  function eventFrom(node){
    return node?.closest?.('.ms686-event')||null;
  }

  // Capture before the older v711 handlers. This prevents the former blue card
  // and prevents duplicate date text in its body.
  document.addEventListener('mouseover',e=>{
    const ev=eventFrom(e.target); if(!ev||pinned)return;
    e.stopImmediatePropagation();show(ev,e,false);
  },true);
  document.addEventListener('mousemove',e=>{
    if(pop&&pop.style.display!=='none'&&!pinned){e.stopImmediatePropagation();place(e)}
  },true);
  document.addEventListener('mouseout',e=>{
    const ev=eventFrom(e.target); if(!ev||pinned)return;
    e.stopImmediatePropagation(); if(pop)pop.style.display='none';
  },true);
  document.addEventListener('click',e=>{
    const ev=eventFrom(e.target);
    if(ev){
      e.preventDefault();e.stopImmediatePropagation();show(ev,e,true);return;
    }
    if(e.target.closest?.('.ms711-popover'))return;
    if(pinned)close();
  },true);

  function clean(){
    VIEWS.forEach(v=>{
      const root=document.getElementById('view-'+v);
      if(root)prepareEvents(root);
    });
  }
  let raf=0;
  function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;clean()})}
  const mo=new MutationObserver(()=>schedule());
  mo.observe(document.getElementById('main')||document.body,{childList:true,subtree:true});
  document.addEventListener('aip:data-source-changed',()=>setTimeout(schedule,20));
  document.addEventListener('change',()=>setTimeout(schedule,20),true);
  schedule();setTimeout(schedule,160);setTimeout(schedule,500);
})();
