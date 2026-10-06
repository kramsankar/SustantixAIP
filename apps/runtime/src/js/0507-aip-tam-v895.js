(function(){
'use strict';
const nativeNames=["a891-metric", "aa461-kpi", "ad-stat", "ai3-kpi", "aig-kpi", "aig40-kpi", "aig49-kpi", "aigsp-metric", "aip-ar-kpi", "aip-command-metric", "aip-esg-target-metric", "aip-exact-kpi", "aip-manual-kpi", "aip-overview-action-kpi", "aip-overview-drill-kpi", "aip-overview-static-kpi", "aip-predictive-kpi", "aip-universal-kpi", "aip-wo-metric", "aip306-dq-kpi", "aip329-kpi", "aip528-current-kpi", "aip528-current-kpi-card", "aip529-kpi-card", "aip530-kpi-card", "aip679-kpi", "aip689-kpi", "aip690-kpi", "aip862-asset-kpi", "aip862-kpi", "alt-kpi", "api-stat", "asset-condition-kpi", "asset-explorer-kpi", "asset-health-kpi", "asset-kpi", "asx-kpi", "asx-metric", "avx-kpi", "aw804-kpi", "ax-kpi", "ax865-kpi", "bsm3-kpi", "cb-stat", "cbm818-kpi", "cbm828-kpi", "cg-portfolio-kpi", "cm-kpi", "corrective-kpi", "cppa-kpi", "cr-kpi", "crew-capacity-kpi", "dd-kpi", "di401-kpi", "dm-kpi", "edi-standard-kpi", "enhanced-kpi", "er-kpi", "exec-kpi", "executive-revenue-kpi", "executive-summary-metric", "financial-kpi", "gf377-kpi", "gf475-kpi", "gf480-kpi", "gf480-perfkpi", "guardrail-kpi", "home-kpi", "mdp-stat", "ml534-kpi", "ml855-kpi", "ml856-kpi", "ml857-kpi", "msi-kpi", "msi604-method-stat", "msi605-stat", "msi606-stat", "ops-kpi", "orl-kpi", "ot297-kpi", "ov121-kpi", "ov224-kpi", "ov527-kpi", "ovd-kpi", "pm-kpi", "po-kpi", "po218-kpi", "portfolio-kpi", "pred-kpi", "predictive-kpi", "preventive-kpi", "ra804-kpi", "ra845-evidencekpi", "ra856-valkpi", "rbm-kpi", "rcm654-kpi", "rigour-kpi", "risk-based-kpi", "risk-kpi", "riskbased-kpi", "scenario-metric", "sus8-eol-kpi", "sus8-hse-kpi", "sus8-hse-rate-kpi", "sus8-kpi", "sus8-resource-kpi", "sx-kpi", "t872-kpi", "t873-kpi", "t874-kpi", "v499-recon-kpi", "v505-rar-kpi", "v508-rar-kpi", "v510-kpi", "vision-kpi", "vision-metric", "vision-replay-metric", "warranty-portfolio-kpi", "wo213-kpi", "xi-kpi", "xi-kpi-card"];
const selector=[...new Set(['aip-kpi-master','home-strip-card','home-pulse-card','home-risk-card','home-fcst-item','gf377-driver','cppa-summary-card','kpi-card','metric-card','stat-card','inv-tile',...nativeNames])].map(c=>'.'+c).join(',')+',[data-kpi-card],.card:has(> .kpi-label):has(> .kpi-value),.v230-audit-eq > div,.v229-recon-eq > div';
const colors=['#1976d2','#d32f2f','#ef8b00','#7b1fa2','#c62828','#008b9c','#38876c','#8a65a0'];
const heights=[6,10,14,9,12];let applying=false,timer;
const cardCache=new WeakMap();
const normalized=new Map(),normalizer=document.createElement('span').style;
function add(el,name){if(!el.classList.contains(name))el.classList.add(name)}
const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
function set(el,values){if(!el)return;for(const [key,value] of Object.entries(values)){const id=key+'|'+value;if(!normalized.has(id)){normalizer.setProperty(key,value);normalized.set(id,normalizer.getPropertyValue(key))}if(el.style.getPropertyValue(key)!==normalized.get(id)||el.style.getPropertyPriority(key)!=='important')el.style.setProperty(key,value,'important')}}
function own(card,q){return [...card.querySelectorAll(q)].filter(e=>e.closest(selector)===card)}
function find(card,queries){for(const q of queries){const list=own(card,q);const hit=list.find(visible);if(hit)return hit}return null}
function parts(card){
 const label=find(card,['.aip-kpi-display-label','.wo213-label','[class$="-label"],.label,.lbl,.lab,.l,[data-kpi-label]','[class$="-title"],.title',':scope > span:first-child',':scope > small',':scope > h4',':scope > div:first-child']);
 const value=find(card,['.aip-kpi-display-value','.wo213-value','[class$="-value"],[class$="-val"],[class$="-num"],[class$="-number"],.value,.val,.num,.v,.n,[data-kpi-value]',':scope > b,:scope > strong',':scope > h3,:scope > h2', 'b,strong']);
 return label&&value&&label!==value&&!label.contains(value)&&!value.contains(label)?{label,value}:null;
}
const textStyle={'font-family':'Arial, sans-serif','font-style':'normal','letter-spacing':'normal','text-shadow':'none','text-decoration':'none','-webkit-text-fill-color':'currentColor','opacity':'1'};
const flow={position:'static',height:'auto','max-height':'none','min-height':'0',width:'auto','min-width':'0','max-width':'100%',margin:'0',padding:'0',transform:'none',float:'none',overflow:'visible','text-overflow':'clip','white-space':'normal','word-break':'normal','overflow-wrap':'anywhere','-webkit-line-clamp':'unset'};
function splitPlain(value){
 if(value.children.length)return;
 const original=value.textContent,m=original.match(/^(\s*[₹$€£]?\s*)([-+]?\d[\d,]*(?:\.\d+)?)(\s*[^\d].*)?$/s);
 if(!m||/^\s*[\/–-]\s*\d/.test(m[3]||''))return;
 const fragment=document.createDocumentFragment();
 for(const [cls,text] of [['tam895-prefix',m[1]],['tam895-number',m[2]],['tam895-unit',m[3]||'']])if(text){const span=document.createElement('span');span.className=cls;span.textContent=text;fragment.append(span)}
 value.replaceChildren(fragment);
}
function apply(card,index=null){
 const p=parts(card);if(!p)return false;
 const {label,value}=p;
 if(card.closest('#main')){set(label,{order:'0'});set(value,{order:'1'});}
 const signature=label.textContent+'|'+value.textContent+'|'+!!card.querySelector('.a891-info,.a894-drill,.ov527-kpi-drill-icon,.v510-kpi-drill-badge');
 const cached=cardCache.get(card);if(cached&&cached.label===label&&cached.value===value&&cached.signature===signature&&cached.labelStyle===label.style.cssText&&cached.valueStyle===value.style.cssText&&(!card.closest('#main')||cached.cardStyle===card.style.cssText)&&card.querySelector('.tam895-bars'))return true;
 if(index===null)index=Math.max(0,[...card.parentElement.children].filter(e=>e.matches(selector)&&parts(e)).indexOf(card));
 add(card,'tam895-card');add(label,'tam895-label');add(value,'tam895-value');
 set(card,{position:'relative',display:'flex','flex-direction':'column','align-items':'stretch','justify-content':'flex-start','box-sizing':'border-box',height:'auto','min-height':'66px','max-height':'none','min-width':'0',padding:'10px 12px','row-gap':'0','overflow':'visible'});
 const drill=!!card.querySelector('.a891-info,.a894-drill,.ov527-kpi-drill-icon,.v510-kpi-drill-badge,.home-lite-nav,[class$="-drill"]');
 set(label,{...textStyle,...flow,display:'block','flex':'0 0 auto','font-size':'8px','font-weight':'700','line-height':'9.5px','letter-spacing':'0.26px','text-transform':'uppercase',color:'#607681','padding-right':'26px',margin:'0 0 4px'});
 for(const e of label.querySelectorAll('span,b,strong,small'))set(e,{...textStyle,'font-size':'8px','font-weight':'700','line-height':'9.5px','letter-spacing':'0.26px','text-transform':'uppercase',color:'#607681','white-space':'normal','overflow':'visible','text-overflow':'clip'});
 splitPlain(value);
 set(value,{...textStyle,...flow,display:'flex','flex-wrap':'wrap','align-items':'baseline','justify-content':'flex-start','flex':'0 0 auto',gap:'1px','font-size':'10.5px','font-weight':'800','line-height':'14px',color:card.closest('#t875CR')?'#fff':'#173f57'});
 for(const e of value.querySelectorAll('span,small,em,b,strong')){
  const explicit=e.matches('.aip-kpi-unit,.aip-kpi-prefix,.tam895-unit,.tam895-prefix,small,em,[class$="-unit"]');
  const unit=explicit||(!e.children.length&&/\d/.test(value.textContent)&&!/[\d₹$€£]/.test(e.textContent)&&e.textContent.trim());
  add(e,unit?'tam895-unit':'tam895-number');
  set(e,{...textStyle,...flow,display:'block',flex:'0 1 auto','font-size':unit?'7.5px':'10.5px','font-weight':unit?'700':'800','line-height':unit?'11px':'14px',color:card.closest('#t875CR')?'#fff':unit?'#607681':'#173f57'});
 }
 for(const unit of own(card,'[class$="-unit"]'))if(!value.contains(unit)&&unit!==label)set(unit,{...textStyle,...flow,display:'block','font-size':'7.5px','font-weight':'700','line-height':'11px',color:'#607681',margin:'2px 0 0'});
 const decorations=[...card.querySelectorAll('*')].filter(e=>e.closest(selector)===card&&e.children.length>=3&&[...e.children].every(c=>['I','EM'].includes(c.tagName))&&!e.textContent.trim());
 let bars=own(card,'.tam895-bars,.aip-kpi-master-bars,.wo213-bars,[class$="-bars"],.bars').find(e=>!e.closest('.tam895-value'))||decorations[0];
 if(!bars){bars=document.createElement('span');bars.className='tam895-bars';bars.setAttribute('aria-hidden','true');card.append(bars)}else add(bars,'tam895-bars');
 for(const extra of new Set([...decorations,...own(card,'.aip-kpi-master-bars,.wo213-bars,[class$="-bars"],.bars')]))if(extra!==bars)set(extra,{display:'none'});
 if(bars.children.length!==5||[...bars.children].some(e=>e.tagName!=='I')){const fragment=document.createDocumentFragment();for(let i=0;i<5;i++)fragment.append(document.createElement('i'));bars.replaceChildren(fragment)}
 // The icon is decorative, not a measured trend. Its color is a per-card accent.
 const color=colors[index%colors.length];
 if(card.closest('#main')){set(bars,{order:'3'});for(const e of own(card,'[class$="-unit"]'))if(!value.contains(e)&&e!==label)set(e,{order:'2'});for(const e of own(card,'small,.note,[class$="-note"]'))if(!label.contains(e)&&!value.contains(e))set(e,{order:'4'});}
 set(bars,{...flow,display:'flex','align-items':'flex-end','justify-content':'flex-start',gap:'3px',width:'47px','min-width':'47px','max-width':'47px',height:'14px','min-height':'14px','max-height':'14px',flex:'0 0 14px',margin:'7px 0 0',padding:'0',background:'transparent',border:'0','box-shadow':'none'});
 [...bars.children].forEach((bar,i)=>set(bar,{display:'block',position:'static',width:'7px','min-width':'7px','max-width':'7px',height:heights[i]+'px','min-height':heights[i]+'px','max-height':heights[i]+'px',flex:'0 0 7px',margin:'0',padding:'0',border:'0','border-radius':'2px 2px 1px 1px',background:color,opacity:'1',transform:'none','box-shadow':'none'}));
 cardCache.set(card,{label,value,signature,labelStyle:label.style.cssText,valueStyle:value.style.cssText,cardStyle:card.style.cssText});
 return true;
}
function rowLayout(cards){const parents=new Set(cards.map(c=>c.parentElement));for(const parent of parents){const children=[...parent.children].filter(visible),kpis=children.filter(c=>c.classList.contains('tam895-card'));if(kpis.length<2||kpis.length!==children.length)continue;const display=getComputedStyle(parent).display;if(display==='grid'){add(parent,'tam895-row');set(parent,{'grid-template-columns':innerWidth<=600?'repeat(2,minmax(0,1fr))':parent.closest('#view-assetexplorer')&&parent.matches('.ax-kpis')?'repeat(3,minmax(0,1fr))':parent.closest('#view-portfoliointelligence')&&kpis.length===8?'repeat(4,minmax(0,1fr))':'repeat(auto-fit, minmax(min(140px, 100%), 1fr))','grid-auto-rows':'auto','align-items':'stretch',height:'auto','max-height':'none',gap:'10px'})}else if(display==='flex'){set(parent,{'flex-wrap':'wrap','align-items':'stretch',height:'auto','max-height':'none',gap:'10px'});kpis.forEach(c=>set(c,{flex:'1 1 140px'}))}}}
function refresh(){if(applying)return;applying=true;try{const roots=[...document.querySelectorAll('.view.active,#aipHomeOverlay,#t875CR,dialog[open],[role="dialog"]')].filter(visible),cards=[...new Set(roots.flatMap(r=>[...r.querySelectorAll(selector)]))].filter(visible),done=[];const counts=new Map();for(const c of cards){const index=counts.get(c.parentElement)||0;if(apply(c,index)){counts.set(c.parentElement,index+1);done.push(c)}}rowLayout(done);}finally{applying=false}}
function queue(){if(timer)return;timer=1;const run=()=>{timer=null;refresh()};if(document.body.classList.contains('aip-home-open'))requestAnimationFrame(run);else queueMicrotask(run)}
const observer=new MutationObserver(records=>{if(applying)return;if(records.some(m=>{const target=m.target.nodeType===1?m.target:m.target.parentElement;if(target?.closest('.tam895-bars,svg,canvas'))return false;if(m.type==='attributes'){if(!target?.closest('#main'))return false;if(target.matches('.view,[role=tabpanel]'))return true;const card=target.closest('.tam895-card'),cache=card&&cardCache.get(card);return !!(cache&&(cache.cardStyle!==card.style.cssText||cache.labelStyle!==cache.label.style.cssText||cache.valueStyle!==cache.value.style.cssText))}if(m.type==='characterData')return !!target?.closest(selector);return [...m.addedNodes].some(n=>n.nodeType===1&&!n.matches('.tam895-bars,.tam895-number,.tam895-unit,.tam895-prefix,i')&&(n.matches(selector)||n.querySelector(selector)))}))queue()});
function start(){observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden']});queue()}
window.AIPTAM895={refresh,apply,selector,parts,heights,colors};
window.addEventListener('click',e=>{if(e.target.closest?.('#main,#sidebar'))queue()},true);
document.addEventListener('click',queue);document.addEventListener('change',queue);window.addEventListener('resize',queue);window.addEventListener('aip:runtime-ready',queue);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
