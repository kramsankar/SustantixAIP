
(function(){
  'use strict';
  function cleanRevenueHelp(){
    const parent=document.getElementById('view-revenuecommercial');
    if(!parent)return;
    const active=parent.querySelector(':scope > .aip497-rc-pane.active');
    if(!active)return;

    /* Keep exactly one F1 button in the active Revenue & Commercial child pane. */
    let holder=active.querySelector(':scope > .f1-help-top-right.aip-v378-revenue-help');
    let keep=holder?.querySelector('.f1-btn')||active.querySelector('.f1-btn');
    if(!holder){
      holder=document.createElement('div');
      holder.className='f1-help-top-right aip-v378-revenue-help';
      active.insertBefore(holder,active.firstChild);
    }
    if(!keep){
      keep=document.createElement('button');
      keep.type='button';keep.className='f1-btn';
      keep.innerHTML='<span class="f1-key">F1</span> Help';
    }
    if(keep.parentNode!==holder)holder.appendChild(keep);
    const helpView=active.id==='view-commercialppa'?'commercialppa':'lossintelligence';
    keep.onclick=e=>{e.preventDefault();e.stopPropagation();window.openHelp?.(helpView)};
    keep.dataset.helpView=helpView;
    keep.title='F1 Help';

    /* Remove every other Revenue & Commercial F1 holder/button, including
       any duplicate transient control produced by child renderers. */
    parent.querySelectorAll('.f1-btn').forEach(b=>{if(b!==keep)b.remove()});
    parent.querySelectorAll('.f1-help-top-right').forEach(h=>{
      if(h!==holder && !h.querySelector('.f1-btn'))h.remove();
    });
  }
  document.addEventListener('click',e=>{
    if(e.target.closest?.('#view-revenuecommercial [data-aip497-tab]'))
      requestAnimationFrame(cleanRevenueHelp);
  },true);
  document.addEventListener('aip:data-source-changed',()=>requestAnimationFrame(cleanRevenueHelp),true);
  requestAnimationFrame(cleanRevenueHelp);
  window.AIP_V397_AUDIT={
    release:'v397',baseline:'v396',
    scope:'Revenue & Commercial Intelligence · Loss Intelligence search sizing and F1 deduplication only',
    uiOnly:true,excelChanged:false,syntheticBusinessDataChanged:false,
    changes:[
      'Site Loss Ranking search reduced to 190px width and 25px height with 11px font',
      'Removed wrapper minimum width that made the search control visually oversized',
      'Revenue & Commercial Intelligence active child pane retains exactly one F1 Help control',
      'No table, loss calculation, data, filtering logic or navigation changed'
    ]
  };
})();
