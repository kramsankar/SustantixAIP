
(function(){
  function inHelp(node){
    return !!node.closest('#helpModal,.help-modal,.f1-help-modal,[data-help-content],#f1HelpPanel');
  }

  function cleanVisibleExplanations(root=document){
    const selectors=[
      '.view-sub',
      '.section-note',
      '.panel-title .sub',
      '.view-head .sub',
      '.view-head p',
      '.view-head .description',
      '.view-head .subtitle',
      '.card>.sub',
      '.card>.description'
    ];
    root.querySelectorAll(selectors.join(',')).forEach(el=>{
      if(inHelp(el)) return;
      el.remove();
    });

    // Remove immediate explanatory paragraphs directly under headings.
    root.querySelectorAll('.view h1 + p,.view h2 + p,.view h3 + p').forEach(el=>{
      if(inHelp(el)) return;
      el.remove();
    });

    // Remove empty wrappers left behind.
    root.querySelectorAll('.panel-title>div,.view-head>div').forEach(el=>{
      if(inHelp(el)) return;
      if(!el.textContent.trim() && !el.querySelector('button,canvas,svg,img')) el.remove();
    });
  }

  function normalizeF1Buttons(root=document){
    root.querySelectorAll('.view').forEach(view=>{
      const viewId=(view.id||'').replace(/^view-/,'')||'overview';
      let btn=view.querySelector('.f1-btn');
      if(!btn){
        const head=view.querySelector('.view-head')||view.firstElementChild;
        if(head){
          btn=document.createElement('button');
          btn.className='f1-btn';
          btn.setAttribute('onclick',"openHelp('"+viewId+"')");
          btn.setAttribute('title','F1 Help');
          btn.innerHTML='<span class="f1-key">F1</span> Help';
          head.appendChild(btn);
        }
      }else{
        btn.classList.add('f1-btn');
        btn.setAttribute('title','F1 Help');
        if(!btn.querySelector('.f1-key')){
          btn.innerHTML='<span class="f1-key">F1</span> Help';
        }
        if(!btn.getAttribute('onclick')){
          btn.setAttribute('onclick',"openHelp('"+viewId+"')");
        }
      }
    });
  }

  function setActiveF1(btn){
    document.querySelectorAll('.f1-btn.active').forEach(b=>b.classList.remove('active'));
    if(btn) btn.classList.add('active');
  }

  document.addEventListener('click',function(e){
    const btn=e.target.closest('.f1-btn');
    if(btn){
      setActiveF1(btn);
      return;
    }
    const close=e.target.closest('[data-help-close],.help-close,.modal-close,.close-help');
    if(close){
      document.querySelectorAll('.f1-btn.active').forEach(b=>b.classList.remove('active'));
    }
  },true);

  const originalOpenHelp=window.openHelp;
  window.openHelp=function(){
    const args=arguments;
    const clicked=document.activeElement?.classList?.contains('f1-btn')?document.activeElement:null;
    if(clicked) setActiveF1(clicked);
    let result;
    if(typeof originalOpenHelp==='function') result=originalOpenHelp.apply(this,args);
    setTimeout(()=>{
      const key=String(args[0]||'');
      const btn=[...document.querySelectorAll('.f1-btn')].find(b=>{
        const oc=b.getAttribute('onclick')||'';
        return oc.includes("'"+key+"'")||oc.includes('"'+key+'"');
      });
      if(btn) setActiveF1(btn);
    },0);
    return result;
  };

  function boot(){
    cleanVisibleExplanations();
    normalizeF1Buttons();
    const main=document.getElementById('main')||document.body;
    const observer=new window.__APMSafeMutationObserver(records=>{
      let touched=false;
      for(const rec of records){
        if(rec.addedNodes.length){touched=true;break;}
      }
      if(touched){
        cleanVisibleExplanations(main);
        normalizeF1Buttons(main);
      }
    });
    observer.observe(main,{childList:true,subtree:true});
    window.cleanVisibleExplanations=cleanVisibleExplanations;
    window.normalizeF1Buttons=normalizeF1Buttons;
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();
