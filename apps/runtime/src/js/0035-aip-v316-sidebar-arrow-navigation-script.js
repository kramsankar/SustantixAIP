
(function(){
  function sidebar(){return document.getElementById('sidebar')}
  function navItems(){
    const s=sidebar();
    if(!s)return [];
    return Array.from(s.querySelectorAll('.nav-item[data-view]')).filter(function(el){
      const cs=getComputedStyle(el);
      return cs.display!=='none'&&cs.visibility!=='hidden'&&el.getClientRects().length>0;
    });
  }
  function prepare(){
    navItems().forEach(function(el){
      el.tabIndex=el.classList.contains('active')?0:-1;
      el.setAttribute('role','button');
      el.setAttribute('aria-current',el.classList.contains('active')?'page':'false');
    });
  }
  function currentIndex(items,target){
    const focused=target&&target.closest?target.closest('.nav-item[data-view]'):null;
    if(focused){const i=items.indexOf(focused);if(i>=0)return i}
    const active=items.findIndex(function(el){return el.classList.contains('active')});
    return active>=0?active:0;
  }
  function activate(item,items){
    if(!item)return;
    items.forEach(function(el){el.tabIndex=el===item?0:-1;el.setAttribute('aria-current',el===item?'page':'false')});
    item.focus({preventScroll:true});
    item.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});
    /* Use the application's existing click route so the exact corresponding right-pane view is rendered. */
    item.click();
    requestAnimationFrame(function(){
      const main=document.getElementById('main');
      if(main)main.scrollTop=0;
      prepare();
    });
  }
  document.addEventListener('keydown',function(e){
    if(e.defaultPrevented||e.altKey||e.metaKey||e.ctrlKey)return;
    if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;
    const cppa=document.getElementById('view-commercialppa');
    if(cppa&&cppa.classList.contains('active')&&window.__cppaRankingKeyboardScope)return;
    const s=sidebar();
    if(!s||!(e.target instanceof Element)||!s.contains(e.target))return;
    const items=navItems();
    if(!items.length)return;
    const i=currentIndex(items,e.target);
    const next=Math.max(0,Math.min(items.length-1,i+(e.key==='ArrowDown'?1:-1)));
    e.preventDefault();
    e.stopImmediatePropagation();
    if(next!==i)activate(items[next],items);
  },true);
  document.addEventListener('click',function(e){
    const item=e.target&&e.target.closest?e.target.closest('#sidebar .nav-item[data-view]'):null;
    if(!item)return;
    requestAnimationFrame(prepare);
  },true);
  function start(){
    prepare();
    const s=sidebar();
    if(!s)return;
    s.addEventListener('focusin',prepare);
    new window.__APMSafeMutationObserver(prepare).observe(s,{subtree:true,attributes:true,attributeFilter:['class','style','hidden']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
