
(function(){
  let started=false;
  async function runDeferredScripts(){
    if(started) return;
    started=true;
    document.body.classList.add('aip-booting');
    const nodes=[...document.querySelectorAll('script[type="application/x-aip-deferred"]')];
    for(const node of nodes){
      await new Promise(resolve=>{
        const script=document.createElement('script');
        const moduleSrc=node.getAttribute('data-aip-src');
        if(moduleSrc){
          script.src=moduleSrc;
          script.onload=()=>resolve();
          script.onerror=()=>{ console.error('AIP module failed to load: '+moduleSrc); resolve(); };
          document.body.appendChild(script);
          return;
        }
        const src=node.getAttribute('data-src');
        if(src){
          script.src=src;
          script.onload=()=>{};
          script.onerror=()=>{ window.__xlsxLoadFailed=true; };
          document.head.appendChild(script);
          resolve();
        }else{
          script.text=node.textContent;
          document.body.appendChild(script);
          resolve();
        }
      });
    }
    // Deferred modules registered DOMContentLoaded hooks after the native event.
    // Replay it once so those modules initialise in their original order.
    document.dispatchEvent(new Event('DOMContentLoaded'));

    // Do not reveal the legacy Overview frame while the current KPI decorators
    // are still replacing it. Wait for the Overview DOM to become quiet after
    // a minimum settling period, with a hard maximum so login can never hang.
    await new Promise(resolve=>{
      const target=document.getElementById('view-overview')||document.getElementById('main');
      const started=performance.now();
      let lastMutation=started;
      let done=false;
      const finish=()=>{
        if(done)return;
        done=true;
        try{observer.disconnect()}catch(_){}
        clearInterval(checker);
        clearTimeout(hardStop);
        resolve();
      };
      const observer=new MutationObserver(()=>{lastMutation=performance.now()});
      if(target)observer.observe(target,{childList:true,subtree:true,attributes:true,characterData:true});
      const checker=setInterval(()=>{
        const now=performance.now();
        const minSettled=now-started>=650;
        const quiet=now-lastMutation>=180;
        const overview=document.getElementById('view-overview');
        const hasContent=!!overview && (overview.textContent||'').trim().length>40;
        if(minSettled&&quiet&&hasContent)finish();
      },50);
      const hardStop=setTimeout(finish,1600);
    });

    try{window.dispatchEvent(new Event('resize'));}catch(_){}
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    // Runtime is ready, but keep the app hidden. The login handoff removes
    // aip-runtime-pending only after the final Overview render is stable.
    window.__aipRuntimeReady=true;
    window.__AIP_V699_TIMING=window.__AIP_V699_TIMING||{navigationStart:0};
    window.__AIP_V699_TIMING.runtimeReadyMs=Math.round(performance.now());
    try{window.dispatchEvent(new CustomEvent('aip:runtime-ready'));}catch(_){try{window.dispatchEvent(new Event('aip:runtime-ready'));}catch(__){}}
    if(typeof window.__finishAIPLogin==='function') window.__finishAIPLogin();
  }
  window.__startAIP=function(){
    window.__AIP_V699_TIMING=window.__AIP_V699_TIMING||{navigationStart:0};
    if(window.__AIP_V699_TIMING.startRequestedMs==null)window.__AIP_V699_TIMING.startRequestedMs=Math.round(performance.now());
    requestAnimationFrame(runDeferredScripts);
  };
  if(window.__aipStartRequested || sessionStorage.getItem('eam_logged_in')==='1'){
    window.__startAIP();
  }else{
    // Keep the login surface completely idle. Dashboard initialization starts
    // only after Sign In, so cursor activation and every keystroke stay immediate.
    window.__aipLoginIdle=true;
  }
})();
