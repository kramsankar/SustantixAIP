
(function(){
  window.msi603Filter=(inp,key)=>{const q=String(inp.value||'').trim().toLowerCase(),tb=document.querySelector(`[data-msi603-table=\"${key}\"]`);if(!tb)return;tb.querySelectorAll('tbody tr').forEach(tr=>tr.style.display=!q||tr.textContent.toLowerCase().includes(q)?'':'none')};
 function install(){
    const main=document.getElementById('main');
    if(!main||main.dataset.scrollStability==='1')return;
    main.dataset.scrollStability='1';
    let idleTimer=0;
    const markScrolling=()=>{
      window.__aipMainScrollActive=true;
      clearTimeout(idleTimer);
      idleTimer=setTimeout(()=>{
        window.__aipMainScrollActive=false;
        requestAnimationFrame(()=>{
          try{window.enhanceAllKPIs?.(document.querySelector('.view.active')||main)}catch(e){}
        });
      },180);
    };
    main.addEventListener('scroll',markScrolling,{passive:true});

    const nearVerticalScrollbar=e=>{
      const r=main.getBoundingClientRect();
      const gutter=Math.max(14,main.offsetWidth-main.clientWidth+5);
      return e.clientX>=r.right-gutter&&e.clientX<=r.right+2&&e.clientY>=r.top&&e.clientY<=r.bottom;
    };
    const start=e=>{
      if(!nearVerticalScrollbar(e))return;
      window.__aipScrollbarDragActive=true;
      window.__aipMainScrollActive=true;
      if(document.getElementById('view-commercialppa')?.classList.contains('active')&&window.__cppaRankingKeyboardScope){
        window.__cppaRankingKeyboardScope=true;
      }
      main.classList.add('aip-native-scrollbar-dragging');
    };
    const stop=()=>{
      if(!window.__aipScrollbarDragActive)return;
      window.__aipScrollbarDragActive=false;
      main.classList.remove('aip-native-scrollbar-dragging');
      clearTimeout(idleTimer);
      idleTimer=setTimeout(()=>{window.__aipMainScrollActive=false},120);
    };
    document.addEventListener('pointerdown',start,true);
    document.addEventListener('mousedown',start,true);
    document.addEventListener('pointerup',stop,true);
    document.addEventListener('mouseup',stop,true);
    window.addEventListener('blur',stop);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
