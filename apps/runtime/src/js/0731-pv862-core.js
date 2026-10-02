(function(root){
 'use strict';
 const SCHEMA={
  PV_Module_Groups:['Group_ID','Group_Name','Plant_ID','Block','Status','Data_Basis','Reported_Quantity','Source_Sheet','Source_Record_ID','Source_Asset_ID','Commission_Year','Notes'],
  PV_Module_Models:['Model_ID','Manufacturer','Model_Name','Technology','Rated_Wp','Unit_Mass_kg','Document_Reference'],
  PV_Population_Segments:['Segment_ID','Group_ID','Model_ID','Batch_ID','Installation_Date','Balance_As_Of','Opening_Quantity','Evidence_Reference'],
  PV_Module_Register:['Module_ID','Segment_ID','Serial_Number','Position','Installed_Date','Removed_Date','Evidence_Reference'],
  PV_Lifecycle_Events:['Event_ID','Segment_ID','Event_Date','Event_Type','Quantity','Module_ID','Related_Event_ID','Evidence_Reference','Notes'],
  PV_Batch_Allocations:['Allocation_ID','Segment_ID','Batch_ID','Shipment_ID','Quantity','Receipt_Date','Supplier','Evidence_Reference'],
  PV_Defect_Catalog:['Defect_Code','Category','Description','Component','Suggested_Evidence','Failure_Review_Required']
 };
 const TYPES={Install:1,Remove:-1,Transfer_In:1,Transfer_Out:-1,Repair:0,Inspect:0,Clean:0};
 const str=x=>String(x??'').trim();
 const number=x=>str(x)===''?null:Number(x);
 const integer=x=>number(x)!==null&&Number.isSafeInteger(number(x))&&number(x)>=0;
 function date(x){
  if(x instanceof Date)return isNaN(+x)?null:x.toISOString().slice(0,10);
  if(typeof x==='number'&&x>0&&x<100000)return new Date(Date.UTC(1899,11,30)+x*86400000).toISOString().slice(0,10);
  const s=str(x);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;
  const d=new Date(s+'T00:00:00Z');return !isNaN(+d)&&d.toISOString().slice(0,10)===s?s:null;
 }
 function normalize(input){const data={};for(const [name,fields] of Object.entries(SCHEMA))data[name]=(input[name]||[]).map(r=>Object.fromEntries(fields.map(f=>[f,/(?:_Date|Balance_As_Of)$/.test(f)&&str(r[f])?date(r[f])||str(r[f]):/(?:_ID|_Code)$/.test(f)?str(r[f]):r[f]??''])));return data}
 function validate(input,siteIds){
  const errors=[],data=normalize(input),maps={};
  const error=(sheet,row,field,message)=>errors.push({sheet,row:row+2,field,message});
  for(const [sheet,fields] of Object.entries(SCHEMA)){
   maps[sheet]=new Map();data[sheet].forEach((r,i)=>{const id=str(r[fields[0]]);if(!id)error(sheet,i,fields[0],'ID is required');else if(maps[sheet].has(id))error(sheet,i,fields[0],'Duplicate ID');else maps[sheet].set(id,r);
    for(const f of fields)if(/(?:_Date|Balance_As_Of)$/.test(f)&&str(r[f])&&!date(r[f]))error(sheet,i,f,'Use a valid YYYY-MM-DD date or Excel date');
   });
  }
  const groups=maps.PV_Module_Groups,models=maps.PV_Module_Models,segs=maps.PV_Population_Segments,mods=maps.PV_Module_Register;
  const ref=(sheet,i,r,field,map,required=true)=>{if(!str(r[field])&&!required)return;if(!map.has(str(r[field])))error(sheet,i,field,'Reference not found')};
  data.PV_Module_Groups.forEach((r,i)=>{
   if(!str(r.Group_Name))error('PV_Module_Groups',i,'Group_Name','Name is required');
   if(!str(r.Plant_ID)||siteIds&&!siteIds.includes(str(r.Plant_ID)))error('PV_Module_Groups',i,'Plant_ID','Site is not in the active site register');
   if(!['Pending reconciliation','Verified'].includes(r.Status))error('PV_Module_Groups',i,'Status','Use Pending reconciliation or Verified');
   if(!['Demonstration','Operational'].includes(r.Data_Basis))error('PV_Module_Groups',i,'Data_Basis','Use Demonstration or Operational');
   if(str(r.Reported_Quantity)&&!integer(r.Reported_Quantity))error('PV_Module_Groups',i,'Reported_Quantity','Use a non-negative whole quantity');
   if(str(r.Commission_Year)&&(!integer(r.Commission_Year)||+r.Commission_Year<1900||+r.Commission_Year>2200))error('PV_Module_Groups',i,'Commission_Year','Invalid year');
   if(r.Status==='Verified'&&!data.PV_Population_Segments.some(s=>s.Group_ID===r.Group_ID))error('PV_Module_Groups',i,'Status','Verified groups require an evidenced population segment');
  });
  data.PV_Module_Models.forEach((r,i)=>{for(const f of ['Manufacturer','Model_Name'])if(!str(r[f]))error('PV_Module_Models',i,f,'Required');if(!(number(r.Rated_Wp)>0&&Number.isFinite(number(r.Rated_Wp))))error('PV_Module_Models',i,'Rated_Wp','Positive wattage is required');if(str(r.Unit_Mass_kg)&&!(number(r.Unit_Mass_kg)>0&&Number.isFinite(number(r.Unit_Mass_kg))))error('PV_Module_Models',i,'Unit_Mass_kg','Use positive kg or leave unknown')});
  data.PV_Population_Segments.forEach((r,i)=>{
   ref('PV_Population_Segments',i,r,'Group_ID',groups);ref('PV_Population_Segments',i,r,'Model_ID',models);
   if(!integer(r.Opening_Quantity))error('PV_Population_Segments',i,'Opening_Quantity','Non-negative whole quantity required');
   if(!date(r.Balance_As_Of))error('PV_Population_Segments',i,'Balance_As_Of','Opening balance date required');
   if(+r.Opening_Quantity>0&&date(r.Installation_Date)&&date(r.Balance_As_Of)&&r.Installation_Date>r.Balance_As_Of)error('PV_Population_Segments',i,'Installation_Date','Installed opening quantity cannot precede installation');
   if(!str(r.Evidence_Reference))error('PV_Population_Segments',i,'Evidence_Reference','Population evidence required');
  });
  const serials=new Set();data.PV_Module_Register.forEach((r,i)=>{
   ref('PV_Module_Register',i,r,'Segment_ID',segs);const seg=segs.get(str(r.Segment_ID)),m=seg&&models.get(str(seg.Model_ID));
   if(str(r.Serial_Number)){const k=str(m?.Manufacturer).toLowerCase()+'|'+str(r.Serial_Number).toLowerCase();if(serials.has(k))error('PV_Module_Register',i,'Serial_Number','Duplicate manufacturer serial');serials.add(k)}
   if(!str(r.Serial_Number)&&!str(r.Position))error('PV_Module_Register',i,'Position','Serial number or physical position required');
   if(!date(r.Installed_Date))error('PV_Module_Register',i,'Installed_Date','Installation date required for identified members');
   if(seg&&date(seg.Installation_Date)&&date(r.Installed_Date)&&seg.Installation_Date!==r.Installed_Date)error('PV_Module_Register',i,'Installed_Date','Member installation date differs from the segment vintage');
   if(date(r.Removed_Date)&&r.Removed_Date<r.Installed_Date)error('PV_Module_Register',i,'Removed_Date','Removal precedes installation');
   if(!str(r.Evidence_Reference))error('PV_Module_Register',i,'Evidence_Reference','Identity evidence required');
   if(seg){for(const [field,types] of [['Installed_Date',['Install','Transfer_In']],['Removed_Date',['Remove','Transfer_Out']]])if(date(r[field])&&r[field]>seg.Balance_As_Of&&!data.PV_Lifecycle_Events.some(e=>e.Module_ID===r.Module_ID&&e.Event_Date===r[field]&&types.includes(e.Event_Type)))error('PV_Module_Register',i,field,'Member movement after opening requires a matching lifecycle event');}
  });
  const movements=new Set(),positions=new Map();
  data.PV_Module_Register.forEach((r,i)=>{if(!str(r.Position))return;const key=segs.get(r.Segment_ID)?.Group_ID+'|'+str(r.Position),previous=positions.get(key)||[];const duplicate=previous.some(m=>m.Installed_Date<(r.Removed_Date||'9999-12-31')&&r.Installed_Date<(m.Removed_Date||'9999-12-31'));if(duplicate)error('PV_Module_Register',i,'Position','Overlapping members occupy the same group position');previous.push(r);positions.set(key,previous);});
  data.PV_Lifecycle_Events.forEach((r,i)=>{
   if(str(r.Module_ID)&&['Install','Remove'].includes(r.Event_Type)){const key=r.Module_ID+'|'+r.Event_Type;if(movements.has(key))error('PV_Lifecycle_Events',i,'Module_ID','Duplicate member movement');movements.add(key);}
   ref('PV_Lifecycle_Events',i,r,'Segment_ID',segs);ref('PV_Lifecycle_Events',i,r,'Module_ID',mods,false);
   if(!Object.hasOwn(TYPES,r.Event_Type))error('PV_Lifecycle_Events',i,'Event_Type','Unsupported event type');
   if(!integer(r.Quantity)||+r.Quantity===0)error('PV_Lifecycle_Events',i,'Quantity','Positive whole quantity required');
   if(!date(r.Event_Date))error('PV_Lifecycle_Events',i,'Event_Date','Event date required');
   const seg=segs.get(str(r.Segment_ID));if(seg&&date(r.Event_Date)&&r.Event_Date<=seg.Balance_As_Of)error('PV_Lifecycle_Events',i,'Event_Date','Events must follow the opening balance date');
   if(seg&&r.Event_Type==='Install'&&(!date(seg.Installation_Date)||seg.Installation_Date!==r.Event_Date))error('PV_Lifecycle_Events',i,'Event_Date','New installations require their own segment with matching installation date');
   if(!str(r.Evidence_Reference))error('PV_Lifecycle_Events',i,'Evidence_Reference','Event evidence required');
   if(str(r.Module_ID)){const m=mods.get(str(r.Module_ID));if(m&&(m.Segment_ID!==r.Segment_ID||+r.Quantity!==1))error('PV_Lifecycle_Events',i,'Module_ID','Identified member must belong to this segment and quantity must be one');if(m&&['Install','Transfer_In'].includes(r.Event_Type)&&m.Installed_Date!==r.Event_Date)error('PV_Lifecycle_Events',i,'Module_ID','Member installation date must match event');if(m&&['Remove','Transfer_Out'].includes(r.Event_Type)&&m.Removed_Date!==r.Event_Date)error('PV_Lifecycle_Events',i,'Module_ID','Member removal date must match event');if(m&&TYPES[r.Event_Type]===0&&(r.Event_Date<m.Installed_Date||m.Removed_Date&&r.Event_Date>=m.Removed_Date))error('PV_Lifecycle_Events',i,'Module_ID','Activity falls outside member installation interval');if(['Transfer_In','Transfer_Out'].includes(r.Event_Type))error('PV_Lifecycle_Events',i,'Module_ID','Serialized transfers require membership history; use quantity transfer without a Module_ID in this foundation release');}
   if(['Transfer_In','Transfer_Out'].includes(r.Event_Type)){const p=maps.PV_Lifecycle_Events.get(str(r.Related_Event_ID));if(!p||p.Related_Event_ID!==r.Event_ID||p.Event_Type!==(r.Event_Type==='Transfer_In'?'Transfer_Out':'Transfer_In')||p.Segment_ID===r.Segment_ID||+p.Quantity!==+r.Quantity||p.Event_Date!==r.Event_Date)error('PV_Lifecycle_Events',i,'Related_Event_ID','Transfer requires a reciprocal, same-date, equal-quantity event in another segment');else{const other=segs.get(p.Segment_ID);if(seg&&other&&(seg.Model_ID!==other.Model_ID||seg.Batch_ID!==other.Batch_ID||seg.Installation_Date!==other.Installation_Date))error('PV_Lifecycle_Events',i,'Related_Event_ID','Transfer must preserve model, batch and installation vintage')}}
  });
  data.PV_Batch_Allocations.forEach((r,i)=>{ref('PV_Batch_Allocations',i,r,'Segment_ID',segs);if(!str(r.Batch_ID)&&!str(r.Shipment_ID))error('PV_Batch_Allocations',i,'Batch_ID','Batch or shipment reference required');if(!integer(r.Quantity)||+r.Quantity===0)error('PV_Batch_Allocations',i,'Quantity','Positive whole quantity required');if(!str(r.Evidence_Reference))error('PV_Batch_Allocations',i,'Evidence_Reference','Allocation evidence required');const seg=segs.get(str(r.Segment_ID));if(seg&&str(seg.Batch_ID)&&str(r.Batch_ID)&&seg.Batch_ID!==r.Batch_ID)error('PV_Batch_Allocations',i,'Batch_ID','Batch differs from segment');});
  data.PV_Defect_Catalog.forEach((r,i)=>{if(!['Condition','Observation','Defect','Degradation','External damage'].includes(r.Category))error('PV_Defect_Catalog',i,'Category','Unknown category');if(r.Failure_Review_Required!=='Yes')error('PV_Defect_Catalog',i,'Failure_Review_Required','Failure classification must require review')});
  for(const seg of data.PV_Population_Segments){
   let bal=number(seg.Opening_Quantity)||0;const ev=data.PV_Lifecycle_Events.filter(e=>e.Segment_ID===seg.Segment_ID).sort((a,b)=>str(a.Event_Date).localeCompare(str(b.Event_Date))||str(a.Event_ID).localeCompare(str(b.Event_ID)));
   const days=[...new Set([seg.Balance_As_Of,...ev.map(e=>e.Event_Date),...data.PV_Module_Register.filter(m=>m.Segment_ID===seg.Segment_ID).flatMap(m=>[m.Installed_Date,m.Removed_Date]).filter(d=>d&&d>=seg.Balance_As_Of)])].sort();
   for(const day of days){const es=ev.filter(e=>e.Event_Date===day);for(const e of es)bal+=(TYPES[e.Event_Type]||0)*Number(e.Quantity||0);if(bal<0)error('PV_Population_Segments',data.PV_Population_Segments.indexOf(seg),'Opening_Quantity','Negative balance on '+day);
    const identified=data.PV_Module_Register.filter(m=>m.Segment_ID===seg.Segment_ID&&m.Installed_Date<=day&&(!m.Removed_Date||m.Removed_Date>day)).length;
    if(identified>bal)error('PV_Population_Segments',data.PV_Population_Segments.indexOf(seg),'Opening_Quantity','Identified members exceed installed quantity on '+day);
    for(const e of es)if(TYPES[e.Event_Type]===0&&+e.Quantity>bal)error('PV_Lifecycle_Events',data.PV_Lifecycle_Events.indexOf(e),'Quantity','Activity quantity exceeds installed population');
   }
  }
  return {valid:errors.length===0,errors,data};
 }
 function balance(data,segment,asOf){if(!date(asOf)||segment.Balance_As_Of>asOf)return null;return Number(segment.Opening_Quantity)+data.PV_Lifecycle_Events.filter(e=>e.Segment_ID===segment.Segment_ID&&e.Event_Date<=asOf).reduce((n,e)=>n+(TYPES[e.Event_Type]||0)*Number(e.Quantity),0)}
 function summary(data,group,asOf){const segs=data.PV_Population_Segments.filter(s=>s.Group_ID===group.Group_ID),values=segs.map(s=>balance(data,s,asOf));const known=group.Status==='Verified'&&segs.length>0&&values.every(v=>v!==null);const quantity=known?values.reduce((a,b)=>a+b,0):null;const identified=data.PV_Module_Register.filter(m=>segs.some(s=>s.Segment_ID===m.Segment_ID)&&m.Installed_Date<=asOf&&(!m.Removed_Date||m.Removed_Date>asOf)).length;return{quantity,identified,segments:segs.length,dcMW:known?segs.reduce((n,s,i)=>n+values[i]*Number(data.PV_Module_Models.find(m=>m.Model_ID===s.Model_ID)?.Rated_Wp||0)/1e6,0):null}}
 const api={SCHEMA,TYPES,date,normalize,validate,balance,summary};if(typeof module==='object'&&module.exports)module.exports=api;else root.AIP_PV862_CORE=Object.freeze(api);
})(typeof window==='object'?window:globalThis);
