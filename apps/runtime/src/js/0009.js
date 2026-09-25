
(function(){
  const screen=document.getElementById('loginScreen');
  const user=document.getElementById('loginUser');
  const pass=document.getElementById('loginPass');
  const btn=document.getElementById('loginBtn');
  const err=document.getElementById('loginError');
  const status=document.getElementById('loginStatus');
  const eye=document.getElementById('passEye');
  if(!screen||!user||!pass||!btn) return;
  window.__loginBound=true;
  function setVisible(v){pass.type=v?'text':'password';if(eye){eye.dataset.visible=String(v);eye.setAttribute('aria-pressed',String(v));eye.setAttribute('aria-label',v?'Hide password':'Show password');}}
  let loginInProgress=false;
  async function login(){
    if(loginInProgress) return;
    let hostAuthorised=false;
    try{ hostAuthorised=!!(window.AIPHost && await window.AIPHost.signIn(user.value.trim(), pass.value)); }catch(_){ hostAuthorised=false; }
    if(hostAuthorised){
      loginInProgress=true;
      try{sessionStorage.setItem('eam_logged_in','1')}catch(e){}
      // Remove focus from credential controls immediately so the browser cannot
      // display password-manager, blocked-control, or invalid-action indicators.
      try{user.blur();pass.blur();btn.blur();}catch(e){}
      screen.classList.add('login-preparing');
      screen.setAttribute('aria-busy','true');
      btn.disabled=false;
      btn.setAttribute('aria-disabled','true');
      btn.textContent='Sign In';
      if(status) status.classList.add('show');
      const loginShownAt=performance.now();
      window.__finishAIPLogin=()=>{
        if(screen.dataset.loginFinished==='1' || screen.dataset.loginSettling==='1') return;
        screen.dataset.loginSettling='1';

        // Keep the application fully hidden until the FINAL Overview DOM has
        // stopped changing. This prevents the legacy/initial Overview frame from
        // flashing between the login overlay and the finished dashboard.
        const app=document.getElementById('app');
        if(app) app.classList.add('aip-runtime-pending');
        document.body.classList.add('aip-booting');

        const target=document.getElementById('view-overview')||document.getElementById('main');
        const startedAt=performance.now();
        let lastChange=startedAt;
        let finished=false;
        const observer=new MutationObserver(()=>{lastChange=performance.now()});
        try{if(target)observer.observe(target,{childList:true,subtree:true,attributes:true,characterData:true})}catch(_){}

        const revealFinalOverview=()=>{
          if(finished || screen.dataset.loginFinished==='1') return;
          finished=true;
          try{observer.disconnect()}catch(_){}
          clearInterval(checker);
          clearTimeout(hardStop);

          // Force the final first screen and menu state before anything is shown.
          document.querySelectorAll('#main .view').forEach(v=>v.classList.toggle('active',v.id==='view-overview'));
          document.querySelectorAll('#sidebar .nav-item[data-view]').forEach(n=>n.classList.toggle('active',n.dataset.view==='overview'));
          try{window.dispatchEvent(new Event('resize'))}catch(_){}
          document.dispatchEvent(new CustomEvent('aip:pre-reveal-layout'));

          requestAnimationFrame(()=>requestAnimationFrame(()=>{
            if(app) app.classList.remove('aip-runtime-pending');
            document.body.classList.remove('aip-booting');
            screen.dataset.loginFinished='1';
            window.__AIP_V699_TIMING=window.__AIP_V699_TIMING||{navigationStart:0};
          window.__AIP_V699_TIMING.firstUsableOverviewMs=Math.round(performance.now());
          window.__AIP_V699_TIMING.startupAfterRequestMs=window.__AIP_V699_TIMING.startRequestedMs==null?null:(window.__AIP_V699_TIMING.firstUsableOverviewMs-window.__AIP_V699_TIMING.startRequestedMs);
          screen.classList.add('fade-out');
            setTimeout(()=>{
              screen.style.display='none';
              document.dispatchEvent(new CustomEvent('aip:layout-ready'));
              document.dispatchEvent(new CustomEvent('aip:login-complete'));
            },55);
          }));
        };

        const checker=setInterval(()=>{
          const now=performance.now();
          const overview=document.getElementById('view-overview');
          const hasFinalContent=!!overview && (overview.textContent||'').trim().length>80;
          const minimumPainted=now-startedAt>=700;
          const quiet=now-lastChange>=300;
          if(hasFinalContent && minimumPainted && quiet) revealFinalOverview();
        },50);
        const hardStop=setTimeout(revealFinalOverview,2600);
      };
      // Give the browser two paint opportunities before any heavy synchronous
      // dashboard initialization begins. This makes the status and spinner visible.
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        if(window.__aipRuntimeReady) window.__finishAIPLogin();
        else if(typeof window.__startAIP==='function') window.__startAIP();
        else window.__aipStartRequested=true;
      }));
    }else{if(err)err.classList.add('show');pass.value='';setVisible(false);pass.focus();}
  }
  btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();login();});
  // Capture Enter before any browser/default or legacy handler can process it.
  screen.addEventListener('keydown',e=>{
    if(e.key!=='Enter') return;
    e.preventDefault();
    e.stopPropagation();
    if(typeof e.stopImmediatePropagation==='function') e.stopImmediatePropagation();
    if(loginInProgress) return;
    if(e.target===user){pass.focus();return;}
    login();
  },true);
  if(eye)eye.addEventListener('click',e=>{e.preventDefault();setVisible(pass.type==='password');pass.focus()});
  setVisible(false);
  // Focus immediately. No delayed timer and no background work may compete with the first click or keystroke.
  try{user.focus({preventScroll:true});}catch(_){user.focus();}
})();
