
(function(){
  'use strict';
  function portalize(){
    const drawer=document.getElementById('opsDetail');
    const backdrop=document.getElementById('aipWoBackdrop');
    if(backdrop && backdrop.parentElement!==document.body) document.body.appendChild(backdrop);
    if(drawer && drawer.parentElement!==document.body) document.body.appendChild(drawer);
    if(backdrop && drawer && backdrop.nextElementSibling!==drawer) document.body.insertBefore(backdrop,drawer);
  }
  function enableFields(drawer){
    if(!drawer) return;
    drawer.removeAttribute('inert');
    drawer.setAttribute('aria-hidden','false');
    drawer.querySelectorAll('input,textarea,select,button').forEach(el=>{
      el.removeAttribute('inert');
      if(el.matches('input,textarea,select')){
        el.readOnly=false;
        if(el.dataset.aipKeepDisabled!=='true') el.disabled=false;
      }
      el.style.pointerEvents='auto';
    });
  }
  function hardOpen(id){
    portalize();
    const drawer=document.getElementById('opsDetail');
    const backdrop=document.getElementById('aipWoBackdrop');
    drawer?.classList.add('open');
    backdrop?.classList.add('open');
    document.body.classList.add('aip-wo-open');
    enableFields(drawer);
    requestAnimationFrame(()=>{
      portalize();
      enableFields(drawer);
      const preferred=drawer?.querySelector('.aip-wo-form input:not([type="hidden"]),.aip-wo-form textarea,.aip-wo-form select');
      (preferred||drawer?.querySelector('button,input,textarea,select'))?.focus({preventScroll:true});
    });
  }
  const previousOpen=window.opsOpenWO;
  window.opsOpenWO=function(id){
    if(typeof previousOpen==='function') previousOpen(id);
    hardOpen(id);
  };
  const previousCreate=window.opsCreateWO;
  window.opsCreateWO=function(){
    if(typeof previousCreate==='function') previousCreate();
    requestAnimationFrame(()=>hardOpen(window.AIP_WO_UI?.id||window.AIP_WO_CREATE_SOURCE));
  };
  document.addEventListener('click',function(e){
    const drawer=e.target.closest?.('#opsDetail');
    if(drawer){
      e.stopPropagation();
      enableFields(drawer);
    }
  },true);
  document.addEventListener('focusin',function(e){
    if(e.target.closest?.('#opsDetail')){
      const drawer=document.getElementById('opsDetail');
      enableFields(drawer);
    }
  },true);
  document.addEventListener('DOMContentLoaded',portalize,{once:true});
})();
