
/* Presentation-layer formatting for every screen: dates as DD-MM-YY (month + year as MM-YY, day + month as DD-MM),
   and internal build/version tags removed from visible text. Never touches source records, form values, IDs or data attributes. */
(function(){
 const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
 const MON='(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
 const mnum=m=>months[m.slice(0,3).toLowerCase()];
 const p2=n=>String(n).padStart(2,'0');
 function full(y,m,d,original){
  y=+y;m=+m;d=+d;const date=new Date(y,m-1,d);
  if(date.getFullYear()!==y||date.getMonth()!==m-1||date.getDate()!==d)return original;
  return p2(d)+'-'+p2(m)+'-'+String(y).slice(-2);
 }
 function monthYear(y,m,original){y=+y;m=+m;if(!(m>=1&&m<=12)||y<1990||y>2100)return original;return p2(m)+'-'+String(y).slice(-2)}
 function dayMonth(d,m,original){d=+d;m=+m;if(!(m>=1&&m<=12)||!(d>=1&&d<=31))return original;return p2(d)+'-'+p2(m)}
 const RX={
  iso:/(?<![\w/-])(\d{4})-(\d{2})-(\d{2})(?![\d-])/g,
  dmy:/(?<![\w/-])(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?![\w/-])/g,
  dMonY:new RegExp('(?<![\\w-])(\\d{1,2})[ -]+'+MON+'[ ,.-]+(\\d{4})\\b','gi'),
  MonDY:new RegExp('\\b'+MON+'\\.? +(\\d{1,2}),? +(\\d{4})\\b','gi'),
  MonY:new RegExp('\\b'+MON+'\\.?[ ,-]+(\\d{4})\\b','g'),
  MonYY:new RegExp('\\b'+MON+"(?:-|\\s?')(\\d{2})\\b(?![:\\d])",'g'),
  ym:/(?<![\w/-])((?:19|20)\d{2})-(0[1-9]|1[0-2])(?![\d-])/g,
  dMon:new RegExp('(?<![\\w-])(\\d{1,2})[ -]'+MON+'\\b(?![ ,.-]*\\d)','g'),
  dMonT:new RegExp('(?<![\\w-])(\\d{1,2})[ -]'+MON+'\\b(?= \\d{1,2}:\\d{2})','g')
 };
 function dates(v){return v
  .replace(RX.iso,(s,y,m,d)=>full(y,m,d,s))
  .replace(RX.dmy,(s,d,m,y)=>full(y,m,d,s))
  .replace(RX.dMonY,(s,d,m,y)=>full(y,mnum(m),d,s))
  .replace(RX.MonDY,(s,m,d,y)=>full(y,mnum(m),d,s))
  .replace(RX.MonY,(s,m,y)=>monthYear(y,mnum(m),s))
  .replace(RX.MonYY,(s,m,y)=>monthYear('20'+y,mnum(m),s))
  .replace(RX.ym,(s,y,m)=>monthYear(y,m,s))
  .replace(RX.dMonT,(s,d,m)=>dayMonth(d,mnum(m),s))
  .replace(RX.dMon,(s,d,m)=>dayMonth(d,mnum(m),s));
 }
 /* internal release tags (v474, v87_870, v877.1, "AIP v864 …") are not shown to users */
 function versions(v){if(!/v\d{2}/.test(v))return v;return v
  .replace(/\bAIP\s+v\d{2,3}(?:[._]\d+)*\s*/g,'')
  .replace(/\(\s*v\d{3}(?:[._]\d+)*\s*\)/g,'')
  .replace(/\(\s*v\d{3}(?:[._]\d+)*\s+/g,'(')
  .replace(/(^|[\s·(])v\d{2}_\d{2,4}\b\s?/g,'$1')
  .replace(/(^|[\s·(])v\d{3}(?:\.\d+)?\b\s?/g,'$1')
  .replace(/\s{2,}/g,' ');
 }
 function display(value){const v=String(value??'');return versions(dates(v));}
 window.AIPDateDisplay884=display;window.AIPDisplayText=display;
 const excluded='script,style,textarea,input,select,code,pre,[contenteditable="true"]';
 const ATTRS=['title','aria-label','data-tooltip'];
 function text(node){const p=node.parentElement;if(!p||p.closest(excluded)&&p.tagName!=='OPTION')return;
  if(p.tagName==='OPTION'&&!p.hasAttribute('value'))return;   /* option text is its value: leave untouched */
  const cur=node.nodeValue;if(!cur||!/\d|v\d/.test(cur))return;const next=display(cur);if(next!==cur)node.nodeValue=next}
 function attrs(el){for(const a of ATTRS){const v=el.getAttribute&&el.getAttribute(a);if(v&&/\d/.test(v)){const n=display(v);if(n!==v)el.setAttribute(a,n)}}}
 function scan(root){if(root.nodeType===3){text(root);return}if(root.nodeType!==1)return;
  if(root.closest(excluded)&&root.tagName!=='SELECT'&&root.tagName!=='OPTION')return;
  attrs(root);root.querySelectorAll('[title],[aria-label],[data-tooltip]').forEach(attrs);
  const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while(n=walk.nextNode())text(n);
 }
 function fixTitle(){const t=document.title,n=t.replace(/\s+v\d+(?:\.\d+)+\s*$/,'');if(n!==t)document.title=n}
 function boot(){fixTitle();scan(document.body);new MutationObserver(records=>{for(const r of records){
   if(r.type==='characterData')text(r.target);else if(r.type==='attributes')attrs(r.target);else for(const n of r.addedNodes)scan(n)}})
   .observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTRS})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
