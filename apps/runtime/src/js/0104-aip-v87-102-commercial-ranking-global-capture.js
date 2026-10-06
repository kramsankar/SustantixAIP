
(function(){
  document.addEventListener('keydown',function(e){
    if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
    const view=document.getElementById('view-commercialppa');
    if(!view||!view.classList.contains('active')||!window.__cppaRankingKeyboardScope)return;

    const rows=[...view.querySelectorAll('.cppa-rank-row[data-plant]')];
    if(!rows.length)return;
    const selectedRow=rows.find(r=>r.classList.contains('selected'))||rows[0];
    let i=Math.max(0,rows.indexOf(selectedRow)),j=i;
    if(e.key==='ArrowDown')j=Math.min(rows.length-1,i+1);
    else if(e.key==='ArrowUp')j=Math.max(0,i-1);
    else if(e.key==='Home')j=0;
    else if(e.key==='End')j=rows.length-1;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const site=String(rows[j]?.dataset.plant||'');
    if(!site)return;

    /* Use the row's existing click path so all dependent Commercial/PPA panels
       use exactly the same selection logic as a mouse click. */
    if(j!==i || e.key==='Home' || e.key==='End'){
      rows[j].click();
    }else{
      rows[j].focus({preventScroll:true});
      rows[j].scrollIntoView({block:'nearest',inline:'nearest'});
    }
  },true);
})();
