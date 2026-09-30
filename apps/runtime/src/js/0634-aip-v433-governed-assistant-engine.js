
(function(){
"use strict";

/* ================================================================
   AIP v433 — governed whole-application Assistant engine
   ================================================================ */

const GQ433={
  cache:null,
  cacheKey:"",
  context:window.GQ433_CONTEXT||null,
  stop:new Set([
    "a","an","the","is","are","was","were","be","been","being","of","to","from","for","in","on","at","by","with",
    "and","or","but","that","this","these","those","do","does","did","have","has","had","can","could","would","should",
    "me","my","our","we","you","your","please","tell","let","know","give","show","find","get","take","takes","taking",
    "there","any","all","about","which","what","who","where","when","how","many","much","list","listing","details","member","members","not",
    "data","record","records","information","currently","current","within","aip","assistant","source","sources"
  ]),
  opWords:new Set(["count","total","average","avg","mean","sum","minimum","maximum","min","max","top","bottom","highest","lowest","rank","compare","group","trend"]),
  synonymGroups:[
    ["site","sites","plant","plants","facility","facilities","location","locations"],
    ["asset","assets","equipment","equipments"],
    ["workorder","workorders","wo","maintenanceorder","maintenanceorders"],
    ["technician","technicians","crew","staff","resource","resources","person","people"],
    ["certification","certifications","certificate","certificates","certified"],
    ["waterstress","waterstressed","waterstressrisk","waterstressscore"],
    ["watersource","watersources","sourcewater","waterwithdrawalsource"],
    ["performance","performanceratio","pr"],
    ["availability","uptime"],
    ["revenueatrisk","revenueexposure","commercialrisk"],
    ["health","healthscore","condition"],
    ["risk","riskband","severity"],
    ["priority","criticality"],
    ["spare","spares","part","parts","inventory","stock"],
    ["intervention","interventions","job","jobs"],
    ["emission","emissions","ghg","carbon"],
    ["avoidedemissions","co2avoided","carbonavoided"],
    ["generation","energy","mwh"],
    ["water","wateruse","waterused","waterconsumption","waterconsumed"],
    ["cost","expense","spend","value"],
    ["date","time","period","month","year"],
    ["open","active","outstanding"],
    ["closed","completed","complete"]
  ],
  keyPriority:["Plant_ID","Site_ID","Asset_ID","Work_Order_ID","Intervention_ID","Technician_ID","Crew_ID","Event_ID","Finding_ID","Inspection_ID","Model_ID","Policy_ID","Decision_ID","Requirement_ID","Material_ID","Tool_ID","Vehicle_ID","Part_ID","ID"]
};

function esc(v){return String(v==null?"":v).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function norm(v){
  return String(v==null?"":v)
    .replace(/([a-z])([A-Z])/g,"$1 $2")
    .replace(/[_\-\/]+/g," ")
    .toLowerCase()
    .replace(/[^a-z0-9.%₹$]+/g," ")
    .replace(/\s+/g," ").trim();
}
function compact(v){return norm(v).replace(/\s+/g,"");}
function singular(t){
  if(t.endsWith("ies")&&t.length>4)return t.slice(0,-3)+"y";
  if(t.endsWith("ses")&&t.length>4)return t.slice(0,-2);
  if(t.endsWith("s")&&t.length>3&&!t.endsWith("ss"))return t.slice(0,-1);
  return t;
}
function tokens(v){
  const raw=norm(v).split(" ").filter(Boolean);
  const out=[];
  raw.forEach(t=>{
    const s=singular(t);
    if(!GQ433.stop.has(t)&&!GQ433.stop.has(s)&&t.length>1){out.push(t);if(s!==t)out.push(s);}
  });
  return [...new Set(out)];
}
function expandTokens(ts){
  const out=new Set(ts);
  const comp=new Set(ts.map(x=>compact(x)));
  GQ433.synonymGroups.forEach(g=>{
    const cg=g.map(compact);
    if(cg.some(x=>out.has(x)||comp.has(x))){
      g.forEach(x=>{out.add(norm(x));out.add(compact(x));});
    }
  });
  return [...out];
}
function objectRows(v){return Array.isArray(v)&&v.some(r=>r&&typeof r==="object"&&!Array.isArray(r));}
function stable(v){
  if(v===null||v===undefined)return "";
  if(typeof v!=="object")return String(v);
  if(Array.isArray(v))return "["+v.map(stable).join(",")+"]";
  return "{"+Object.keys(v).sort().map(k=>k+":"+stable(v[k])).join(",")+"}";
}
function hash(s){
  let h=2166136261>>>0;
  s=String(s||"");
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0).toString(16);
}
function getLexical(name){
  try{
    if(name==="APM_IMPORTED_DATA"&&typeof APM_IMPORTED_DATA!=="undefined")return APM_IMPORTED_DATA;
    if(name==="EMBEDDED_EXCEL_DATA"&&typeof EMBEDDED_EXCEL_DATA!=="undefined")return EMBEDDED_EXCEL_DATA;
    if(name==="AIP_INDEPENDENT_SYNTHETIC_DATA"&&typeof AIP_INDEPENDENT_SYNTHETIC_DATA!=="undefined")return AIP_INDEPENDENT_SYNTHETIC_DATA;
  }catch(_){}
  return window[name];
}
function activeMode(){
  const m=String(window.APM_DATA_MODE||window.AIP_DATA_MODE||"synthetic").toLowerCase();
  return m.includes("excel")?"excel":"synthetic";
}
function sourceObjects(){
  const out=[], seen=new Set();
  const add=(obj,label,priority)=>{
    if(!obj||typeof obj!=="object"||seen.has(obj))return;
    seen.add(obj);out.push({obj,label,priority});
  };
  const mode=activeMode();
  const imported=getLexical("APM_IMPORTED_DATA");
  const embedded=getLexical("EMBEDDED_EXCEL_DATA");
  const syn=getLexical("AIP_INDEPENDENT_SYNTHETIC_DATA");

  if(mode==="excel"&&imported&&Object.keys(imported).length){
    add(imported,"Excel",120);
  }else{
    try{add(syn?.platformSyntheticData,"Synthetic",120);}catch(_){}
    add(syn,"Synthetic",115);
    add(embedded,"Embedded governed data",105);
  }

  /* Runtime aliases/derived arrays are useful, but deliberately lower priority.
     Deduplication prevents mirrors becoming separate sources of truth. */
  [
    ["ASSET_REGISTRY","Runtime Asset Registry"],
    ["CREW_ROSTER","Runtime Crew Roster"],
    ["CREW_ASSIGNMENTS","Runtime Crew Assignments"],
    ["ALL_WOS","Runtime Work Orders"],
    ["SPARE_PARTS","Runtime Spare Parts"],
    ["PLANTS","Runtime Plants"],
    ["TELEMETRY_LOG","Runtime Telemetry"],
    ["ESG_TARGETS","Runtime ESG Targets"],
    ["DATA_DICTIONARY","Runtime Data Dictionary"]
  ].forEach(([n,l])=>{
    try{const v=eval(`typeof ${n}!=="undefined"?${n}:window["${n}"]`);if(Array.isArray(v)&&v.length)add({[l]:v},"Runtime",70);}catch(_){}
  });
  return out;
}
function collectArrays(obj,label,priority,prefix="",depth=0,out=[]){
  if(!obj||typeof obj!=="object"||depth>3)return out;
  for(const [k,v] of Object.entries(obj)){
    const path=prefix?`${prefix} / ${k}`:k;
    if(objectRows(v)){
      out.push({name:k,path,rows:v,source:label,priority});
    }else if(v&&typeof v==="object"&&!Array.isArray(v)){
      collectArrays(v,label,priority,path,depth+1,out);
    }
  }
  return out;
}
function fieldsOf(rows){
  const stats=new Map();
  (rows||[]).slice(0,500).forEach(r=>{
    if(!r||typeof r!=="object")return;
    Object.keys(r).forEach(k=>{
      if(!stats.has(k))stats.set(k,{field:k,populated:0,total:0,types:new Set(),examples:new Set()});
      const s=stats.get(k);s.total++;
      const v=r[k];
      if(v!==null&&v!==undefined&&String(v).trim()!==""){
        s.populated++;
        s.types.add(typeof v);
        if(s.examples.size<8&&String(v).length<80)s.examples.add(String(v));
      }
    });
  });
  return [...stats.values()].map(s=>({
    field:s.field,
    populated:s.populated,
    sampled:s.total,
    coverage:s.total?Math.round(1000*s.populated/s.total)/10:0,
    types:[...s.types],
    examples:[...s.examples],
    toks:expandTokens(tokens(s.field))
  }));
}
function idFields(entry){
  const fs=entry.fields.map(x=>x.field);
  const score=f=>{
    const n=compact(f);
    let s=0;
    GQ433.keyPriority.forEach((k,i)=>{if(compact(k)===n)s=Math.max(s,100-i);});
    if(/id$/.test(n))s=Math.max(s,20);
    return s;
  };
  return fs.filter(f=>score(f)>0).sort((a,b)=>score(b)-score(a));
}
function signature(entry){
  const rows=entry.rows||[];
  const schema=entry.fields.map(f=>compact(f.field)).sort().join("|");
  const picks=[];
  if(rows.length){picks.push(rows[0]);if(rows.length>2)picks.push(rows[Math.floor(rows.length/2)]);if(rows.length>1)picks.push(rows[rows.length-1]);}
  return hash(schema+"#"+rows.length+"#"+picks.map(stable).join("#"));
}
function familyName(name){
  const n=compact(name);
  const families=[
    ["sites","plantregistry","runtimeplants"],
    ["assetmaster","assetregistry","runtimeassetregistry","assets"],
    ["workorders","runtimeworkorders"],
    ["crewskills","crewrost","runtimecrewroster","pnotechnicianskills"],
    ["crewassignments","runtimecrewassignments"],
    ["spareparts","runtimespareparts","inventory"],
    ["watercleaning","suswatercleaning"],
    ["climaterisk","susclimateassetrisk"],
    ["telemetry","runtimetelemetry"]
  ];
  for(let i=0;i<families.length;i++)if(families[i].some(x=>n.includes(x)))return "fam"+i;
  return "";
}
function schemaSimilarity(a,b){
  const A=new Set(a.fields.map(x=>compact(x.field))),B=new Set(b.fields.map(x=>compact(x.field)));
  const inter=[...A].filter(x=>B.has(x)).length;
  const uni=new Set([...A,...B]).size||1;
  return inter/uni;
}
function keyOverlap(a,b){
  const af=idFields(a),bf=idFields(b);
  for(const fa of af.slice(0,4)){
    const ca=compact(fa);
    for(const fb of bf.slice(0,4)){
      if(ca!==compact(fb))continue;
      const A=new Set(a.rows.slice(0,3000).map(r=>String(r?.[fa]??"")).filter(Boolean));
      const B=new Set(b.rows.slice(0,3000).map(r=>String(r?.[fb]??"")).filter(Boolean));
      if(!A.size||!B.size)continue;
      let inter=0;A.forEach(v=>{if(B.has(v))inter++;});
      const ratio=inter/Math.min(A.size,B.size);
      return {ratio,fieldA:fa,fieldB:fb};
    }
  }
  return {ratio:0};
}
function buildCatalog(force=false){
  const mode=activeMode();
  const sources=sourceObjects();
  const sourceKey=mode+"|"+sources.map(s=>`${s.label}:${Object.keys(s.obj||{}).length}`).join("|");
  if(!force&&GQ433.cache&&GQ433.cacheKey===sourceKey)return GQ433.cache;

  let raw=[];
  sources.forEach(s=>collectArrays(s.obj,s.label,s.priority,"",0,raw));
  raw=raw.filter(e=>e.rows.length&&e.rows.some(r=>r&&typeof r==="object"));
  raw.forEach(e=>{
    e.fields=fieldsOf(e.rows);
    e.signature=signature(e);
    e.family=familyName(e.name);
    e.aliases=[];
    e.datasetTokens=expandTokens(tokens(e.name+" "+e.path+" "+e.fields.map(f=>f.field).join(" ")));
    const vals=[];
    e.fields.forEach(f=>f.examples.forEach(v=>{if(vals.length<80)vals.push(v)}));
    e.valueTokens=expandTokens(tokens(vals.join(" ")));
  });

  const sorted=raw.sort((a,b)=>b.priority-a.priority||b.rows.length-a.rows.length);
  const canonical=[];
  for(const e of sorted){
    let dup=null,reason="";
    for(const c of canonical){
      if(e.signature===c.signature){dup=c;reason="exact content signature";break;}
      const ko=keyOverlap(e,c);
      const fam=e.family&&c.family&&e.family===c.family;
      const sim=schemaSimilarity(e,c);
      /* Conservative mirror suppression:
         key overlap + schema similarity alone is NOT sufficient because two
         independent governed tables can legitimately share the same IDs.
         A transformed mirror must also belong to an explicit canonical family. */
      if(fam&&ko.ratio>=0.98&&sim>=0.45){
        dup=c;reason=`canonical mirror key overlap ${(ko.ratio*100).toFixed(0)}%`;break;
      }
      if(fam&&e.rows.length===c.rows.length&&sim>=0.70){
        dup=c;reason="canonical alias family";break;
      }
    }
    if(dup){
      dup.aliases.push({name:e.name,path:e.path,source:e.source,reason});
    }else{
      canonical.push(e);
    }
  }

  /* Join graph: only governed matching identifier fields. */
  const joins=[];
  for(let i=0;i<canonical.length;i++){
    for(let j=i+1;j<canonical.length;j++){
      const a=canonical[i],b=canonical[j];
      const k=keyOverlap(a,b);
      if(k.ratio>0){
        const ca=compact(k.fieldA), cb=compact(k.fieldB);
        const strong=(ca===cb)&&(/id$/.test(ca)||GQ433.keyPriority.some(x=>compact(x)===ca));
        if(strong)joins.push({a:i,b:j,fieldA:k.fieldA,fieldB:k.fieldB,overlap:k.ratio});
      }
    }
  }
  GQ433.cache={mode,rawCount:raw.length,datasets:canonical,joins,deduped:raw.length-canonical.length};
  GQ433.cacheKey=sourceKey;
  window.AIP_ASSISTANT_CATALOG=GQ433.cache;
  return GQ433.cache;
}
function datasetCoverage(entry,qTokens){
  const dt=new Set(entry.datasetTokens),vt=new Set(entry.valueTokens);
  const fieldCompact=entry.fields.map(f=>compact(f.field));
  const covered=new Set();let score=0;
  qTokens.forEach(t=>{
    const c=compact(t);
    if(fieldCompact.some(f=>f===c||f.includes(c)||c.includes(f))){
      covered.add(t);score+=c.length>8?8:4;
    }else if(["critical","high","medium","moderate","low"].includes(c)&&fieldCompact.some(f=>/priority|severity|riskband|risk|criticality/.test(f))){
      covered.add(t);score+=3;
    }else if(["open","closed","completed","planned","approved","scheduled"].includes(c)&&fieldCompact.some(f=>/status|state/.test(f))){
      covered.add(t);score+=3;
    }else if(dt.has(t)||dt.has(c)){covered.add(t);score+=3;}
    else if(vt.has(t)||vt.has(c)){covered.add(t);score+=1;}
  });
  return {score,covered};
}
function importantQueryTokens(q){
  const n=norm(q);
  const ts=expandTokens(tokens(q));
  const add=x=>{if(x&&!ts.includes(x))ts.push(x);};
  if(/\bwater stress(?:ed)?\b|\bwater stressed\b/.test(n)){add("waterstress");}
  if(/\bwater source\b|\bwater sources\b|\bsource water\b|\btake water\b|\bdraw water\b|\bwater from\b|\buse water\b/.test(n)){add("watersource");}
  if(/\bperformance ratio\b/.test(n)){add("performanceratio");}
  if(/\brevenue at risk\b|\brevenue exposure\b/.test(n)){add("revenueatrisk");}
  if(/\bwork orders?\b/.test(n)){add("workorder");}
  if(/\bcrew members?\b/.test(n)){add("crew");}
  if(/\bavoided emissions?\b|\bco2 avoided\b/.test(n)){add("avoidedemissions");}
  return ts.filter(t=>!GQ433.opWords.has(t)&&!/^\d+(?:\.\d+)?$/.test(t)&&!["yes","no","any","stressed","stress"].includes(t));
}
function joinBetween(cat,a,b){
  const ia=cat.datasets.indexOf(a),ib=cat.datasets.indexOf(b);
  return cat.joins
    .filter(j=>(j.a===ia&&j.b===ib)||(j.a===ib&&j.b===ia))
    .sort((x,y)=>y.overlap-x.overlap)[0]||null;
}
function selectDatasets(q){
  const cat=buildCatalog();
  const req=importantQueryTokens(q);
  const scored=cat.datasets.map(d=>({d,...datasetCoverage(d,req)})).filter(x=>x.score>0).sort((a,b)=>b.covered.size-a.covered.size||b.score-a.score||b.d.priority-a.d.priority);
  if(!scored.length)return {cat,req,selected:[],covered:new Set(),uncovered:req};

  /* Prefer the canonical dataset that directly represents the requested entity. */
  const entity=detectEntity(q);
  let first=scored[0];
  if(entity){
    const entityCandidates=scored.filter(x=>{
      const fset=new Set(x.d.fields.map(f=>compact(f.field)));
      return entity.keys.some(k=>fset.has(compact(k))) &&
        (entity.name!=="site" || /site|plant/i.test(x.d.name+" "+x.d.fields.map(f=>f.field).join(" ")));
    });
    if(entityCandidates.length){
      entityCandidates.sort((a,b)=>b.covered.size-a.covered.size||b.score-a.score||b.d.priority-a.d.priority);
      first=entityCandidates[0];
    }
  }

  /* Greedy set cover, while requiring a governed join for additional datasets. */
  const selected=[first.d], covered=new Set(first.covered);
  while(selected.length<3){
    let best=null,bestGain=0;
    for(const x of scored){
      if(selected.includes(x.d))continue;
      const gain=[...x.covered].filter(t=>!covered.has(t)).length;
      if(!gain)continue;
      const connected=selected.some(s=>joinBetween(cat,s,x.d));
      if(!connected)continue;
      if(gain>bestGain){best=x;bestGain=gain;}
    }
    if(!best)break;
    selected.push(best.d);best.covered.forEach(t=>covered.add(t));
  }
  const uncovered=req.filter(t=>!covered.has(t));
  return {cat,req,selected,covered,uncovered,scored};
}
function fieldMatch(entry,phraseTokens){
  let best=null,bestScore=0;
  for(const f of entry.fields){
    const ft=new Set(f.toks);
    let score=0;
    phraseTokens.forEach(t=>{if(ft.has(t)||ft.has(compact(t)))score+=3;});
    const fn=compact(f.field);
    const qp=compact(phraseTokens.join(" "));
    if(qp&&fn.includes(qp))score+=6;
    if(score>bestScore){best=f;bestScore=score;}
  }
  return bestScore?{...best,score:bestScore}:null;
}
function detectEntity(q){
  const n=norm(q);
  const defs=[
    {name:"site",rx:/\b(sites?|plants?|facilities|locations)\b/,keys:["Plant_ID","Site_ID"],labels:["Plant_Name","Site_Name","Plant_ID","Site_ID"]},
    {name:"asset",rx:/\b(assets?|equipment)\b/,keys:["Asset_ID"],labels:["Asset_Tag","Asset_ID","Description"]},
    {name:"work order",rx:/\b(work\s*orders?|maintenance\s*orders?|\bwo\b)\b/,keys:["Work_Order_ID","WO_ID","id"],labels:["Work_Order_ID","WO_ID","Description"]},
    {name:"technician",rx:/\b(technicians?|crew members?|crew|staff)\b/,keys:["Technician_ID","Crew_ID","id"],labels:["Technician_Name","Name","name","Technician_ID","Crew_ID"]},
    {name:"intervention",rx:/\binterventions?\b/,keys:["Intervention_ID"],labels:["Intervention_ID","Intervention_Name","Description"]},
    {name:"event",rx:/\bevents?\b/,keys:["Event_ID","HSE_Event_ID"],labels:["Event_ID","Description"]}
  ];
  return defs.find(x=>x.rx.test(n))||null;
}
function detectOperation(q){
  const n=norm(q);
  if(/\b(export|download|convert|create|make)\b/.test(n)&&/\b(excel|xlsx|word|docx|powerpoint|pptx|slide|slides)\b/.test(n))return "export";
  if(/\bhow many\b|\bcount\b|\bnumber of\b|\bare there any\b/.test(n))return "count";
  if(/\baverage\b|\bavg\b|\bmean\b/.test(n))return "average";
  if(/\bsum\b|\btotal (?:value|cost|amount|generation|water|revenue|exposure)\b/.test(n))return "sum";
  if(/\bmaximum\b|\bmax\b|\bhighest\b/.test(n))return "max";
  if(/\bminimum\b|\bmin\b|\blowest\b/.test(n))return "min";
  if(/\btop\s+\d+\b|\bbottom\s+\d+\b|\brank\b|\branking\b/.test(n))return "rank";
  if(/\b(show|list|listing|which|who|give me|let me know|display|tell me)\b/.test(n))return "list";
  return "";
}
function missingPhrase(q){
  const n=norm(q);
  const m=n.match(/\b(?:without|missing|lack(?:ing)?|don t have|do not have|not have|no)\s+([a-z0-9 ]{2,55}?)(?:\?|$|\bwho\b|\bthat\b|\bwhich\b|\bwith\b|\band\b)/);
  return m?tokens(m[1]):[];
}
function numericConditions(q,selected){
  const n=norm(q),out=[];
  const rx=/([a-z][a-z0-9 ]{1,55}?)\s*(>=|<=|>|<|=|above|over|greater than|more than|below|under|less than|at least|at most)\s*([0-9]+(?:\.[0-9]+)?)/g;
  let m;
  while((m=rx.exec(n))){
    const pt=tokens(m[1]).slice(-5);
    let best=null;
    selected.forEach(d=>{
      const f=fieldMatch(d,pt);
      if(f&&(!best||f.score>best.f.score))best={d,f};
    });
    if(best){
      const opMap={"above":">","over":">","greater than":">","more than":">","below":"<","under":"<","less than":"<","at least":">=","at most":"<="};
      out.push({dataset:best.d,field:best.f.field,op:opMap[m[2]]||m[2],value:Number(m[3]),desc:`${best.f.field} ${opMap[m[2]]||m[2]} ${m[3]}`});
    }
  }
  return out;
}
function textConditions(q,selected){
  const n=" "+norm(q)+" ", out=[], seen=new Set();

  const primary=selected[0];
  const semanticField=(words)=>{
    if(!primary)return null;
    return primary.fields.find(f=>words.some(w=>compact(f.field).includes(w)))||null;
  };
  ["critical","high","medium","moderate","low"].forEach(v=>{
    if(!n.includes(" "+v+" "))return;
    const f=semanticField(["priority","severity","riskband","risk","criticality"]);
    if(f){out.push({dataset:primary,field:f.field,op:"text",value:v,desc:`${f.field} = ${v}`});seen.add(primary.name+"|"+f.field+"|"+v);}
  });
  ["open","closed","completed","planned","approved","scheduled"].forEach(v=>{
    if(!n.includes(" "+v+" "))return;
    const f=semanticField(["status","state"]);
    if(f){out.push({dataset:primary,field:f.field,op:"text",value:v,desc:`${f.field} = ${v}`});seen.add(primary.name+"|"+f.field+"|"+v);}
  });
  selected.forEach(d=>{
    d.fields.forEach(f=>{
      const vals=f.examples.filter(v=>v.length>=2&&v.length<=50);
      for(const v of vals){
        const nv=norm(v);
        if(nv.length<3||["completed","active","yes","no","high","low","medium"].includes(nv)&&!n.includes(" "+nv+" "))continue;
        if(n.includes(" "+nv+" ")){
          const k=d.name+"|"+f.field+"|"+nv;
          if(!seen.has(k)){seen.add(k);out.push({dataset:d,field:f.field,op:"text",value:String(v),desc:`${f.field} = ${v}`});}
          break;
        }
      }
    });
  });
  /* Common categorical words are valid only when a matching field exists. */
  ["critical","high","medium","moderate","low","open","closed","planned","approved","corrective","preventive","predictive","adaptive"].forEach(v=>{
    if(!n.includes(" "+v+" "))return;
    let best=null;
    selected.forEach(d=>d.fields.forEach(f=>{
      if(f.examples.some(x=>norm(x)===v)){
        const score=/risk|band|priority|status|type|maintenance/i.test(f.field)?4:1;
        if(!best||score>best.score)best={dataset:d,field:f.field,score};
      }
    }));
    if(best&&!out.some(x=>x.dataset===best.dataset&&x.field===best.field&&norm(x.value)===v))
      out.push({dataset:best.dataset,field:best.field,op:"text",value:v,desc:`${best.field} = ${v}`});
  });
  return out;
}
function specialConditions(q,selected){
  const n=norm(q),out=[];
  /* Governed semantic rule: "water-stressed" without an explicit threshold
     means High/Critical on the available water-stress scale. */
  if(/\bwater stress(?:ed)?\b|\bwater stressed\b/.test(n)){
    let best=null;
    selected.forEach(d=>d.fields.forEach(f=>{
      const fn=compact(f.field);
      if(fn.includes("waterstress")){
        const score=fn.includes("15")?10:fn.includes("0100")?8:5;
        if(!best||score>best.score)best={dataset:d,field:f.field,score};
      }
    }));
    if(best){
      const vals=best.dataset.rows.map(r=>Number(r?.[best.field])).filter(Number.isFinite);
      const max=vals.length?Math.max(...vals):0;
      const threshold=max<=5?4:60;
      out.push({dataset:best.dataset,field:best.field,op:">=",value:threshold,desc:`${best.field} >= ${threshold} (High/Critical water-stress rule)`});
    }
  }
  if(/\bwater source\b|\bsource water\b|\btake water\b|\buse water\b|\bdraw water\b|\bwater from\b/.test(n)){
    selected.forEach(d=>{
      const sf=d.fields.find(f=>compact(f.field)==="watersource");
      if(sf)out.push({dataset:d,field:sf.field,op:"notemptywater",value:null,desc:`${sf.field} is a recorded applicable water source`});
    });
  }
  return out;
}
function applyCondition(row,c){
  const v=row?.[`${c.dataset.name}::${c.field}`]!==undefined?row[`${c.dataset.name}::${c.field}`]:row?.[c.field];
  if(c.op==="text")return norm(v)===norm(c.value)||norm(v).includes(norm(c.value));
  if(c.op==="notemptywater"){
    const s=norm(v);return !!s&&!["not applicable","na","n a","none","no"].includes(s);
  }
  const n=Number(v);
  if(!Number.isFinite(n))return false;
  if(c.op===">")return n>c.value;if(c.op===">=")return n>=c.value;
  if(c.op==="<")return n<c.value;if(c.op==="<=")return n<=c.value;
  return n===c.value;
}
function joinedRows(selection){
  const {cat,selected}=selection;
  if(!selected.length)return [];
  let rows=selected[0].rows.map(r=>namespaceRow(selected[0],r));
  for(let i=1;i<selected.length;i++){
    const d=selected[i];
    let link=null,baseDataset=null;
    for(let j=0;j<i;j++){
      const jj=joinBetween(cat,selected[j],d);
      if(jj){link=jj;baseDataset=selected[j];break;}
    }
    if(!link)return [];
    const fldBase=cat.datasets.indexOf(baseDataset)===link.a?link.fieldA:link.fieldB;
    const fldNew=cat.datasets.indexOf(d)===link.a?link.fieldA:link.fieldB;
    const idx=new Map();
    d.rows.forEach(r=>{
      const k=String(r?.[fldNew]??"");
      if(!k)return;if(!idx.has(k))idx.set(k,[]);idx.get(k).push(r);
    });
    const expanded=[];
    rows.forEach(r=>{
      const key=r[`${baseDataset.name}::${fldBase}`]??r[fldBase];
      const matches=idx.get(String(key??""))||[];
      matches.forEach(m=>expanded.push({...r,...namespaceRow(d,m)}));
    });
    rows=expanded;
  }
  return rows;
}
function namespaceRow(d,r){
  const o={};
  Object.entries(r||{}).forEach(([k,v])=>{o[`${d.name}::${k}`]=v;if(o[k]===undefined)o[k]=v;});
  return o;
}
function entityKey(row,entity,selected){
  if(entity){
    for(const k of entity.keys){
      for(const d of selected){
        const v=row[`${d.name}::${k}`]??row[k];
        if(v!==undefined&&v!==null&&String(v)!=="")return `${k}:${v}`;
      }
    }
  }
  /* Fallback to strongest common governed ID. */
  for(const k of GQ433.keyPriority){
    for(const d of selected){
      const v=row[`${d.name}::${k}`]??row[k];
      if(v!==undefined&&v!==null&&String(v)!=="")return `${k}:${v}`;
    }
  }
  return stable(row);
}
function distinctEntities(rows,entity,selected){
  const m=new Map();
  rows.forEach(r=>{const k=entityKey(r,entity,selected);if(!m.has(k))m.set(k,r);});
  return [...m.values()];
}
function displayColumns(rows,selected,entity,conditions,max=10){
  const cols=[];
  const add=(d,f,label)=>{
    const key=`${d.name}::${f}`;
    if(!cols.some(c=>c.key===key))cols.push({key,label:label||f,dataset:d.name,field:f});
  };
  if(entity){
    selected.forEach(d=>{
      entity.labels.forEach(f=>{if(d.fields.some(x=>x.field===f))add(d,f,f);});
      entity.keys.forEach(f=>{if(d.fields.some(x=>x.field===f))add(d,f,f);});
    });
  }
  conditions.forEach(c=>add(c.dataset,c.field,c.field));
  selected.forEach(d=>{
    d.fields.slice(0,4).forEach(f=>add(d,f.field,f.field));
  });
  return cols.slice(0,max);
}
function metricField(q,selected){
  const qt=importantQueryTokens(q).filter(t=>!["site","plant","asset","equipment","work","order","workorder","technician","crew","intervention","event"].includes(compact(t)));
  let best=null;
  selected.forEach(d=>d.fields.forEach(f=>{
    const numeric=f.types.includes("number")||f.examples.some(v=>Number.isFinite(Number(v)));
    if(!numeric)return;
    const ft=new Set(f.toks.map(compact));
    const fn=compact(f.field);
    let score=0;
    qt.forEach(t=>{
      const c=compact(t);
      if(ft.has(c))score+=5;
      if(fn===c)score+=8;
      else if(fn.includes(c)||c.includes(fn))score+=4;
    });
    if(score>0&&(!best||score>best.score))best={dataset:d,field:f.field,score};
  }));
  return best;
}
function gqPlanHtml(plan){
  try{return typeof gqPlanBox==="function"?gqPlanBox(plan):`<details><summary>Governed query plan & lineage</summary><pre>${esc(JSON.stringify(plan,null,2))}</pre></details>`;}
  catch(_){return "";}
}
function resultTable(cols,rows,limit=50){
  const shown=rows.slice(0,limit);
  try{
    if(typeof aiTable==="function"){
      return aiTable(cols.map(c=>c.label),shown.map(r=>cols.map(c=>r[c.key]??r[c.field]??"—")));
    }
  }catch(_){}
  return `<div style="overflow:auto"><table><thead><tr>${cols.map(c=>`<th>${esc(c.label)}</th>`).join("")}</tr></thead><tbody>${
    shown.map(r=>`<tr>${cols.map(c=>`<td>${esc(r[c.key]??r[c.field]??"—")}</td>`).join("")}</tr>`).join("")
  }</tbody></table></div>`;
}
function unsupportedHtml(msg,plan){
  return {html:`<b>${esc(msg)}</b>${gqPlanHtml(plan)}`,chart:null,queryPlan:plan};
}
function execute(qRaw){
  const q=String(qRaw||"").trim(), n=norm(q);
  const operation=detectOperation(q);
  if(operation==="export")return exportFromContext(q);

  const selection=selectDatasets(q);
  const entity=detectEntity(q);

  if(!selection.selected.length){
    const plan={intent:"Interpret natural-language request",datasets:[],joins:[],filters:[],grouping:[],calculations:[],
      validation:"No governed AIP dataset or field could be matched with sufficient confidence.",status:"Question not understood"};
    return unsupportedHtml("I could not reliably understand which governed AIP data you are asking about. Please rephrase the question.",plan);
  }

  /* Full-intent coverage gate. A few general nouns may remain uncovered, but
     material business concepts cannot be silently discarded. */
  const materialUncovered=selection.uncovered.filter(t=>!["site","plant","asset","work","order","technician","crew","intervention","event","month","year"].includes(t));
  if(materialUncovered.length){
    const plan={intent:`Interpret request across ${selection.selected.map(d=>d.name).join(" + ")}`,
      datasets:selection.selected.map(d=>d.name),joins:[],filters:[],grouping:[],calculations:[],
      validation:`Unresolved requested concept(s): ${materialUncovered.join(", ")}.`,status:"Question understood only partially",
      note:"Execution blocked to prevent an irrelevant substitute result."};
    return unsupportedHtml(`I understood part of the question, but I could not reliably map “${materialUncovered.join(", ")}” to governed AIP data. Please rephrase it, or the required data may not be available.`,plan);
  }

  if(!operation){
    const plan={intent:`Interpret request across ${selection.selected.map(d=>d.name).join(" + ")}`,
      datasets:selection.selected.map(d=>d.name),joins:[],filters:[],grouping:[],calculations:[],
      validation:"Dataset/concepts were recognized, but the requested operation was not clear enough to execute.",status:"Please rephrase"};
    return unsupportedHtml("I understood the subject area, but not what you want me to calculate or list. Please rephrase the question.",plan);
  }

  const joins=[];
  for(let i=1;i<selection.selected.length;i++){
    let jn=null;
    for(let j=0;j<i;j++){jn=joinBetween(selection.cat,selection.selected[j],selection.selected[i]);if(jn)break;}
    if(!jn){
      const plan={intent:"Cross-dataset governed query",datasets:selection.selected.map(d=>d.name),joins:["No safe governed identifier relationship"],filters:[],grouping:[],calculations:[],
        validation:"AIP will not invent a join.",status:"Data relationship unavailable"};
      return unsupportedHtml("I understood the datasets involved, but I cannot join them safely with the currently governed identifiers.",plan);
    }
    joins.push(`${selection.cat.datasets[jn.a].name}.${jn.fieldA} = ${selection.cat.datasets[jn.b].name}.${jn.fieldB}`);
  }

  let rows=joinedRows(selection);
  if(!rows.length){
    const plan={intent:"Execute governed query",datasets:selection.selected.map(d=>d.name),joins,filters:[],grouping:[],calculations:[],
      validation:"The selected governed datasets produced no linked records.",status:"No linked data"};
    return unsupportedHtml("I understood the question, but the required governed datasets have no linked records for this query.",plan);
  }

  const conditions=[
    ...numericConditions(q,selection.selected),
    ...textConditions(q,selection.selected),
    ...specialConditions(q,selection.selected)
  ];

  const miss=missingPhrase(q);
  if(miss.length){
    let best=null;
    selection.selected.forEach(d=>{
      const f=fieldMatch(d,miss);
      if(f&&(!best||f.score>best.f.score))best={d,f};
    });
    if(!best){
      const phrase=miss.join(" ");
      const plan={intent:"Missing-data query",datasets:selection.selected.map(d=>d.name),joins,filters:[],grouping:[],calculations:[],
        validation:`Requested missing-value concept “${phrase}” is not a governed field in the selected data.`,status:"Data not available"};
      return unsupportedHtml(`I understood that you are asking about missing ${phrase} data, but that governed field is not available in the relevant AIP dataset.`,plan);
    }
    conditions.push({dataset:best.d,field:best.f.field,op:"missing",value:null,desc:`${best.f.field} is blank / missing`});
  }

  conditions.forEach(c=>{
    if(c.op==="missing"){
      rows=rows.filter(r=>{
        const v=r[`${c.dataset.name}::${c.field}`]??r[c.field];
        const s=norm(v);return v===null||v===undefined||!s||["none","na","n a","missing","unknown","not available","not applicable"].includes(s);
      });
    }else rows=rows.filter(r=>applyCondition(r,c));
  });

  /* If query contained descriptive business concepts but produced no condition
     and asks for a count/list, don't default to arbitrary site/asset data. */
  const descriptive=importantQueryTokens(q).filter(t=>!["site","plant","asset","equipment","work","order","technician","crew","intervention","event"].includes(t));
  if(["count","list"].includes(operation)&&!conditions.length&&descriptive.length>1){
    const requestedFields=[];
    selection.selected.forEach(d=>d.fields.forEach(f=>{
      const mt=fieldMatch(d,descriptive);
      if(mt&&mt.field===f.field&&mt.score>=3)requestedFields.push(`${d.name}.${f.field}`);
    }));
    if(!requestedFields.length){
      const plan={intent:"Execute governed query",datasets:selection.selected.map(d=>d.name),joins,filters:[],grouping:[],calculations:[],
        validation:"No filter/attribute condition could be resolved from the full question.",status:"Question not understood safely"};
      return unsupportedHtml("I recognized the subject, but I could not reliably understand the full condition you are asking about. Please rephrase the question.",plan);
    }
  }

  const distinct=distinctEntities(rows,entity,selection.selected);
  const cols=displayColumns(distinct,selection.selected,entity,conditions);
  let html="", contextRows=distinct, summary="", calculations=[];
  const metric=metricField(q,selection.selected);

  if(operation==="count"){
    const count=distinct.length;
    summary=`${count} ${entity?entity.name+(count===1?"":"s"):"governed record"+(count===1?"":"s")} match the question.`;
    html=`<b>${esc(summary)}</b>`;
    if(count&&count<=50)html+=resultTable(cols,distinct,50);
    calculations.push(`Count distinct ${entity?entity.name:"record"} identifiers after all governed filters`);
  }else if(operation==="list"){
    summary=`Found ${distinct.length} matching ${entity?entity.name+(distinct.length===1?"":"s"):"governed records"}.`;
    html=`<b>${esc(summary)}</b>${resultTable(cols,distinct,50)}`;
    calculations.push("Return governed records matching the full interpreted condition");
  }else if(["average","sum","min","max","rank"].includes(operation)){
    if(!metric){
      const plan={intent:`${operation} calculation`,datasets:selection.selected.map(d=>d.name),joins,filters:conditions.map(c=>c.desc),grouping:[],calculations:[],
        validation:"The requested numeric metric could not be mapped confidently to a governed field.",status:"Please rephrase"};
      return unsupportedHtml("I understood the requested calculation, but not which governed numeric metric you want me to use. Please rephrase the metric.",plan);
    }
    const vals=rows.map(r=>({row:r,v:Number(r[`${metric.dataset.name}::${metric.field}`]??r[metric.field])})).filter(x=>Number.isFinite(x.v));
    if(!vals.length){
      const plan={intent:`${operation} ${metric.field}`,datasets:selection.selected.map(d=>d.name),joins,filters:conditions.map(c=>c.desc),grouping:[],calculations:[],
        validation:`No numeric values are available in ${metric.field} for the matched records.`,status:"Data not available"};
      return unsupportedHtml(`I understood the question, but ${metric.field} has no usable numeric data for the matched records.`,plan);
    }
    if(operation==="average"){
      const v=vals.reduce((s,x)=>s+x.v,0)/vals.length;summary=`Average ${metric.field}: ${v.toLocaleString("en-IN",{maximumFractionDigits:2})}.`;calculations.push(`Arithmetic mean of ${metric.field}`);
    }else if(operation==="sum"){
      const v=vals.reduce((s,x)=>s+x.v,0);summary=`Total ${metric.field}: ${v.toLocaleString("en-IN",{maximumFractionDigits:2})}.`;calculations.push(`Sum ${metric.field}`);
    }else if(operation==="min"||operation==="max"){
      const sorted=vals.sort((a,b)=>a.v-b.v);const x=operation==="min"?sorted[0]:sorted[sorted.length-1];
      summary=`${operation==="min"?"Minimum":"Maximum"} ${metric.field}: ${x.v.toLocaleString("en-IN",{maximumFractionDigits:2})}.`;
      contextRows=[x.row];calculations.push(`${operation} of ${metric.field}`);
    }else{
      const topm=norm(q).match(/\b(top|bottom)\s+(\d+)\b/);const N=topm?Number(topm[2]):10,desc=!(topm&&topm[1]==="bottom");
      const ranked=vals.sort((a,b)=>desc?b.v-a.v:a.v-b.v).slice(0,N).map(x=>x.row);
      contextRows=ranked;summary=`${desc?"Top":"Bottom"} ${ranked.length} records by ${metric.field}.`;calculations.push(`${desc?"Descending":"Ascending"} rank by ${metric.field}`);
    }
    const mcols=displayColumns(contextRows,selection.selected,entity,conditions);
    if(!mcols.some(c=>c.field===metric.field))mcols.push({key:`${metric.dataset.name}::${metric.field}`,label:metric.field,dataset:metric.dataset.name,field:metric.field});
    html=`<b>${esc(summary)}</b>${contextRows.length<=50?resultTable(mcols,contextRows,50):""}`;
    cols.splice(0,cols.length,...mcols);
  }

  const plan={
    intent:`${operation} query across governed AIP data`,
    datasets:selection.selected.map(d=>d.aliases.length?`${d.name} (canonical; ${d.aliases.length} duplicate/mirror alias${d.aliases.length===1?"":"es"} suppressed)`:d.name),
    joins,
    filters:conditions.length?conditions.map(c=>c.desc):["No additional filter"],
    grouping:entity?[`Distinct ${entity.name}`]:[],
    calculations,
    validation:`Full-intent gate passed. Catalog scanned ${selection.cat.rawCount} candidate datasets and retained ${selection.cat.datasets.length} canonical datasets; ${selection.cat.deduped} duplicate/mirror source${selection.cat.deduped===1?" was":"s were"} suppressed.`,
    status:"Executed"
  };
  html+=gqPlanHtml(plan);

  const ctxCols=cols.length?cols:displayColumns(contextRows,selection.selected,entity,conditions);
  GQ433.context={
    question:q,summary,plan,
    columns:ctxCols.map(c=>({label:c.label,key:c.key,field:c.field,dataset:c.dataset})),
    rows:contextRows.map(r=>{
      const o={};ctxCols.forEach(c=>o[c.label]=r[c.key]??r[c.field]??null);return o;
    }),
    generatedAt:new Date().toISOString()
  };
  window.GQ433_CONTEXT=GQ433.context;
  return {html,chart:null,queryPlan:plan,rawText:summary};
}

/* ---------------------- conversational follow-ups ---------------------- */
function isFollowup(q){
  const n=norm(q);
  return /\b(this|these|them|those|result|results|same|only|now|sort|filter)\b/.test(n)&&GQ433.context;
}
function followup(q){
  const ctx=GQ433.context||window.GQ433_CONTEXT;
  if(!ctx)return null;
  const n=norm(q);
  if(/\b(export|download|convert|excel|xlsx|word|docx|powerpoint|pptx|slide)\b/.test(n))return exportFromContext(q);
  return null; // non-export follow-up remains available for future deterministic extensions
}

/* ------------------------- governed exports ------------------------- */
function dlBlob(blob,name){
  const u=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),3000);
}
function xml(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function colRef(n){let s="";for(n++;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
async function exportXlsx(ctx){
  if(typeof JSZip==="undefined")throw new Error("Local export library unavailable.");
  const zip=new JSZip(), rows=ctx.rows||[], headers=ctx.columns.map(c=>c.label);
  const all=[headers,...rows.map(r=>headers.map(h=>r[h]))];
  const sheetRows=all.map((r,ri)=>`<row r="${ri+1}">${r.map((v,ci)=>{
    const ref=colRef(ci)+(ri+1);
    if(typeof v==="number"&&Number.isFinite(v))return `<c r="${ref}"><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t>${xml(v)}</t></is></c>`;
  }).join("")}</row>`).join("");
  const lineage=[
    ["Question",ctx.question],["Summary",ctx.summary],["Generated",ctx.generatedAt],
    ["Datasets",(ctx.plan.datasets||[]).join(" | ")],["Joins",(ctx.plan.joins||[]).join(" | ")],
    ["Filters",(ctx.plan.filters||[]).join(" | ")],["Calculations",(ctx.plan.calculations||[]).join(" | ")],
    ["Validation",ctx.plan.validation||""],["Status",ctx.plan.status||""]
  ];
  const linRows=lineage.map((r,ri)=>`<row r="${ri+1}">${r.map((v,ci)=>`<c r="${colRef(ci)+(ri+1)}" t="inlineStr"><is><t>${xml(v)}</t></is></c>`).join("")}</row>`).join("");
  zip.file("[Content_Types].xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  zip.folder("_rels").file(".rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.folder("xl").file("workbook.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Results" sheetId="1" r:id="rId1"/><sheet name="Lineage" sheetId="2" r:id="rId2"/></sheets></workbook>`);
  zip.folder("xl").folder("_rels").file("workbook.xml.rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`);
  zip.folder("xl").folder("worksheets").file("sheet1.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`);
  zip.folder("xl").folder("worksheets").file("sheet2.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${linRows}</sheetData></worksheet>`);
  const blob=await zip.generateAsync({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  dlBlob(blob,"AIP_Assistant_Result.xlsx");
}
async function exportDocx(ctx){
  if(typeof JSZip==="undefined")throw new Error("Local export library unavailable.");
  const zip=new JSZip(), headers=ctx.columns.map(c=>c.label), rows=(ctx.rows||[]).slice(0,200);
  const p=t=>`<w:p><w:r><w:t>${xml(t)}</w:t></w:r></w:p>`;
  const cell=t=>`<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>${p(t)}</w:tc>`;
  const table=`<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="B8C4CC"/><w:left w:val="single" w:sz="4" w:color="B8C4CC"/><w:bottom w:val="single" w:sz="4" w:color="B8C4CC"/><w:right w:val="single" w:sz="4" w:color="B8C4CC"/><w:insideH w:val="single" w:sz="4" w:color="D8E0E5"/><w:insideV w:val="single" w:sz="4" w:color="D8E0E5"/></w:tblBorders></w:tblPr><w:tr>${headers.map(cell).join("")}</w:tr>${rows.map(r=>`<w:tr>${headers.map(h=>cell(r[h]??"")).join("")}</w:tr>`).join("")}</w:tbl>`;
  const body=p("AIP Assistant Result")+p(ctx.question)+p(ctx.summary)+table+p("Governed lineage")+p("Datasets: "+(ctx.plan.datasets||[]).join(" | "))+p("Joins: "+(ctx.plan.joins||[]).join(" | "))+p("Filters: "+(ctx.plan.filters||[]).join(" | "))+p("Validation: "+(ctx.plan.validation||""));
  zip.file("[Content_Types].xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.folder("_rels").file(".rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.folder("word").file("document.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`);
  const blob=await zip.generateAsync({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
  dlBlob(blob,"AIP_Assistant_Result.docx");
}
async function exportPptx(ctx){
  if(typeof PptxGenJS==="undefined")throw new Error("Local PowerPoint export library unavailable.");
  const pptx=new PptxGenJS();pptx.layout="LAYOUT_WIDE";pptx.author="AIP";pptx.subject="Governed Assistant result";pptx.title="AIP Assistant Result";
  let slide=pptx.addSlide();slide.background={color:"FFFFFF"};
  slide.addText("AIP Assistant Result",{x:.55,y:.35,w:12.2,h:.4,fontFace:"Arial",fontSize:24,bold:true,color:"0A3D62"});
  slide.addText(ctx.question,{x:.55,y:.9,w:12.1,h:.55,fontFace:"Arial",fontSize:15,bold:true,color:"263238",breakLine:false});
  slide.addText(ctx.summary||"",{x:.55,y:1.55,w:12.1,h:.5,fontFace:"Arial",fontSize:14,color:"246A46"});
  const headers=ctx.columns.slice(0,6).map(c=>c.label), rows=(ctx.rows||[]).slice(0,8).map(r=>headers.map(h=>String(r[h]??"")));
  if(headers.length&&rows.length){
    slide.addTable([headers,...rows],{x:.55,y:2.15,w:12.1,h:4.4,border:{type:"solid",pt:.5,color:"CBD5DB"},fontFace:"Arial",fontSize:9,color:"263238",fill:"FFFFFF",margin:.05,bold:false,rowH:.38});
  }else slide.addText("No tabular result available.",{x:.55,y:2.2,w:8,h:.4,fontFace:"Arial",fontSize:12});
  slide=pptx.addSlide();slide.background={color:"FFFFFF"};
  slide.addText("Governed Query Lineage",{x:.55,y:.35,w:12,h:.4,fontFace:"Arial",fontSize:22,bold:true,color:"0A3D62"});
  const lines=[
    ["Datasets",(ctx.plan.datasets||[]).join(" | ")],["Joins",(ctx.plan.joins||[]).join(" | ")],["Filters",(ctx.plan.filters||[]).join(" | ")],
    ["Calculations",(ctx.plan.calculations||[]).join(" | ")],["Validation",ctx.plan.validation||""],["Status",ctx.plan.status||""]
  ];
  let y=1.1;lines.forEach(([a,b])=>{slide.addText(a,{x:.65,y,w:2.0,h:.32,fontFace:"Arial",fontSize:11,bold:true,color:"455A64"});slide.addText(b||"—",{x:2.5,y,w:10.0,h:.55,fontFace:"Arial",fontSize:10,color:"263238",breakLine:false});y+=.78;});
  await pptx.writeFile({fileName:"AIP_Assistant_Result.pptx"});
}
function exportFromContext(q){
  const ctx=GQ433.context||window.GQ433_CONTEXT;
  if(!ctx||!ctx.rows){
    const plan={intent:"Export previous Assistant result",datasets:[],joins:[],filters:[],grouping:[],calculations:[],validation:"No governed result set is currently available.",status:"Nothing to export"};
    return unsupportedHtml("There is no previous governed result set to export. Ask a data question first.",plan);
  }
  const n=norm(q);
  let type=/\b(word|docx|document)\b/.test(n)?"word":/\b(powerpoint|pptx|slide|slides)\b/.test(n)?"powerpoint":/\b(excel|xlsx|spreadsheet)\b/.test(n)?"excel":"";
  if(!type){
    const plan={intent:"Export previous Assistant result",datasets:ctx.plan.datasets||[],joins:ctx.plan.joins||[],filters:ctx.plan.filters||[],grouping:[],calculations:[],validation:"Export format was not specified.",status:"Please specify format"};
    return unsupportedHtml("I can export the current governed result. Please say Excel, Word, or PowerPoint.",plan);
  }
  const promise=type==="excel"?exportXlsx(ctx):type==="word"?exportDocx(ctx):exportPptx(ctx);
  Promise.resolve(promise).catch(e=>{console.error("AIP export failed",e);try{showToast?.("Export failed",String(e.message||e))}catch(_){}});
  const plan={intent:`Export previous governed result to ${type}`,datasets:ctx.plan.datasets||[],joins:ctx.plan.joins||[],filters:ctx.plan.filters||[],grouping:[],calculations:["Preserve the governed result set and lineage in the exported artifact"],validation:`${ctx.rows.length} result row(s) prepared for export.`,status:"Export initiated"};
  return {html:`<b>${type==="excel"?"Excel workbook":type==="word"?"Word document":"PowerPoint presentation"} export has been prepared from the current governed result.</b>${gqPlanHtml(plan)}`,chart:null,queryPlan:plan,rawText:`${type} export initiated`};
}

/* -------------------- replace unsafe v432 routing -------------------- */
function offline433(q){
  const f=followup(q);if(f)return f;
  const result=execute(q);
  if(result)return result;
  const plan={intent:"Interpret natural-language request",datasets:[],joins:[],filters:[],grouping:[],calculations:[],validation:"No safe governed execution path was found.",status:"Please rephrase"};
  return unsupportedHtml("I could not reliably understand the question. Please rephrase it.",plan);
}
try{
  governedComplexQuery=function(q){return execute(q)};
  genericOfflineAnalysis=function(q){return execute(q)};
  offlineAnswer=function(q){
    const r=offline433(q);
    const rawText=r.rawText||String(r.html||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
    return {...r,rawText};
  };
}catch(e){console.error("AIP v433 Assistant override failed",e);}

window.AIP_GQ433={
  buildCatalog,
  execute,
  exportCurrent:(type)=>exportFromContext(`export this to ${type}`),
  getContext:()=>GQ433.context||window.GQ433_CONTEXT,
  resetCatalog:()=>{GQ433.cache=null;GQ433.cacheKey="";return buildCatalog(true);}
};
window.AIP_V433_AUDIT={
  release:"v433",baseline:"v432",
  scope:"Whole-application governed Assistant architecture",
  capabilities:[
    "Dynamic catalog across active Excel or Synthetic/embedded data",
    "Automatic field/schema discovery instead of a fixed five-domain registry",
    "Duplicate/mirror dataset suppression using content signature, canonical aliases, schema similarity and governed ID overlap",
    "Governed join graph built from matching identifier fields such as Plant_ID, Asset_ID, Work_Order_ID and Intervention_ID",
    "Full-intent validation before execution; partial entity matches cannot trigger unrelated default metrics",
    "Cross-dataset natural-language queries with safe joins",
    "Explicit distinction between question not understood, data unavailable, relationship unavailable and executed result",
    "Conversational export of the current governed result to XLSX, DOCX or PPTX",
    "Export includes query lineage and uses only the current governed result set"
  ],
  safetyRules:[
    "No arbitrary Performance Ratio fallback",
    "No substitution of an unrelated field for an unresolved concept",
    "No invented cross-dataset join",
    "No double-counting from detected duplicate/mirror datasets",
    "No export of a result set that has not been produced by a governed query"
  ]
};
})();
