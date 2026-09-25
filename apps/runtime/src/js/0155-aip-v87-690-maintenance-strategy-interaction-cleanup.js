
(function(){
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
 const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c));
 function activeRoot(){return VIEWS.map(v=>document.getElementById('view-'+v)).find(x=>x&&getComputedStyle(x).display!=='none')||document.querySelector('.view.active')}
 function open(title,rows,desc){let m=document.getElementById('ms686Modal');if(!m){m=document.createElement('div');m.id='ms686Modal';m.className='ms686-modal';m.innerHTML='<div class="ms686-panel"><button class="ms686-close" onclick="window.ms686Close()">×</button><h2></h2><p></p><div class="ms686-body"></div></div>';document.body.appendChild(m)}m.querySelector('h2').textContent=title;m.querySelector('p').textContent=desc||'';m.querySelector('.ms686-body').innerHTML=rows.map(r=>`<div class="ms686-detail"><div>${esc(r[0])}</div><div>${r[1]}</div></div>`).join('');m.classList.add('open')}
 function val(x,ks){for(const k of ks){if(x&&x[k]!=null&&String(x[k]).trim()!=='')return x[k]}return ''}
 function eventDate(a){return String(val(a,['created','Created_Date','ts','Alert_Timestamp','Evidence_Date','date'])||'').slice(0,10)}
 function eventType(x){return x.kind==='WO'?'Maintenance record':x.kind==='Condition'?'Condition alert':x.kind==='Risk'?'Risk assessment':'Evidence event'}
 function eventId(x){return val(x.row||{},['Work_Order_ID','id','Alert_ID','Risk_ID','Evidence_ID'])||x.kind||'Evidence'}
 function eventDetail(x){return val(x.row||{},['desc','Description','Evidence_Summary','Recommendation','Risk_Drivers','Failure_Mode'])||x.failure||'Evidence recorded'}
 function fitBand(v){v=Number(v)||0;return v<40?'Low':v<60?'Moderate':v<80?'High':'Very High'}
 
 function graphDetail(){const root=activeRoot(),ws=root?.querySelector('.ms686-workspace'),a=ws?._a||{};const scores=a.scores||{};const scoreText=Object.entries(scores).map(([k,v])=>`${k}: ${Number(v).toFixed(1)}/100 (${fitBand(v)})`).join(' · ');const kinds=(a.rows||[]).reduce((o,x)=>(o[x.kind]=(o[x.kind]||0)+1,o),{});open('Strategy reasoning detail',[
   ['Evidence composition',`${kinds.WO||0} maintenance · ${kinds.Condition||0} condition · ${kinds.Risk||0} risk`],
   ['Evidence sufficiency',a.sufficient?'Adequate for reassessment':'Insufficient for a governed recommendation'],
   ['Current policy',esc(a.current||'Unassigned')],
   ['Cross-strategy fit',esc(scoreText||'No score available')],
   ['Strongest fit',esc(a.best||'No conclusion')],
   ['Policy action',esc(a.action||'No action')]
 ],'Consolidated explanation for the selected strategy scope. The Site, Asset and Failure Mode are already defined by the selectors above and are therefore not repeated here.')}
 
 function uniqueDetail(type,arg){const root=activeRoot(),ws=root?.querySelector('.ms686-workspace'),a=ws?._a||{};
   if(type==='timeline'){
     const hit=(a.rows||[]).find(x=>String(eventId(x))===String(arg));
     if(!hit)return;
     open('Timeline event',[
       ['Date',esc(eventDate(hit)||'—')],['Event',esc(eventType(hit))],['Record',esc(eventId(hit))],['Context',esc(eventDetail(hit))]
     ],'Detail for this dated marker.');return;
   }
   if(type==='graph690'){graphDetail();return}
 }
 window.ms690Detail=uniqueDetail;
 
 function cleanWorkspace(ws){if(!ws||ws.dataset.ms690clean==='1')return;ws.dataset.ms690clean='1';
   const cards=ws.querySelectorAll('.ms686-card');
   cards.forEach(card=>{
     const h=card.querySelector(':scope>.ms686-head'); if(!h)return;
     const title=h.querySelector('h3')?.textContent||'';
     h.querySelectorAll(':scope>.ms686-drill').forEach(b=>b.remove());
     if(title.includes('Strategy Reasoning Graph')){
       const b=document.createElement('button');b.className='ms690-expand';b.type='button';b.title='Expand reasoning detail';b.innerHTML='<svg class="ms741-down-arrow" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><line class="ms741-arrow-shaft" x1="8" y1="2" x2="8" y2="10"></line><polyline class="ms741-arrow-head" points="4.5,7.5 8,11 11.5,7.5"></polyline></svg>';b.onclick=e=>{e.stopPropagation();window.ms690Detail('graph690')};h.appendChild(b);
       const sub=h.querySelector('.ms686-sub');if(sub)sub.textContent='Evidence → policy effectiveness → cross-strategy diagnosis → recommendation';
     }
   });
   ws.querySelectorAll('.ms686-score').forEach(x=>{x.removeAttribute('onclick');x.setAttribute('title',(x.getAttribute('title')||'')+' · Hover to interpret')});
   ws.querySelectorAll('.ms686-action').forEach(x=>{x.removeAttribute('onclick');x.querySelectorAll('.ms686-drill').forEach(b=>b.remove())});
   ws.querySelectorAll('.ms686-knode').forEach((x,i)=>{x.removeAttribute('onclick');x.querySelectorAll('.d').forEach(d=>d.remove());const sm=x.querySelector('small')?.textContent||'';const bv=x.querySelector('b')?.textContent||'';x.title=[sm,bv].filter(Boolean).join(' · ');if(/Cross-strategy diagnosis/i.test(sm))x.classList.add('ms690-diagnosis')});
   ws.querySelectorAll('.ms686-event').forEach(x=>{const old=x.getAttribute('onclick')||'';const m=old.match(/ms686Detail\('timeline','([^']*)'\)/);if(m)x.setAttribute('onclick',`ms690Detail('timeline','${m[1].replace(/'/g,"\\'")}')`)});
 }
 function run(){VIEWS.forEach(v=>{const r=document.getElementById('view-'+v),ws=r?.querySelector('.ms686-workspace');if(ws)cleanWorkspace(ws)})}
 const mo=new MutationObserver(()=>requestAnimationFrame(run));mo.observe(document.getElementById('main')||document.body,{subtree:true,childList:true});
 document.addEventListener('aip:data-source-changed',()=>setTimeout(run,80));document.addEventListener('click',()=>setTimeout(run,20),true);setTimeout(run,80);
})();
