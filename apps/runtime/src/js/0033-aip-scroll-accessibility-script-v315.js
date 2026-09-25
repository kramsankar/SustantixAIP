
(function(){
  const formControls='input,textarea,select,[contenteditable="true"],[role="slider"],[role="combobox"]';
  const selectors=[
    '#sidebar','#main','.table-scroll','.table-wrap','.aig-tablewrap','.dx-table-wrap',
    '.vision-table-wrap','.ops-table-wrap','.sx-tablewrap','.qa-table-scroll',
    '.flow-strip','.sx-flow','.tabs','.case-tabs','.ops-tabs','.aig-tabs','.sx-tabs','.avx-tabs',
    '.event-stream','.dx-messages','.oa-messages','.payload-box'
  ].join(',');

  function overflow(el,axis){
    if(!el||el===document.body||el===document.documentElement)return false;
    const c=getComputedStyle(el);
    return axis==='x'
      ? /(auto|scroll)/.test(c.overflowX)&&el.scrollWidth>el.clientWidth+3
      : /(auto|scroll)/.test(c.overflowY)&&el.scrollHeight>el.clientHeight+3;
  }
  function canMove(el,axis,dir){
    if(!overflow(el,axis))return false;
    const pos=axis==='x'?el.scrollLeft:el.scrollTop;
    const max=axis==='x'?el.scrollWidth-el.clientWidth:el.scrollHeight-el.clientHeight;
    return dir<0?pos>1:pos<max-1;
  }
  function prepare(el){
    if(!el||(!overflow(el,'x')&&!overflow(el,'y')))return;
    el.classList.add('aip-scroll-surface');
    if(!el.hasAttribute('tabindex'))el.tabIndex=0;
    if(!el.hasAttribute('role'))el.setAttribute('role','region');
  }
  function prepareAll(root){
    const r=root&&root.querySelectorAll?root:document;
    if(r.matches&&r.matches(selectors))prepare(r);
    r.querySelectorAll(selectors).forEach(prepare);
  }
  function paneFor(target){
    const side=document.getElementById('sidebar');
    const main=document.getElementById('main');
    if(side&&target instanceof Element&&side.contains(target))return side;
    if(main&&target instanceof Element&&main.contains(target))return main;
    return null;
  }
  function scopedSurface(target,axis,dir){
    const pane=paneFor(target);
    if(!pane)return null;
    if(pane.id==='sidebar')return canMove(pane,axis,dir)?pane:null;
    let el=target instanceof Element?target:null;
    while(el&&el!==pane.parentElement){
      if(pane.contains(el)&&canMove(el,axis,dir))return el;
      if(el===pane)break;
      el=el.parentElement;
    }
    return canMove(pane,axis,dir)?pane:null;
  }
  function scopedScrollable(target,axis){
    const pane=paneFor(target);
    if(!pane)return null;
    if(pane.id==='sidebar')return overflow(pane,axis)?pane:null;
    let el=target instanceof Element?target:null;
    while(el&&el!==pane.parentElement){
      if(pane.contains(el)&&overflow(el,axis))return el;
      if(el===pane)break;
      el=el.parentElement;
    }
    return overflow(pane,axis)?pane:null;
  }

  document.addEventListener('keydown',function(e){
    if(e.defaultPrevented||e.altKey||e.metaKey)return;
    const cppa=document.getElementById('view-commercialppa');
    if(cppa&&cppa.classList.contains('active')&&(window.__cppaRankingPointerInside||window.__cppaRankingKeyboardScope||document.activeElement?.closest?.('#view-commercialppa .cppa-rank-row[data-plant]'))&&['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
    if(e.target.closest&&e.target.closest(formControls))return;
    const k=e.key;
    /* Sidebar Up/Down is handled by the navigation controller below: it changes the selected page, not merely scroll position. */
    if((k==='ArrowUp'||k==='ArrowDown')&&paneFor(e.target)?.id==='sidebar')return;
    const dirY=k==='ArrowUp'?-1:k==='ArrowDown'?1:k==='PageUp'?-1:k==='PageDown'?1:0;
    const dirX=k==='ArrowLeft'?-1:k==='ArrowRight'?1:0;
    const edge=k==='Home'||k==='End';
    if(!dirY&&!dirX&&!edge)return;

    let surface=null;
    if(dirY)surface=scopedSurface(e.target,'y',dirY);
    else if(dirX)surface=scopedSurface(e.target,'x',dirX);
    else surface=scopedScrollable(e.target,'y')||scopedScrollable(e.target,'x');
    if(!surface)return;

    if(dirY){
      const amount=(k==='PageUp'||k==='PageDown')?Math.max(100,Math.floor(surface.clientHeight*.82)):32;
      surface.scrollTop+=dirY*amount;
    }else if(dirX){
      surface.scrollLeft+=dirX*32;
    }else if(k==='Home'){
      if(e.ctrlKey){surface.scrollTop=0;surface.scrollLeft=0}
      else if(overflow(surface,'y'))surface.scrollTop=0;
      else surface.scrollLeft=0;
    }else if(k==='End'){
      if(e.ctrlKey){surface.scrollTop=surface.scrollHeight;surface.scrollLeft=surface.scrollWidth}
      else if(overflow(surface,'y'))surface.scrollTop=surface.scrollHeight;
      else surface.scrollLeft=surface.scrollWidth;
    }
    e.preventDefault();
  },true);

  document.addEventListener('wheel',function(e){
    if(!e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY))return;
    const s=scopedSurface(e.target,'x',e.deltaY<0?-1:1);
    if(!s)return;
    s.scrollLeft+=e.deltaY;
    e.preventDefault();
  },{capture:true,passive:false});

  function init(){
    prepareAll(document);
    const side=document.getElementById('sidebar');
    if(side){prepare(side);side.setAttribute('aria-label','Application navigation')}
    let queued=false;
    new window.__APMSafeMutationObserver(function(records){
      if(queued)return;queued=true;
      requestAnimationFrame(function(){
        queued=false;
        records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1)prepareAll(n)}));
      });
    }).observe(document.body,{childList:true,subtree:true});
    window.addEventListener('resize',function(){prepareAll(document)},{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
