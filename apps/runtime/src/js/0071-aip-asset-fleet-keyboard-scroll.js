
(function(){
  'use strict';

  let cursorKey='';
  let keyboardActive=false;
  let lastPointerX=-1;
  let lastPointerY=-1;

  function view(){return document.getElementById('view-assetexplorer')}
  function fleet(){return view()?.querySelector('.ax-sites')||null}
  function rows(){
    const box=fleet();
    if(!box)return [];
    return [...box.querySelectorAll('.ax-asset')].filter(row=>{
      const r=row.getBoundingClientRect(),s=getComputedStyle(row);
      return r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
    });
  }
  function keyFor(row){return String(row?.dataset.axId||'').trim()}
  function rowForKey(key){return rows().find(r=>keyFor(r)===key)||null}
  function clearCursor(){rows().forEach(r=>r.classList.remove('aip-key-cursor'))}
  function mark(row,focus=true){
    const box=fleet(); if(!box||!row)return;
    clearCursor();
    row.classList.add('aip-key-cursor');
    cursorKey=keyFor(row);
    keyboardActive=true;
    box.classList.add('aip-keyboard-mode');
    if(focus)row.focus({preventScroll:true});
    const top=row.offsetTop,bottom=top+row.offsetHeight;
    if(top<box.scrollTop)box.scrollTop=top;
    else if(bottom>box.scrollTop+box.clientHeight)box.scrollTop=bottom-box.clientHeight;
  }
  function pointerRow(){
    const box=fleet(); if(!box||lastPointerX<0)return null;
    const el=document.elementFromPoint(lastPointerX,lastPointerY);
    const row=el?.closest?.('.ax-asset');
    return row&&box.contains(row)?row:null;
  }
  function initialRow(){
    return rowForKey(cursorKey)||pointerRow()||document.activeElement?.closest?.('.ax-asset')||rows().find(r=>r.classList.contains('active'))||rows()[0]||null;
  }
  function commitRow(row){
    if(!row)return;
    const key=keyFor(row);
    if(!key)return;
    cursorKey=key;
    /*
      Keyboard navigation must use the same authoritative state controller as
      the working pointer path. A synthetic row.click() re-entered legacy row
      wrappers and could move focus without committing the selected asset.
    */
    const ctl=window.AIPAssetExplorerController;
    const committed=!!(ctl&&typeof ctl.selectAsset==='function'&&ctl.selectAsset(key));
    if(!committed&&typeof window.AIPSelectAssetExplorerAsset==='function'){
      window.AIPSelectAssetExplorerAsset(key);
    }
    [0,35,90,160].forEach(delay=>setTimeout(()=>{
      const refreshed=rowForKey(key);
      if(refreshed)mark(refreshed,true);
    },delay));
  }
  function move(delta){
    const list=rows(); if(!list.length)return;
    let current=rowForKey(cursorKey);
    if(!current){current=initialRow(); if(current)cursorKey=keyFor(current)}
    let i=list.indexOf(current); if(i<0)i=0;
    i=Math.max(0,Math.min(list.length-1,i+delta));
    commitRow(list[i]);
  }
  function activateCursor(){
    commitRow(rowForKey(cursorKey));
  }
  function consume(e){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()}

  window.addEventListener('pointermove',e=>{
    const box=fleet();
    lastPointerX=e.clientX;lastPointerY=e.clientY;
    if(!box||!box.contains(e.target))return;
    if(keyboardActive){
      keyboardActive=false;
      box.classList.remove('aip-keyboard-mode');
      clearCursor();
      const row=e.target.closest('.ax-asset');
      if(row)cursorKey=keyFor(row);
    }
  },true);

  window.addEventListener('keydown',e=>{
    const root=view(),box=fleet();
    if(!root||!root.classList.contains('active')||!box)return;
    const insideFocus=e.target===box||box.contains(e.target)||box.contains(document.activeElement);
    const pr=pointerRow();
    const insidePointer=!!pr;
    if(!insideFocus&&!insidePointer&&!keyboardActive)return;

    if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End','Enter',' '].includes(e.key))consume(e);else return;
    const main=document.getElementById('main')||document.scrollingElement;
    const pageTop=main?main.scrollTop:0;

    if(!keyboardActive){
      const anchor=pr||initialRow();
      if(anchor)mark(anchor,false);
    }

    const list=rows();
    if(e.key==='ArrowDown')move(1);
    else if(e.key==='ArrowUp')move(-1);
    else if(e.key==='PageDown')move(Math.max(1,Math.floor(box.clientHeight/Math.max(1,list[0]?.offsetHeight||1))));
    else if(e.key==='PageUp')move(-Math.max(1,Math.floor(box.clientHeight/Math.max(1,list[0]?.offsetHeight||1))));
    else if(e.key==='Home'&&list[0])commitRow(list[0]);
    else if(e.key==='End'&&list.length)commitRow(list[list.length-1]);
    else if(e.key==='Enter'||e.key===' ')activateCursor();

    if(main){main.scrollTop=pageTop;requestAnimationFrame(()=>{main.scrollTop=pageTop})}
  },true);

  function prepare(){
    const box=fleet();if(!box)return;
    box.tabIndex=0;
    rows().forEach(row=>{
      row.tabIndex=0;
      row.ondblclick=e=>{
        consume(e);
        cursorKey=keyFor(row);
        mark(row,true);
        activateCursor();
      };
      // Do not wrap row.onclick. Repeated wrapping after each render was one of
      // the causes of stale selection. Pointer selection is handled by the
      // authoritative v42 controller; keyboard selection calls it directly.
    });
  }
  let timer=0;
  const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(prepare,60)});
  function boot(){
    prepare();const root=view();if(root)observer.observe(root,{childList:true,subtree:true});
    document.addEventListener('click',e=>{if(e.target.closest('#sidebar .nav-item,.ax-site-title,.ax-asset')){setTimeout(prepare,60);setTimeout(prepare,180)}},true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.AIPAssetFleetKeyboard={refresh:prepare};
})();
