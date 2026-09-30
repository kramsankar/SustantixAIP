
(function(){
 'use strict';
 window.AIP_CURRENT_BUILD='v87_807';
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
 const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 function root(view){return document.getElementById('view-'+view)}
 function card(view){return [...(root(view)?.querySelectorAll('.ms686-card')||[])].find(c=>/Strategy Reasoning Graph/i.test(c.querySelector(':scope>.ms686-head h3')?.textContent||''))||null}
 function decorateDetails(view){
   const c=card(view),head=c?.querySelector(':scope>.ms686-head'); if(!head)return;
   const titleWrap=head.querySelector(':scope>div'), h=titleWrap?.querySelector('h3'); if(!titleWrap||!h)return;
   let line=titleWrap.querySelector('.ms806-title-line');
   if(!line){line=document.createElement('div');line.className='ms806-title-line';h.insertAdjacentElement('beforebegin',line);line.appendChild(h)}
   line.querySelectorAll('.ms806-details-btn').forEach(x=>x.remove());
   let old=head.querySelector(':scope>.ms738-expand-reasoning')||c.querySelector('.ms738-expand-reasoning');
   if(!old)return;
   let group=line.querySelector('.ms807-details-control');
   if(!group){
     group=document.createElement('span');group.className='ms807-details-control';
     const cap=document.createElement('span');cap.className='ms807-details-caption';cap.textContent='Details';
     group.appendChild(old);group.appendChild(cap);line.appendChild(group);
   }else if(old.parentElement!==group){group.insertBefore(old,group.firstChild)}
   old.classList.add('ms807-details-arrow');
   old.setAttribute('aria-label','Open Strategy Reasoning Details');
   old.title='Open Strategy Reasoning Details';
 }
 function currentRecord(view){
   const rid=root(view)?.querySelector('.ms791-host')?.dataset?.ms800reasoning||'';
   if(!rid)return null;
   const all=[...(window.AIP_STRATEGY_REASONING_EXCEL||[]),...(window.AIP_STRATEGY_REASONING_SYNTHETIC||[])];
   return all.find(r=>String(r.Reasoning_ID||'')===rid)||null;
 }
 function selectionBasis(view,r){
   const rt=root(view),ws=rt?.querySelector('.ms686-workspace');
   const asset=ws?.querySelector('.ms686-asset')?.value||rt?.dataset?.ms686asset||'All';
   const site=ws?.querySelector('.ms686-site')?.value||rt?.dataset?.ms686site||'All';
   try{return window.AIP_STRATEGY_REASONING_SELECTION?.selectionBasis?.(view,r,{asset,site,rows:[],root:rt,ws})||''}catch(_){return ''}
 }
 function cell(label,value,selection){return `<div class="ms791-pin-cell${selection?' ms800-selection-basis':''}"><span>${esc(label)}</span><b>${esc(value||'—')}</b></div>`}
 window.ms806OpenContext=function(view){
   if(!VIEWS.includes(view))return;
   const r=currentRecord(view),p=document.getElementById(`ms806-context-${view}`);if(!r||!p)return;
   const fields=[
     ['Reasoning record',r.Reasoning_ID],
     ['Asset',`${r.Asset_Tag||r.Asset_ID||'—'}${r.Asset_Class?` · ${r.Asset_Class}`:''}`],
     ['Primary source',`${r.Primary_Source_Dataset||'—'}${r.Primary_Source_ID?` · ${r.Primary_Source_ID}`:''}`],
     ['Failure mode',r.Failure_Mode||'—'],
     ['Selection basis',selectionBasis(view,r),true]
   ];
   if(view==='corrective'&&r.Work_Order_ID)fields.push(['Work order',r.Work_Order_ID]);
   if(view==='adaptive'&&r.RCM_ID)fields.push(['RCM policy',r.RCM_ID]);
   const body=p.querySelector('.ms806-panel-body');
   if(body)body.innerHTML=`<div class="ms799-context"><div class="ms791-pin-grid ms799-common-grid">${fields.map(x=>cell(x[0],x[1],x[2])).join('')}</div></div>`;
   p.classList.add('open');
 };
 function decorateBasisHead(view){
   const p=document.getElementById(`ms806-basis-${view}`);if(!p)return;
   const b=p.querySelector('.ms806-panel-head b');if(b)b.textContent='Reasoning Basis';
   p.querySelectorAll('.ms799-section-title').forEach(x=>x.remove());
 }
 function decorate(view){decorateDetails(view);decorateBasisHead(view)}
 const prior=window.ms791RenderGraph;
 window.ms791RenderGraph=function(view){const out=typeof prior==='function'?prior(view):undefined;decorate(view);setTimeout(()=>decorate(view),0);return out};
 const run=()=>VIEWS.forEach(v=>{try{decorate(v)}catch(_){}});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,150),{once:true});else setTimeout(run,80);
 document.addEventListener('aip:data-source-changed',()=>setTimeout(run,120));
 document.addEventListener('click',e=>{const b=e.target.closest?.('.ms791-node.ms804-meaningful .ms791-go');if(!b)return;setTimeout(run,0)},true);
 window.AIP_V807_AUDIT={
   details:'Uses the original proven Strategy Reasoning expand arrow with one tiny static Details caption; no duplicate arrow.',
   recordContext:'One compact horizontal row including Selection basis.',
   reasoningBasis:'Single Reasoning Basis caption only; node name is not repeated in a second heading.',
   scope:'All five maintenance strategy tabs',
   excelBusinessDataChanged:false
 };
})();
