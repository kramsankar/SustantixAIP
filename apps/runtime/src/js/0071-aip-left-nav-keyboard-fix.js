
(function(){
  'use strict';

  function groupIsOpen(group){
    if(!group) return true;
    if(group.classList.contains('open')) return true;
    const head = group.querySelector(':scope > .x-nav-head,:scope > [aria-expanded]');
    return head?.getAttribute('aria-expanded') === 'true';
  }

  function orderedVisibleItems(){
    const sidebar = document.getElementById('sidebar');
    if(!sidebar) return [];

    const items = [];
    sidebar.querySelectorAll(':scope > .x-nav-group').forEach(group=>{
      if(!groupIsOpen(group)) return;
      group.querySelectorAll(':scope > .x-nav-body > .nav-item').forEach(item=>{
        if(item.disabled || item.getAttribute('aria-disabled') === 'true') return;
        const cs = getComputedStyle(item);
        if(cs.display === 'none' || cs.visibility === 'hidden') return;
        items.push(item);
      });
    });
    return items;
  }

  function setRoving(items, active){
    items.forEach(item=>item.tabIndex = item === active ? 0 : -1);
  }

  function focusItem(item){
    if(!item) return;
    const items = orderedVisibleItems();
    setRoving(items, item);
    item.focus({preventScroll:true});
    item.scrollIntoView({block:'nearest', inline:'nearest'});
  }

  function move(current, delta, activate){
    const items = orderedVisibleItems();
    if(!items.length) return null;

    let index = items.indexOf(current);
    if(index < 0){
      const active = items.find(x=>x.classList.contains('active'));
      index = Math.max(0, items.indexOf(active));
    }

    const nextIndex = Math.max(0, Math.min(items.length - 1, index + delta));
    const next = items[nextIndex];
    focusItem(next);
    if(activate && next !== current) activateItem(next);
    return next;
  }

  function activateItem(item){
    if(!item) return;
    item.click();

    /*
      Some views, especially Assistant, autofocus an input after rendering.
      Restore focus to the menu item after those render passes so the very
      next Down Arrow continues to Enterprise Context Graph on first use.
    */
    [0,40,120,260].forEach(delay=>{
      setTimeout(()=>{
        if(document.getElementById('sidebar')?.contains(item)){
          focusItem(item);
        }
      },delay);
    });
  }

  function onKeyDown(event){
    const cppa=document.getElementById('view-commercialppa');
    if(cppa&&cppa.classList.contains('active')&&window.__cppaRankingKeyboardScope&&
       (event.key==='ArrowDown'||event.key==='ArrowUp'||event.key==='Home'||event.key==='End')) return;

    const current = event.target.closest('#sidebar .nav-item');
    if(!current) return;

    if(event.key === 'ArrowDown'){
      event.preventDefault();
      event.stopImmediatePropagation();
      move(current,1,true);
      return;
    }

    if(event.key === 'ArrowUp'){
      event.preventDefault();
      event.stopImmediatePropagation();
      move(current,-1,true);
      return;
    }

    if(event.key === 'Home'){
      event.preventDefault();
      event.stopImmediatePropagation();
      focusItem(orderedVisibleItems()[0]);
      return;
    }

    if(event.key === 'End'){
      event.preventDefault();
      event.stopImmediatePropagation();
      const items = orderedVisibleItems();
      focusItem(items[items.length-1]);
      return;
    }

    if(event.key === 'Enter' || event.key === ' '){
      event.preventDefault();
      event.stopImmediatePropagation();
      activateItem(current);
    }
  }

  function initialize(){
    const items = orderedVisibleItems();
    if(!items.length) return;
    const focused = document.activeElement?.closest?.('#sidebar .nav-item');
    const active = focused || items.find(x=>x.classList.contains('active')) || items[0];
    setRoving(items,active);
  }

  document.addEventListener('keydown',onKeyDown,true);

  document.addEventListener('click',event=>{
    const item = event.target.closest('#sidebar .nav-item');
    if(!item) return;
    /*
      Mouse activation should also leave keyboard focus on the selected
      menu item after the destination view finishes rendering.
    */
    [0,50,150].forEach(delay=>setTimeout(()=>focusItem(item),delay));
  },true);

  let timer = 0;
  const observer = new MutationObserver(()=>{
    clearTimeout(timer);
    timer = setTimeout(initialize,60);
  });

  function boot(){
    initialize();
    const sidebar = document.getElementById('sidebar');
    if(sidebar){
      observer.observe(sidebar,{
        childList:true,
        subtree:true,
        attributes:true,
        attributeFilter:['class','style','aria-expanded','disabled','aria-disabled']
      });
    }
    setTimeout(initialize,250);
    setTimeout(initialize,700);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded',boot);
  }else{
    boot();
  }

  function focusActiveAfterLogin(){
    const items = orderedVisibleItems();
    if(!items.length) return;
    const overview = items.find(item=>item.dataset.view === 'overview');
    const active = items.find(item=>item.classList.contains('active')) || overview || items[0];
    focusItem(active);
  }

  document.addEventListener('aip:login-complete',()=>{
    [0,40,120,260,600].forEach(delay=>setTimeout(focusActiveAfterLogin,delay));
  },true);

  /*
    On the very first key press after login, the browser can still report the
    body or a hidden login control as active. Treat Up/Down as navigation from
    the visually active Overview item, then activate the destination pane.
  */
  document.addEventListener('keydown',event=>{
    if(event.key!=='ArrowDown' && event.key!=='ArrowUp') return;

    /* Commercial & PPA Site Exposure Ranking owns Up/Down while focused or hovered. */
    const cppaView=document.getElementById('view-commercialppa');
    const cppaActive=!!(cppaView&&cppaView.classList.contains('active'));
    const cppaFocused=!!(document.activeElement?.closest?.('#view-commercialppa .cppa-rank-row[data-plant]'));
    if(cppaActive&&(cppaFocused||window.__cppaRankingPointerInside||window.__cppaRankingKeyboardScope)) return;

    if(event.target.closest?.('#sidebar .nav-item')) return;
    const login=document.getElementById('loginScreen');
    if(login && getComputedStyle(login).display!=='none' && !login.classList.contains('fade-out')) return;
    const tag=(event.target.tagName||'').toLowerCase();
    if(['input','textarea','select'].includes(tag) || event.target.isContentEditable) return;
    const items=orderedVisibleItems();
    if(!items.length) return;
    const active=items.find(item=>item.classList.contains('active')) || items.find(item=>item.dataset.view==='overview') || items[0];
    event.preventDefault();
    event.stopImmediatePropagation();
    focusItem(active);
    move(active,event.key==='ArrowDown'?1:-1,true);
  },true);

  window.AIPLeftNavKeyboard = {
    refresh:initialize,
    focusActive:focusActiveAfterLogin,
    items:orderedVisibleItems
  };
})();
