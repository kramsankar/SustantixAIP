
(function(){
  'use strict';
  const TOP='aip-v288-table-topscroll', SURFACE='aip-v288-table-scroll-surface', WRAP='aip-v288-auto-wrap';
  const registered=new Set();
  const audit={release:'v288',baseline:'v287',tablesSeen:0,headersStandardized:0,topScrollbarsCreated:0,existingTopScrollbarsReused:0,autoWrappersCreated:0,surfacesRegistered:0};

  function visible(el){
    if(!el||!el.isConnected)return false;
    const cs=getComputedStyle(el);
    return cs.display!=='none'&&cs.visibility!=='hidden'&&el.getClientRects().length>0;
  }
  function overflowCapable(el){
    if(!el||el===document.body||el===document.documentElement)return false;
    const ox=getComputedStyle(el).overflowX;
    return ox==='auto'||ox==='scroll'||ox==='overlay';
  }
  function existingTopFor(surface){
    const p=surface.previousElementSibling;
    if(!p)return null;
    if(p.classList.contains(TOP))return p;
    const c=(p.className||'').toString().toLowerCase();
    if(c.includes('topscroll')||c.includes('top-scrollbar')||c.includes('top-scroll')) return p;
    return null;
  }
  function findSurface(table){
    let el=table.parentElement, candidate=null, depth=0;
    while(el&&el!==document.body&&depth<10){
      if(el.classList&&el.classList.contains(TOP))break;
      if(overflowCapable(el)){
        if(!candidate)candidate=el;
        if(el.scrollWidth>el.clientWidth+2 || table.scrollWidth>el.clientWidth+2)return el;
      }
      el=el.parentElement; depth++;
    }
    if(candidate)return candidate;
    const parent=table.parentElement;
    if(parent&&visible(table)&&table.scrollWidth>parent.clientWidth+2){
      if(parent.classList.contains(WRAP))return parent;
      const w=document.createElement('div');
      w.className=WRAP;
      parent.insertBefore(w,table);
      w.appendChild(table);
      audit.autoWrappersCreated++;
      return w;
    }
    return null;
  }
  function bindPair(top,surface){
    if(!top||!surface||surface.dataset.aipV288Bound==='1')return;
    const fromTop=()=>{
      const x=top.scrollLeft;
      if(Math.abs(surface.scrollLeft-x)>.5)surface.scrollLeft=x;
    };
    const fromBottom=()=>{
      const x=surface.scrollLeft;
      if(Math.abs(top.scrollLeft-x)>.5)top.scrollLeft=x;
    };
    top.addEventListener('scroll',fromTop,{passive:true});
    surface.addEventListener('scroll',fromBottom,{passive:true});
    surface.dataset.aipV288Bound='1';
    surface.__aipV288Top=top;
    registered.add(surface);
    audit.surfacesRegistered++;
  }
  function ensureTop(surface){
    let top=existingTopFor(surface);
    if(top){
      top.classList.add(TOP);
      if(!top.firstElementChild){const sp=document.createElement('div');sp.className='aip-v288-table-topscroll-spacer';top.appendChild(sp)}
      else top.firstElementChild.classList.add('aip-v288-table-topscroll-spacer');
      audit.existingTopScrollbarsReused++;
    }else{
      top=document.createElement('div');
      top.className=TOP;
      top.setAttribute('role','scrollbar');
      top.setAttribute('aria-label','Horizontal table scroll');
      const sp=document.createElement('div');sp.className='aip-v288-table-topscroll-spacer';top.appendChild(sp);
      surface.parentNode.insertBefore(top,surface);
      audit.topScrollbarsCreated++;
    }
    surface.classList.add(SURFACE);
    bindPair(top,surface);
    return top;
  }
  function standardizeHeader(table){
    if(table.dataset.aipV288Header==='1')return;
    table.dataset.aipV288Header='1';
    audit.headersStandardized++;
    /* Do not rewrite column text or structure; CSS standardizes every existing TH/title cell. */
  }
  function refresh(surface){
    if(!surface||!surface.isConnected){registered.delete(surface);return}
    const top=surface.__aipV288Top||existingTopFor(surface);
    if(!top)return;
    const tables=[...surface.querySelectorAll('table')].filter(visible);
    if(!tables.length){top.classList.remove('aip-v288-active');return}
    let width=surface.scrollWidth;
    tables.forEach(t=>{width=Math.max(width,t.scrollWidth,t.getBoundingClientRect().width)});
    width=Math.max(width,surface.clientWidth);
    const spacer=top.firstElementChild;
    if(spacer)spacer.style.width=Math.ceil(width)+'px';
    const over=width>surface.clientWidth+2;
    top.classList.toggle('aip-v288-active',over&&visible(surface));
    if(over && Math.abs(top.scrollLeft-surface.scrollLeft)>.5)top.scrollLeft=surface.scrollLeft;
  }
  function processTable(table){
    if(!table||table.tagName!=='TABLE')return;
    audit.tablesSeen++;
    standardizeHeader(table);
    if(table.closest?.('[data-aip-v288-skip-top="1"]'))return;
    if(!visible(table))return;
    const s=findSurface(table);
    if(s){ensureTop(s);refresh(s)}
  }
  function scan(root){
    if(!root||!root.isConnected)return;
    if(root.tagName==='TABLE')processTable(root);
    if(root.querySelectorAll)root.querySelectorAll('table').forEach(processTable);
  }
  function scanActive(){
    const active=document.querySelector('.view.active')||document.getElementById('main')||document.body;
    scan(active);
    document.querySelectorAll('.open, [aria-modal="true"]').forEach(el=>{if(el!==active)scan(el)});
    registered.forEach(refresh);
  }
  let clickTimer=0;
  function deferredActiveScan(){clearTimeout(clickTimer);clickTimer=setTimeout(scanActive,24)}
  function install(){
    scan(document.body);
    if(!document.documentElement.__aipV288TableObserver){
      const mo=new MutationObserver(records=>{
        const roots=[];
        records.forEach(r=>r.addedNodes&&r.addedNodes.forEach(n=>{if(n.nodeType===1)roots.push(n)}));
        if(!roots.length)return;
        requestAnimationFrame(()=>{roots.forEach(scan);registered.forEach(refresh)});
      });
      mo.observe(document.body,{childList:true,subtree:true});
      document.documentElement.__aipV288TableObserver=mo;
      document.addEventListener('click',deferredActiveScan,true);
      window.addEventListener('resize',()=>requestAnimationFrame(()=>registered.forEach(refresh)),{passive:true});
    }
    setTimeout(scanActive,180);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
  window.AIP_V288_TABLE_AUDIT=audit;
})();
