
(function(){
'use strict';
const BAD=/^(ring|bar|bars|trend|context|sparkline|caption|note|status|source)\s*:/i;
const NUMBER=/[+\-]?\s*(?:₹|\$|€|£)?\s*\d[\d,]*(?:\.\d+)?/;
const CARD_SELECTORS=[
 '.enhanced-kpi','.vision-kpi','.rigour-kpi','.ops-kpi','.ai3-kpi','.aig-kpi','.sx-kpi','.avx-kpi','.dm-kpi','.dd-kpi','.xi-kpi','.decision-card','.financial-kpi',
 '.api-stat','.cb-stat','.mdp-stat','.ad-stat','.scenario-metric','.executive-summary-metric','.executive-revenue-kpi','.crew-capacity-kpi','.bsm3-kpi','.aigsp-metric','.aip-wo-metric',
 '.ax-kpi','.ax-mini-kpis > div','.asx-kpi','[data-kpi-card]'
].join(',');
const EXCLUDE='table,thead,tbody,tr,th,td,button,a,.modal,.help-modal,#helpOverlay,#sidebar,.chart-wrap,.graph-wrap,.inv-tile,.tile-score,.decision-score,.ax-score-card,.ar-case-score';
const CLASS_HINT=/(^|[-_\s])(kpi|metric|stat|scorecard)([-_\s]|$)/i;
const CONTAINER_HINT=/(grid|row|wrap|container|group|list|table|section|header|head|title|chart|legend|toolbar|filter|modal|drawer|panel|kpis|metrics|stats)$/i;
const LABEL_SELECTORS=['[data-kpi-label]','.kpi-label','.vision-kpi-label','.metric-label','.stat-label','.xi-kpi-label','.ops-kpi-label','.ai3-label','.aig-kpi-label','.sx-kpi-label','.avx-kpi-label','.dm-kpi-label','.dd-kpi-label','.label','.lbl','.l'];
const VALUE_SELECTORS=['[data-kpi-value]','.kpi-value','.vision-kpi-value','.metric-value','.stat-value','.xi-kpi-value','.ops-kpi-value','.ai3-value','.aig-kpi-value','.sx-kpi-value','.avx-kpi-value','.dm-kpi-value','.dd-kpi-value','.value','.val','.n','strong','b'];
let scheduled=false,running=false,observer=null,observeRoot=null;
function text(el){return (el&&el.textContent||'').replace(/\s+/g,' ').trim()}
function original(el){return el&&!el.closest('.aip-kpi-display-label,.aip-kpi-display-value,.aip-kpi-master-bars')}
function goodLabel(el){const t=text(el);return original(el)&&t.length>1&&t.length<=90&&!NUMBER.test(t)&&!BAD.test(t)&&!/^[-–—]+$/.test(t)}
function goodValue(el){const t=text(el);return original(el)&&t.length>0&&t.length<=90&&!BAD.test(t)&&(NUMBER.test(t)||/^(high|medium|low|active|healthy|watch|critical|available|governed|dynamic|controlled|leading|competitive|intervention)$/i.test(t))}
function firstGood(card,selectors,test){for(const sel of selectors){for(const el of card.querySelectorAll(sel)){if(test(el))return el}}return null}
function sources(card){let label=firstGood(card,LABEL_SELECTORS,goodLabel),value=firstGood(card,VALUE_SELECTORS,goodValue);if(!label){const candidates=[...card.children].filter(goodLabel);label=candidates[0]||null}if(!value){const candidates=[...card.querySelectorAll('strong,b,span,div')].filter(goodValue);value=candidates[0]||null}if(!label||!value)return null;if(label===value||label.contains(value)||value.contains(label)){const vals=[...card.querySelectorAll('strong,b,[class*="value"],[class="n"]')].filter(goodValue);value=vals.find(v=>v!==label&&!label.contains(v))||value}return label&&value&&label!==value?{label,value}:null}
function hinted(el){if(el.matches(CARD_SELECTORS))return true;const cls=(el.className&&String(el.className))||'';if(CLASS_HINT.test(cls)&&!CONTAINER_HINT.test(cls))return true;const p=el.parentElement,pc=(p&&p.className&&String(p.className))||'';return !!(p&&/(kpis|metrics|stats|scorecards)/i.test(pc)&&p.children.length<=12)}
function candidate(el){if(!(el instanceof HTMLElement)||el.matches(EXCLUDE)||el.closest('#sidebar,#helpOverlay,.help-modal,.modal,.ax-domain-metrics'))return false;if(el.classList.contains('aip-kpi-display-label')||el.classList.contains('aip-kpi-display-value')||el.classList.contains('aip-kpi-master-bars'))return false;if(!hinted(el))return false;const s=sources(el);if(!s)return false;return text(el).length<=500}
function collect(view){const explicit=[...view.querySelectorAll(CARD_SELECTORS)].filter(candidate);const generic=[...view.querySelectorAll('*')].filter(candidate);const pool=[...new Set([...explicit,...generic])];pool.sort((a,b)=>{let da=0,db=0;for(let x=a;x;x=x.parentElement)da++;for(let x=b;x;x=x.parentElement)db++;return db-da});const chosen=[];for(const el of pool){if(chosen.some(c=>el.contains(c)||c.contains(el)))continue;chosen.push(el)}return chosen.sort((a,b)=>a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1)}
function indian(raw){let s=raw.replace(/,/g,''),sign='';if(/^[+-]/.test(s)){sign=s[0];s=s.slice(1)}const parts=s.split('.');if(!/^\d+$/.test(parts[0]))return raw;let x=parts[0],last=x.slice(-3),rest=x.slice(0,-3);if(rest)last=rest.replace(/\B(?=(\d{2})+(?!\d))/g,',')+','+last;return sign+last+(parts[1]?'.'+parts[1]:'')}
function parts(raw){raw=raw.replace(/\s+/g,' ').trim();const m=raw.match(/^([^\d+\-]*)([+\-]?\d[\d,]*(?:\.\d+)?)(.*)$/);if(!m)return{prefix:'',number:raw,unit:''};let num=m[2],clean=num.replace(/,/g,'');if(/^[-+]?\d+(?:\.\d+)?$/.test(clean)&&Math.abs(Number(clean))>=1000)num=indian(clean);return{prefix:(m[1]||'').trim(),number:num,unit:(m[3]||'').trim()}}
function makeBars(){const b=document.createElement('span');b.className='aip-kpi-master-bars';b.setAttribute('aria-hidden','true');b.innerHTML='<i></i><i></i><i></i><i></i><i></i>';return b}
function render(card,src,index){card.classList.add('aip-kpi-master');card.dataset.aipKpiIndex=String(index%8);let label=card.querySelector(':scope > .aip-kpi-display-label');if(!label){label=document.createElement('span');label.className='aip-kpi-display-label';card.prepend(label)}let value=card.querySelector(':scope > .aip-kpi-display-value');if(!value){value=document.createElement('span');value.className='aip-kpi-display-value';label.after(value)}label.textContent=text(src.label).replace(BAD,'').trim();const p=parts(text(src.value));value.replaceChildren();if(p.prefix){const pre=document.createElement('span');pre.className='aip-kpi-prefix';pre.textContent=p.prefix;value.append(pre)}const n=document.createElement('span');n.className='aip-kpi-number';n.textContent=p.number;value.append(n);if(p.unit){const u=document.createElement('span');u.className='aip-kpi-unit';u.textContent=p.unit;value.append(u)}const bars=[...card.querySelectorAll(':scope > .aip-kpi-master-bars')];bars.slice(1).forEach(x=>x.remove());if(!bars[0])card.append(makeBars())}
function normalize(view){
  if(view&&view.id==='view-overview')return;
  if(view&&view.id==='view-contextgraph')return;
  /* v697: Control & Assurance owns its KPI rendering natively. In particular,
     Access & Roles must not be rewritten by the universal post-navigation KPI
     normalizer on external entry (rAF/+40/+120 ms). */
  if(view&&view.id==='view-controlassurance')return;
  /* v87_862: Asset Explorer owns its KPI rendering natively so tab/data-source
     changes cannot flash or mutate the KPI visual system. */
  if(view&&view.id==='view-assetexplorer')return;
  /* v87_750: Maintenance Strategy master KPI cards are authoritative native markup.
     Do not let the universal post-login normalizer rewrite them at rAF/+40/+120 ms. */
  /* v62: Sustainability Energy/HSE KPI renderers own their native master-card markup.
     Preserve them during the post-login universal normalization pass; otherwise the
     first startup scan removes their display values/bars until a later tab re-render. */
  const preserved=[...view.querySelectorAll('.aip-maintenance-master-kpis > .aip-kpi-master, .sus8-resource-kpis > .sus8-resource-kpi.aip-kpi-master, .sus8-hse-kpis > .sus8-hse-kpi.aip-kpi-master')];
  const preservedSet=new Set(preserved);
  const cards=collect(view).filter(card=>!preservedSet.has(card));
  const keep=new Set([...cards,...preserved]);
  view.querySelectorAll('.aip-kpi-master').forEach(card=>{
    if(!keep.has(card)){
      card.classList.remove('aip-kpi-master');
      card.removeAttribute('data-aip-kpi-index');
      card.querySelectorAll(':scope > .aip-kpi-display-label,:scope > .aip-kpi-display-value,:scope > .aip-kpi-master-bars').forEach(x=>x.remove())
    }
  });
  cards.forEach((card,i)=>{const src=sources(card);if(src)render(card,src,i)})
}
function startObserve(){if(observer&&observeRoot)observer.observe(observeRoot,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']})}
function activeViews(){const active=[...document.querySelectorAll('#main .view.active')];return active.length?active:[...document.querySelectorAll('#main .view')].filter(v=>v.offsetParent!==null)}
function scan(scope){if(running)return;running=true;if(observer)observer.disconnect();try{const views=scope?[scope.closest?.('.view')||scope].filter?.(Boolean):activeViews();(views&&views.length?views:activeViews()).forEach(v=>{if(v&&v.matches?.('.view'))normalize(v)})}finally{running=false;startObserve()}}
function queue(scope){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;scan(scope)})}
function chartMutation(m){const t=m.target?.nodeType===1?m.target:m.target?.parentElement;return !!(t&&t.closest?.('canvas,svg,.chart-wrap,.graph-wrap,[class*=chart],[class*=graph],.aip-kpi-master-bars'))}
function boot(){
observeRoot=document.getElementById('main')||document.body;
/* Event-driven only: no global MutationObserver, which can freeze startup. */
function refreshActive(){requestAnimationFrame(()=>scan());setTimeout(()=>scan(),40);setTimeout(()=>scan(),120)}
document.addEventListener('click',e=>{if(e.target.closest('.nav-item,[data-view],[data-edi-view],#loadExcelOption,#loadSyntheticOption'))refreshActive()},false);
['aip:data-source-changed','apm:datasource-refreshed'].forEach(n=>document.addEventListener(n,refreshActive));
/* Normalize the initially rendered Portfolio Overview too. Previously the
   master KPI normalizer only ran after navigation/data-source interaction,
   so the first post-login frame could retain legacy KPI markup. */
refreshActive();
window.addEventListener('aip:runtime-ready',refreshActive,{once:true});
document.addEventListener('aip:pre-reveal-layout',refreshActive,{once:true});

}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();window.AIPKPIMaster={refresh:queue,scan};
})();
