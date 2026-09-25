
(function(){
  const main=document.getElementById('main');
  if(!main)return;
  let raf=0,timer=0,running=false;
  function active(){return main.querySelector('.view.active');}
  function recalc(){
    if(running)return;
    const view=active();
    if(!view)return;
    running=true;
    const x=main.scrollLeft;
    /* Reading layout is sufficient; do not change overflow styles or rerender the view. */
    void view.offsetWidth;
    void view.scrollWidth;
    void main.clientWidth;
    void main.scrollWidth;
    main.scrollLeft=Math.min(x,Math.max(0,main.scrollWidth-main.clientWidth));
    main.classList.toggle('aip-has-horizontal-overflow',main.scrollWidth>main.clientWidth+3);
    running=false;
  }
  function schedule(){
    if(raf)cancelAnimationFrame(raf);
    clearTimeout(timer);
    raf=requestAnimationFrame(function(){raf=requestAnimationFrame(recalc);});
    timer=setTimeout(recalc,140);
  }
  document.addEventListener('click',function(e){
    if(e.target.closest('[data-view],.nav-item,.subnav-item,.nav-link,.tabs button,.ops-tab,.sx-tab'))schedule();
  },true);
  ['aip:data-rendered','aip:data-source-changed','aip:view-rendered'].forEach(function(n){window.addEventListener(n,schedule);});
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('load',schedule,{once:true});
  const mo=new window.__APMSafeMutationObserver(function(records){
    if(records.some(function(r){return r.type==='childList'||(r.type==='attributes'&&(r.attributeName==='class'||r.attributeName==='hidden'));}))schedule();
  });
  mo.observe(main,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
  if('ResizeObserver' in window){
    const ro=new ResizeObserver(schedule);
    ro.observe(main);
  }
  window.refreshRightPaneScrollbar=schedule;
  schedule();
})();
