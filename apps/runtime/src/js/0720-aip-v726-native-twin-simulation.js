
(function(){
'use strict';
let timer=0,running=false,startStamp=0,startHour=0;
const DURATION_MS=30000, STEP_MS=50;
const V=()=>document.getElementById('view-operationaltwin');
const Q=(s,r)=>(r||document).querySelector(s);
const QA=(s,r)=>Array.from((r||document).querySelectorAll(s));
const activeLayer=v=>Q('#tLayers .xi-tab.active',v)?.textContent.trim()||'';
const isLive=v=>!!v&&activeLayer(v)==='Live Plant';
function fmtHour(v){v=Number(v)||0;let h=Math.floor(v),m=Math.round((v-h)*60);if(m===60){h++;m=0}return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')}
function button(v){return Q('#aip726TwinSimulation',v)}
function paint(v){const b=button(v);if(b)b.textContent=running?'Stop Simulation':'Simulate Intervention'}
function stop(v){running=false;if(timer){clearInterval(timer);timer=0}startStamp=0;paint(v||V())}
function smoothMarker(v,hour){
 const svg=Q('#twBody .ot297-chart',v);if(!svg)return;
 const r=Q('#tTime',v);if(!r)return;
 const min=Number(r.min),max=Number(r.max);if(!Number.isFinite(min)||!Number.isFinite(max)||max<=min)return;
 const W=820,p=38,x=p+Math.max(0,Math.min(1,(hour-min)/(max-min)))*(W-p*1.35);
 const line=QA('line',svg).find(el=>(el.getAttribute('stroke')||'').toLowerCase()==='#c026d3');
 const dot=QA('circle',svg).find(el=>(el.getAttribute('fill')||'').toLowerCase()==='#c026d3');
 const label=Q('.ot297-marker-label',svg);
 if(line){line.setAttribute('x1',x);line.setAttribute('x2',x)}
 if(dot)dot.setAttribute('cx',x);
 if(label){label.setAttribute('x',Math.min(W-85,x+6));label.textContent=fmtHour(hour)}
 const top=Q('#tHour',v);if(top)top.textContent=fmtHour(hour);
}
function renderHour(v,hour){
 const r=Q('#tTime',v);if(!r)return false;
 const min=Number(r.min),max=Number(r.max);hour=Math.max(min,Math.min(max,hour));
 r.value=String(hour);
 window.AIP_V21=window.AIP_V21||{};window.AIP_V21.state=window.AIP_V21.state||{};
 window.AIP_V21.state.time=hour;window.AIP_V21.state.layer='Live Plant';
 // Invoke the established v299 Live Plant render path. This redraws governed
 // values/curves without dispatching a synthetic input event that can be
 // mistaken for a manual scrub.
 if(typeof r.oninput==='function')r.oninput.call(r);
 smoothMarker(v,hour);
 return true;
}
function tick(){
 const v=V(),r=v&&Q('#tTime',v);
 if(!running||!v||!v.classList.contains('active')||!r||!isLive(v)){stop(v);sync();return}
 const min=Number(r.min),max=Number(r.max),span=max-min;
 if(!Number.isFinite(span)||span<=0){stop(v);return}
 const elapsed=performance.now()-startStamp;
 const next=startHour+span*(elapsed/DURATION_MS);
 if(next>=max){renderHour(v,max);stop(v);return}
 renderHour(v,next);
}
function start(v){
 if(!isLive(v))return;
 const r=Q('#tTime',v);if(!r)return;
 const min=Number(r.min),max=Number(r.max);let cur=Number(r.value);
 if(!Number.isFinite(cur)||cur>=max-.001)cur=min;
 startHour=cur;startStamp=performance.now();running=true;paint(v);
 renderHour(v,cur);timer=setInterval(tick,STEP_MS);
}
function sync(){
 const v=V();if(!v)return;
 // Legacy generic control is never allowed to own simulation.
 Q('#tRun',v)?.remove();
 const toolbar=Q('.tw-toolbar',v);if(!toolbar)return;
 let b=button(v);
 if(!b){
   b=document.createElement('button');b.type='button';b.id='aip726TwinSimulation';b.className='xi-btn primary';
   const row=Q('.ot326-time-row',toolbar);(row||toolbar).insertAdjacentElement('afterend',b);
   b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(!isLive(v)){stop(v);sync();return}running?stop(v):start(v)});
 }
 if(!isLive(v)&&running)stop(v);
 b.hidden=!isLive(v);paint(v);
}
// Manual Solar Hour slider is the alternate control. Any genuine user gesture
// stops automatic playback and leaves the selected state under manual control.
document.addEventListener('pointerdown',e=>{const v=V();if(v&&e.target===Q('#tTime',v)&&running)stop(v)},true);
document.addEventListener('keydown',e=>{const v=V();if(v&&e.target===Q('#tTime',v)&&running)stop(v)},true);
document.addEventListener('click',e=>{
 const v=V();if(!v||!v.classList.contains('active'))return;
 const tab=e.target.closest('#tLayers .xi-tab');
 if(tab){if(tab.textContent.trim()!=='Live Plant')stop(v);setTimeout(sync,0);setTimeout(sync,120)}
},true);
document.addEventListener('change',e=>{const v=V();if(v&&e.target===Q('#tSite',v)){stop(v);setTimeout(sync,0);setTimeout(sync,160)}},true);
document.addEventListener('aip:data-source-changed',()=>{stop(V());setTimeout(sync,180)});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop(V())});
function hook(){
 const R=window.AIP_V21?.renderers;if(!R||typeof R.operationaltwin!=='function')return setTimeout(hook,80);
 const prior=R.operationaltwin;if(prior.__v726){sync();return}
 const wrapped=function(){stop(V());const out=prior.apply(this,arguments);setTimeout(sync,0);setTimeout(sync,160);return out};
 wrapped.__v726=true;R.operationaltwin=wrapped;sync();
}
hook();
window.AIP_V726_NATIVE_TWIN_AUDIT={release:'v726',baseline:'v725',scope:'Native Twin > Live Plant only',continuousSimulation:true,durationSeconds:30,stopFreeze:true,manualScrubber:true,smoothMarkerInterpolation:true,hiddenOutsideLivePlant:true,legacyControllerRemoved:true,businessDataChanged:false};
window.AIP_CURRENT_BUILD='v726';
})();
