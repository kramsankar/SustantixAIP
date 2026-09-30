
(function(){
  'use strict';

  let selectedIndex = -1;
  let armed = false;

  function activeView(){
    const v=document.getElementById('view-decisionintelligence');
    const s=window.AIP_DI_V401_STATE;
    if(!v||!v.classList.contains('active')||!s||s.tab!=='overview')return null;
    return v;
  }

  function getRows(){
    const v=activeView();
    return v ? [...v.querySelectorAll('#di401Rows tr')] : [];
  }

  function selectRow(index, doScroll=true){
    const rows=getRows();
    if(!rows.length)return;

    selectedIndex=Math.max(0,Math.min(index,rows.length-1));
    rows.forEach((r,i)=>r.classList.toggle('di417-selected-row',i===selectedIndex));

    if(doScroll){
      rows[selectedIndex].scrollIntoView({
        block:'nearest',
        inline:'nearest',
        behavior:'smooth'
      });
    }
    armed=true;
  }

  // Arm row navigation whenever the user clicks/taps any body row.
  window.addEventListener('pointerdown',function(e){
    const v=activeView();
    if(!v){armed=false;selectedIndex=-1;return;}

    const row=e.target?.closest?.('#di401Rows tr');
    if(row){
      const rows=getRows();
      selectRow(rows.indexOf(row),false);
      return;
    }

    // Clicking elsewhere in Decision Intelligence releases row-arrow ownership.
    if(!e.target?.closest?.('.di401-table-wrap')){
      armed=false;
      selectedIndex=-1;
      getRows().forEach(r=>r.classList.remove('di417-selected-row'));
    }
  },true);

  // Own Up/Down at the WINDOW capture phase, before document/global handlers.
  window.addEventListener('keydown',function(e){
    if(e.key!=='ArrowDown' && e.key!=='ArrowUp')return;
    if(!armed || !activeView())return;

    const rows=getRows();
    if(!rows.length)return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if(selectedIndex<0)selectedIndex=0;
    if(e.key==='ArrowDown')selectRow(selectedIndex+1,true);
    else selectRow(selectedIndex-1,true);
  },true);

  window.AIPDecisionOverviewRowNavV417={
    reset:function(){
      armed=false;
      selectedIndex=-1;
      getRows().forEach(r=>r.classList.remove('di417-selected-row'));
    }
  };
})();
