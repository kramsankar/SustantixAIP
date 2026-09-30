
(function(){
  const VIEW_KEYS=['preventive','predictive','corrective','riskbased','adaptive'];
  let pop=null,pinned=false,currentTarget=null;

  function activeStrategy(){
    const active=VIEW_KEYS.find(v=>{
      const el=document.getElementById('view-'+v);
      return el && getComputedStyle(el).display!=='none';
    });
    return active||'predictive';
  }
  function fmtDateText(s){
    const str=String(s||'').trim();
    // Convert mm/dd, mm/dd/yyyy, m/d, and ISO dates to day-month.
    let m=str.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if(m){
      const mo=+m[1],d=+m[2];
      const dt=new Date(2026,mo-1,d);
      if(!isNaN(dt)) return `${d} ${dt.toLocaleString('en-US',{month:'short'})}`;
    }
    m=str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m){
      const dt=new Date(+m[1],+m[2]-1,+m[3]);
      if(!isNaN(dt)) return `${+m[3]} ${dt.toLocaleString('en-US',{month:'short'})}`;
    }
    return str;
  }
  function normalizeDates(root){
    root.querySelectorAll('text,span,div,small').forEach(el=>{
      if(el.children.length) return;
      const t=(el.textContent||'').trim();
      if(/^(\d{1,2}\/\d{1,2})(?:\/\d{2,4})?$/.test(t) || /^\d{4}-\d{2}-\d{2}/.test(t)){
        const nt=fmtDateText(t);
        if(nt!==t) el.textContent=nt;
      }
    });
  }
  function hideCaptions(root){
    root.querySelectorAll('.ms686-card').forEach(card=>{
      const title=(card.querySelector('.ms686-head h3')?.textContent||'').trim().toLowerCase();
      const sub=card.querySelector('.ms686-head .ms686-sub');
      if(!sub)return;
      const st=(sub.textContent||'').trim().toLowerCase();
      if(
        title.includes('policy evaluation') ||
        title.includes('reassessment timeline') ||
        st.includes('dated maintenance') ||
        st.includes('condition risk events') ||
        title.includes('cross-strategy suitability') ||
        st.includes('current degree of fit across the five maintenance')
      ){
        if(st.includes('dated maintenance')||st.includes('condition risk events')||st.includes('current degree of fit across the five maintenance')){
          sub.dataset.ms711Hide='1';
        }
      }
    });
  }
  function ensurePopover(){
    if(pop)return pop;
    pop=document.createElement('div');
    pop.className='ms711-popover';
    pop.innerHTML='<div class="ms711-head"><div class="ms711-title"></div><button class="ms711-close" aria-label="Close">×</button></div><div class="ms711-body"></div><div class="ms711-hint">Click to pin this detail</div>';
    document.body.appendChild(pop);
    pop.querySelector('.ms711-close').addEventListener('click',()=>closePopover());
    return pop;
  }
  function closePopover(){
    if(pop)pop.style.display='none';
    pinned=false; currentTarget=null;
    if(pop)pop.classList.remove('pinned');
  }
  function place(e){
    if(!pop)return;
    let x=(e?.clientX||0)+14,y=(e?.clientY||0)+14;
    const r=pop.getBoundingClientRect();
    if(x+r.width>innerWidth-10)x=Math.max(10,(e?.clientX||0)-r.width-14);
    if(y+r.height>innerHeight-10)y=Math.max(10,(e?.clientY||0)-r.height-14);
    pop.style.left=x+'px';pop.style.top=y+'px';
  }
  function extractDetail(target){
    const title=target.getAttribute('data-title')||target.getAttribute('aria-label')||target.getAttribute('title')||'Timeline detail';
    const body=target.getAttribute('data-detail')||target.getAttribute('data-tooltip')||target.getAttribute('data-tip')||target.textContent||'';
    return {title:title.trim(),body:body.trim()};
  }
  function isTimelineTarget(el){
    const root=el.closest('#view-preventive,#view-predictive,#view-corrective,#view-riskbased,#view-adaptive');
    if(!root)return false;
    const card=el.closest('.ms686-card');
    if(!card)return false;
    const heading=(card.querySelector('.ms686-head h3')?.textContent||'').toLowerCase();
    if(!heading.includes('timeline')&&!heading.includes('policy evaluation'))return false;
    // Prefer actual event/marker-like elements carrying details.
    return !!(el.getAttribute('title')||el.getAttribute('data-tooltip')||el.getAttribute('data-tip')||el.getAttribute('aria-label')||el.matches('circle,rect,.event,.marker,.dot,[class*="event"],[class*="marker"],[class*="dot"]'));
  }
  function show(target,e,makePinned=false){
    const d=extractDetail(target);
    if(!d.title&&!d.body)return;
    const p=ensurePopover(),strategy=activeStrategy();
    p.className='ms711-popover '+strategy+(makePinned?' pinned':'');
    p.querySelector('.ms711-title').textContent=d.title||'Timeline detail';
    p.querySelector('.ms711-body').textContent=d.body||d.title||'';
    p.style.display='block';
    pinned=!!makePinned;currentTarget=target;
    place(e);
  }

  document.addEventListener('mouseover',e=>{
    if(pinned)return;
    let t=e.target;
    while(t&&t!==document.body&&!isTimelineTarget(t))t=t.parentElement;
    if(t&&t!==document.body)show(t,e,false);
  },true);
  document.addEventListener('mousemove',e=>{
    if(pop&&pop.style.display!=='none'&&!pinned)place(e);
  },true);
  document.addEventListener('mouseout',e=>{
    if(pinned)return;
    let t=e.target;
    while(t&&t!==document.body&&!isTimelineTarget(t))t=t.parentElement;
    if(t&&t!==document.body&&pop)pop.style.display='none';
  },true);
  document.addEventListener('click',e=>{
    if(e.target.closest('.ms711-popover'))return;
    let t=e.target;
    while(t&&t!==document.body&&!isTimelineTarget(t))t=t.parentElement;
    if(t&&t!==document.body){
      e.preventDefault();e.stopPropagation();
      show(t,e,true);
      return;
    }
    if(pinned)closePopover();
  },true);

  function clean(){
    VIEW_KEYS.forEach(v=>{
      const root=document.getElementById('view-'+v);
      if(!root)return;
      hideCaptions(root);
      normalizeDates(root);
    });
  }
  let raf=0;function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;clean()})}
  const mo=new MutationObserver(()=>schedule());
  mo.observe(document.getElementById('main')||document.body,{childList:true,subtree:true});
  document.addEventListener('aip:data-source-changed',()=>setTimeout(schedule,20));
  document.addEventListener('change',()=>setTimeout(schedule,20),true);
  document.addEventListener('click',()=>setTimeout(schedule,30),true);
  schedule();setTimeout(schedule,150);
})();
