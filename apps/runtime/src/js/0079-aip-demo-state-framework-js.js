
(function(){
'use strict';
const STORE='aip_demo_session_v2';
const ACTIONS=[['prediction','Prediction','Accept recommendation'],['rootcause','Root Cause','Close investigation'],['workorder','Work Order','Approve and queue'],['scenario','Scenario','Approve scenario'],['warranty','Warranty','Submit claim'],['vision','AI Vision','Accept finding']];
let memoryState={},busy=false;
function mode(){const t=((window.APM_DATA_MODE||window.DATA_SOURCE_MODE||window.dataMode||window.currentDataSource||'')+' '+(document.querySelector('.data-source-toggle .active,.source-toggle .active')?.textContent||'')).toLowerCase();return /excel|bundled|upload/.test(t)?'excel':'synthetic'}
function load(){try{return JSON.parse(sessionStorage.getItem(STORE)||'{}')}catch(e){return memoryState}}
function save(v){memoryState=v;try{sessionStorage.setItem(STORE,JSON.stringify(v))}catch(e){}}
function bucket(){const all=load(),m=mode();all[m]=all[m]||{assets:{},modified:0};return [all,all[m]]}
function selectedId(){return document.querySelector('#view-assetexplorer .ax-asset.active')?.dataset.axId||document.querySelector('#view-assetexplorer .ax-asset.aip-key-cursor')?.dataset.axId||''}
function showcaseRows(){return [...document.querySelectorAll('#view-assetexplorer .ax-asset')].slice(0,24)}
function signalProfile(id){const n=showcaseRows().findIndex(r=>r.dataset.axId===id);if(n<0)return {active:[],critical:[]};const order=ACTIONS.map(x=>x[0]),count=3+(n%4),start=n%order.length,active=[];for(let i=0;i<count;i++)active.push(order[(start+i)%order.length]);const critical=[];if(n%5===0)critical.push(active[0]);if(n%7===0&&active[1])critical.push(active[1]);return {active:[...new Set(active)],critical:[...new Set(critical)]}}
function assetState(id){const [all,b]=bucket();b.assets[id]=b.assets[id]||{actions:{}};return [all,b,b.assets[id]]}
function unresolved(id){const p=signalProfile(id),a=assetState(id)[2].actions||{};return {active:p.active.filter(k=>!a[k]),critical:p.critical.filter(k=>!a[k])}}
function level(id){const u=unresolved(id);if(u.critical.length||u.active.length>=4)return'immediate';if(u.active.length)return'attention';return'normal'}
function label(l){return l==='immediate'?'Immediate Action':l==='attention'?'Attention':''}
function modifiedCount(){return bucket()[1].modified||0}
function showToast(msg){let t=document.getElementById('aipDemoToast');if(!t){t=document.createElement('div');t.id='aipDemoToast';t.className='aip-demo-toast';document.body.appendChild(t)}t.textContent=msg;t.classList.add('show');clearTimeout(window.__aipDemoToastTimer);window.__aipDemoToastTimer=setTimeout(()=>t.classList.remove('show'),1800)}
function refreshSelected(){decorate();document.dispatchEvent(new CustomEvent('aip:demo-state-changed',{detail:{mode:mode(),assetId:selectedId()}}));try{if(typeof window.renderAssetExplorer==='function')window.renderAssetExplorer();else if(typeof window.refreshAssetExplorer==='function')window.refreshAssetExplorer();else if(typeof window.updateAssetExplorer==='function')window.updateAssetExplorer()}catch(e){}setTimeout(decorate,50)}
function commit(id,key,value=true){const [all,b,a]=assetState(id);if(Boolean(a.actions[key])!==value){a.actions[key]=value;b.modified=(b.modified||0)+1;save(all)}refreshSelected()}
function resetAsset(id){if(!id){showToast('Select an asset first');return}const [all,b]=bucket();delete b.assets[id];b.modified=(b.modified||0)+1;save(all);refreshSelected();showToast('Selected asset restored to original baseline')}
function resetMode(btn){const m=mode(),all=load();all[m]={assets:{},modified:0};save(all);if(btn){btn.disabled=true;btn.textContent='Resetting…';btn.classList.add('is-resetting')}decorateRows();decorateSummary();decorateToolbar();document.dispatchEvent(new CustomEvent('aip:demo-state-changed',{detail:{mode:m,assetId:selectedId(),reset:true}}));setTimeout(()=>{decorate();showToast((m==='excel'?'Excel':'Synthetic')+' demo session restored')},40)}
function resetAll(){memoryState={};try{sessionStorage.removeItem(STORE)}catch(e){}refreshSelected();showToast((mode()==='excel'?'Excel':'Synthetic')+' baseline restored')}
function decorateRows(){const show=new Set(showcaseRows().map(r=>r.dataset.axId));document.querySelectorAll('#view-assetexplorer .ax-asset').forEach(r=>{const isShow=show.has(r.dataset.axId);r.classList.toggle('aip-showcase',isShow);const l=isShow?level(r.dataset.axId):'normal';const text=l==='normal'?'':label(l);const u=l==='normal'?null:unresolved(r.dataset.axId);const title=u?'AI Action: '+text+' · '+u.active.length+' unresolved governed signal'+(u.active.length===1?'':'s'):'';let b=r.querySelector('.aip-attention');if(!text){if(b)b.remove();return}if(!b){b=document.createElement('span');b.className='aip-attention';r.appendChild(b)}b.className='aip-attention '+l;if(b.textContent!==text)b.textContent=text;if(b.title!==title)b.title=title;if(b.getAttribute('aria-label')!==title)b.setAttribute('aria-label',title)})}
function decorateToolbar(){
 const head=document.querySelector('#view-assetexplorer .ax-tree-head');if(!head)return;
 document.querySelectorAll('#view-assetexplorer .aip-demo-statebar').forEach(x=>x.remove());
 const sites=document.querySelector('#view-assetexplorer .ax-sites');
 if(sites){
   document.querySelectorAll('#view-assetexplorer .aip-showcase-note').forEach(x=>x.remove());
   const keys=[...document.querySelectorAll('#view-assetexplorer .aip-status-key')];
   keys.slice(1).forEach(x=>x.remove());
   if(!keys.length)sites.insertAdjacentHTML('beforebegin','<div class="aip-status-key"><span>Asset Condition</span><span>Asset Code / Name</span><span>AI Action</span></div>');
 }
}
function decorateSummary(){const card=[...document.querySelectorAll('#view-assetexplorer .ax-card.ax-ai')][0];if(!card)return;card.querySelectorAll('.aip-asset-restore,.aip-action-panel').forEach(x=>x.remove())}
function decorate(){if(busy)return;busy=true;try{decorateRows();decorateToolbar();decorateSummary()}finally{busy=false}}
function handle(e){const btn=e.target.closest('#view-assetexplorer [data-demo-restore-asset],#view-assetexplorer [data-demo-reset-session],#view-assetexplorer [data-demo-action]');if(!btn)return;e.preventDefault();e.stopImmediatePropagation();if(btn.hasAttribute('data-demo-restore-asset'))resetAsset(selectedId());else if(btn.hasAttribute('data-demo-reset-session'))resetMode(btn);else if(btn.dataset.demoAction){const id=selectedId(),st=assetState(id)[2];commit(id,btn.dataset.demoAction,!st.actions[btn.dataset.demoAction])}}
document.addEventListener('click',handle,true);
let demoRoot=null,demoObserverConnected=false;
function connectDemoObserver(){if(demoRoot&&!demoObserverConnected){mo.observe(demoRoot,{childList:true,subtree:true});demoObserverConnected=true}}
function disconnectDemoObserver(){if(demoObserverConnected){mo.disconnect();demoObserverConnected=false}}
const mo=new MutationObserver(()=>{
  if(!demoRoot?.classList.contains('active'))return;
  clearTimeout(window.__aipDemoTimer);
  window.__aipDemoTimer=setTimeout(()=>{
    if(!demoRoot?.classList.contains('active'))return;
    disconnectDemoObserver();
    try{decorate()}finally{connectDemoObserver()}
  },70);
});
function start(){demoRoot=document.getElementById('view-assetexplorer');connectDemoObserver();disconnectDemoObserver();try{decorate()}finally{connectDemoObserver()}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
document.addEventListener('click',e=>{if(e.target.closest('#view-assetexplorer .ax-asset,#view-assetexplorer [data-ax-tab]'))setTimeout(decorate,50)},true);
})();
