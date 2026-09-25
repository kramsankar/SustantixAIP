
window.planScheduleSyncScrollSafe=function(el,source){
  const card=el && el.closest ? el.closest('.po-sched176-card') : document.querySelector('.po-sched176-card');
  if(!card)return;
  const top=card.querySelector('.po-sched193-topbar');
  const bottom=card.querySelector('.po-sched193-bottomscroll');
  const axis=card.querySelector('.po-sched193-axis');
  const x=Math.max(0,Math.round(el.scrollLeft||0));

  if(source==='top' && bottom && Math.abs(bottom.scrollLeft-x)>0.5){
    bottom.scrollLeft=x;
  }
  if(source==='bottom' && top && Math.abs(top.scrollLeft-x)>0.5){
    top.scrollLeft=x;
  }
  if(axis){
    axis.style.marginLeft=(-x)+'px';
  }
};

window.planScheduleResetScroll=function(){
  requestAnimationFrame(function(){
    const card=document.querySelector('.po-sched176-card');
    if(!card)return;
    const top=card.querySelector('.po-sched193-topbar');
    const bottom=card.querySelector('.po-sched193-bottomscroll');
    const axis=card.querySelector('.po-sched193-axis');
    if(top)top.scrollLeft=0;
    if(bottom)bottom.scrollLeft=0;
    if(axis)axis.style.marginLeft='0px';
  });
};
