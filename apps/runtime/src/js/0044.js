
(function(){
  const D={last:null,running:false,timer:null,errors:[],originalConsoleError:console.error.bind(console)};
  const labels=()=>{const out={};document.querySelectorAll('.nav-item[data-view]').forEach(n=>{out[n.dataset.view]=(n.childNodes[n.childNodes.length-1]?.textContent||n.textContent||n.dataset.view).replace(/\s+/g,' ').trim().replace(/[–—\d]+$/,'').trim()||n.dataset.view});return out};
  const source=()=>String(window.APM_DATA_MODE||'Current data source').replace(/^Demo data$/i,'Synthetic Data').replace(/^Excel demo data$/i,'Bundled Excel Demo Data');
  function isAuthenticated(){try{return sessionStorage.getItem('eam_logged_in')==='1' && document.getElementById('loginScreen')?.style.display==='none'}catch(e){return false}}
  function setup(){
    if(!isAuthenticated())return;
    const anchor=document.getElementById('resetDemoBtn'); if(!anchor||document.getElementById('aipRefreshChip'))return;
    const chip=document.createElement('button');chip.id='aipRefreshChip';chip.className='ok';chip.setAttribute('aria-label','Data refresh status');chip.title='Data refresh status';anchor.insertAdjacentElement('afterend',chip);
    chip.onclick=()=>document.getElementById('aipRefreshPanel').classList.toggle('open');
    document.getElementById('aipPanelClose').onclick=()=>document.getElementById('aipRefreshPanel').classList.remove('open');
  }
  function wait(ms){return new Promise(r=>setTimeout(r,ms))}
  function validateExistingView(view,el,errors){
    if(!el)return 'Screen container not found.';
    const explicit=el.querySelector('.render-error,.chart-error,.error-state,[data-refresh-error="true"]');
    if(explicit)return (explicit.textContent||'Explicit refresh error').trim().slice(0,220);
    const relevant=errors.find(e=>e.view===view);if(relevant)return relevant.message;
    const canvases=[...el.querySelectorAll('canvas')];
    const bad=canvases.find(c=>c.width===0||c.height===0);if(bad)return 'A chart canvas has zero dimensions.';
    return '';
  }
  function renderResult(result){
    setup();D.last=result;const chip=document.getElementById('aipRefreshChip');if(!chip)return;
    chip.className=result.failures.length?'error':'ok';
    chip.title=result.failures.length?`${result.failures.length} refresh failure${result.failures.length===1?'':'s'}. Click for details.`:`Data refreshed successfully at ${result.time}`;
    document.getElementById('aipPanelSource').textContent=result.source;
    document.getElementById('aipPanelMeta').innerHTML=`Refreshed: ${result.time}<br>Validation time: ${result.duration} ms`;
    document.getElementById('aipPanelSummary').textContent=result.failures.length?`${result.successes.length} of ${result.total} screens verified. ${result.failures.length} failure${result.failures.length===1?'':'s'} detected.`:`All ${result.total} registered screens verified successfully.`;
    const fails=document.getElementById('aipPanelFailures');fails.innerHTML='';
    result.failures.forEach(f=>{const b=document.createElement('button');b.className='aip-failure';b.innerHTML=`✕ ${f.label}<small>${f.reason}</small>`;b.onclick=()=>{document.getElementById('aipRefreshPanel').classList.remove('open');window.activate?.(f.view,true);setTimeout(()=>{const el=document.getElementById('view-'+f.view);el?.classList.add('aip-refresh-highlight');setTimeout(()=>el?.classList.remove('aip-refresh-highlight'),3300)},150)};fails.appendChild(b)});
    document.getElementById('aipPanelSuccess').innerHTML=result.successes.map(x=>`<div>✓ ${x.label}</div>`).join('');
  }
  async function run(reason){
    if(!isAuthenticated()||D.running)return;setup();D.running=true;D.errors=[];
    const start=performance.now(),chip=document.getElementById('aipRefreshChip');if(chip){chip.className='busy';chip.title='Refreshing data…'}
    const oldErr=console.error;console.error=function(){const msg=[...arguments].map(x=>x instanceof Error?x.message:String(x)).join(' ');D.errors.push({view:window.activeViewName||document.querySelector('.view.active[id^="view-"]')?.id.replace('view-',''),message:msg.slice(0,240)});D.originalConsoleError(...arguments)};
    try{
      await wait(180);
      const map=labels(),views=[...new Set([...document.querySelectorAll('.nav-item[data-view]')].map(n=>n.dataset.view))],successes=[],failures=[];
      const originalView=document.querySelector('.view.active[id^="view-"]')?.id.replace('view-','')||'overview';
      const originalScroll=window.scrollY||document.documentElement.scrollTop||0;
      const main=document.getElementById('main');
      const historySnapshot=Array.isArray(window.aipNavigationHistory)?window.aipNavigationHistory.slice():null;
      let freeze=null;
      try{
        const active=document.getElementById('view-'+originalView);
        if(active&&main){
          freeze=document.createElement('div');
          freeze.id='aipValidationFreeze';
          const r=main.getBoundingClientRect();
          freeze.style.cssText=`position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;overflow:hidden;background:#fff;z-index:99990;pointer-events:none`;
          const clone=active.cloneNode(true);clone.classList.add('active');clone.style.cssText='display:block!important;position:absolute;inset:0;overflow:hidden;background:#fff';
          freeze.appendChild(clone);document.body.appendChild(freeze);
        }
        window.__aipSilentValidation=true;
        for(const view of views){
          try{
            if(typeof window.activate==='function') window.activate(view,true);
            else document.querySelector('.nav-item[data-view="'+CSS.escape(view)+'"]')?.click();
            await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
            await wait(65);
            try{window.resizeView?.(view)}catch(_){ }
            await wait(35);
            const el=document.getElementById('view-'+view),failure=validateExistingView(view,el,D.errors);
            if(failure)failures.push({view,label:map[view]||view,reason:failure});else successes.push({view,label:map[view]||view});
          }catch(viewError){
            failures.push({view,label:map[view]||view,reason:(viewError?.message||String(viewError)).slice(0,220)});
          }
        }
      }finally{
        const restoreTo=window.__aipUserOverrideView||originalView;
        const userNavigated=!!window.__aipUserOverrideView;
        window.__aipUserOverrideView=null;
        try{if(typeof window.activate==='function')window.activate(restoreTo,true);else document.querySelector('.nav-item[data-view="'+CSS.escape(restoreTo)+'"]')?.click()}catch(_){ }
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        if(!userNavigated) window.scrollTo({top:originalScroll,left:0,behavior:'auto'});
        if(historySnapshot&&Array.isArray(window.aipNavigationHistory)){window.aipNavigationHistory.splice(0,window.aipNavigationHistory.length,...historySnapshot)}
        window.__aipSilentValidation=false;
        freeze?.remove();
      }
      renderResult({source:source(),time:new Date().toLocaleString(),duration:Math.round(performance.now()-start),total:views.length,successes,failures,reason:reason||'data-source switch'});
    }catch(e){
      renderResult({source:source(),time:new Date().toLocaleString(),duration:Math.round(performance.now()-start),total:1,successes:[],failures:[{view:document.querySelector('.view.active[id^="view-"]')?.id.replace('view-','')||'overview',label:'Current screen',reason:e.message||String(e)}]});
    }finally{console.error=oldErr;D.running=false}
  }
  function schedule(reason){clearTimeout(D.timer);if(!isAuthenticated())return;setup();const chip=document.getElementById('aipRefreshChip');if(chip){chip.className='busy';chip.title='Refreshing data…'}D.timer=setTimeout(()=>{if(isAuthenticated())run(reason)},120)}
  window.AIPRefreshDiagnostics={run,schedule,getLastResult:()=>D.last};
  document.addEventListener('apm:datasource-refreshed',()=>{setup();const chip=document.getElementById('aipRefreshChip');if(chip){chip.className='ok';chip.title='Data source updated';}});
  document.addEventListener('aip:login-complete',()=>setup());
  document.addEventListener('DOMContentLoaded',()=>{if(isAuthenticated())setup()});
  if(document.readyState!=='loading'&&isAuthenticated())setup();
})();
