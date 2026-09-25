
(function(){
  function normalize(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'')}
  function releaseFocus(view){
    window.AIP_SELECTED_ASSET_CONTEXT=null;
    if(!view)return;
    view.classList.remove('ax-asset-filter-active');
    view.querySelectorAll('tbody tr').forEach(row=>{
      row.style.removeProperty('display');
      row.classList.remove('ax-forced-match','ax-focus-settled');
    });
    view.querySelectorAll('.ai3-grid,.xi-kpis,.ai3-kpis,.ops-kpis,.vision-kpis,.chart-wrap,.charts-grid').forEach(el=>el.style.removeProperty('display'));
    view.querySelectorAll('.ax-context-banner,.ax-context-empty,.ax-forced-record,.ax-exact-drill-overlay').forEach(x=>x.remove());
    const head=view.querySelector('.view-head,.page-header,.xi-head,.ai3-head');
    if(head)head.scrollIntoView({behavior:'smooth',block:'start'});
  }
  document.addEventListener('click',function(e){
    const release=e.target.closest('.ax-release-focus');
    if(release){
      e.preventDefault();e.stopPropagation();
      releaseFocus(release.closest('[id^="view-"]'));
      return;
    }
    if(!e.target.closest('.ax-capability'))return;
    // The main drill-down routine performs the filtering. This listener only
    // adds a non-locking fallback after the destination has rendered.
    setTimeout(()=>{
      const c=window.AIP_SELECTED_ASSET_CONTEXT;
      if(!c)return;
      const view=document.getElementById('view-'+c.target);
      if(!view)return;
      const banner=view.querySelector('.ax-context-banner');
      if(banner&&!banner.querySelector('.ax-release-focus')){
        const b=document.createElement('button');b.type='button';b.className='ax-release-focus';b.textContent='Show all records';banner.appendChild(b);
      }
    },900);
  },true);
})();
