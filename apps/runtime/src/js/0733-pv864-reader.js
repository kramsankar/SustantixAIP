(function(){
 'use strict';
 // Local, read-only OOXML reader, used by the existing Data Management upload.
 async function read(buffer,schema){
  const bytes=new Uint8Array(buffer),v=new DataView(buffer),decoder=new TextDecoder(),entries=new Map();
  let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50){end=i;break}
  if(end<0)throw new Error('Choose an unencrypted .xlsx workbook.');
  let pos=v.getUint32(end+16,true);const count=v.getUint16(end+10,true);if(count>10000)throw new Error('Workbook contains too many parts.');
  for(let i=0;i<count;i++){
   if(v.getUint32(pos,true)!==0x02014b50)throw new Error('Invalid workbook archive.');
   const flags=v.getUint16(pos+8,true),method=v.getUint16(pos+10,true),size=v.getUint32(pos+20,true),expanded=v.getUint32(pos+24,true),nl=v.getUint16(pos+28,true),el=v.getUint16(pos+30,true),cl=v.getUint16(pos+32,true),offset=v.getUint32(pos+42,true);
   const name=decoder.decode(bytes.subarray(pos+46,pos+46+nl));entries.set(name,{flags,method,size,expanded,offset});pos+=46+nl+el+cl;
  }
  let total=0;
  async function xml(name,optional=false){
   const e=entries.get(name);if(!e){if(optional)return null;throw new Error('Workbook part missing: '+name)}
   if(e.flags&1)throw new Error('Encrypted workbooks are unsupported.');
   if(e.expanded>50*1024*1024||(total+=e.expanded)>100*1024*1024)throw new Error('Module workbook contents exceed the read limit.');
   const p=e.offset;if(v.getUint32(p,true)!==0x04034b50)throw new Error('Invalid workbook part.');
   const start=p+30+v.getUint16(p+26,true)+v.getUint16(p+28,true),compressed=bytes.slice(start,start+e.size);
   let raw;if(e.method===0)raw=compressed;else if(e.method===8){const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));const reader=stream.getReader(),chunks=[];let length=0;while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>e.expanded||length>50*1024*1024){await reader.cancel();throw new Error('Invalid expanded workbook size.')}chunks.push(value)}raw=new Uint8Array(length);let at=0;for(const c of chunks){raw.set(c,at);at+=c.length}}else throw new Error('Unsupported workbook compression.');
   if(raw.length!==e.expanded)throw new Error('Workbook part size mismatch.');
   const doc=new DOMParser().parseFromString(decoder.decode(raw),'application/xml');if(doc.getElementsByTagName('parsererror').length)throw new Error('Invalid workbook XML.');return doc;
  }
  const all=(el,name)=>[...el.getElementsByTagNameNS('*',name)];
  const wb=await xml('xl/workbook.xml'),rels=await xml('xl/_rels/workbook.xml.rels'),strings=await xml('xl/sharedStrings.xml',true);
  const ss=strings?all(strings,'si').map(si=>all(si,'t').map(t=>t.textContent).join('')):[];
  const relationships=new Map(all(rels,'Relationship').filter(r=>r.getAttribute('TargetMode')!=='External').map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));
  const date1904=['1','true'].includes(all(wb,'workbookPr')[0]?.getAttribute('date1904')),sheets=all(wb,'sheet'),data={};
  for(const [name,fields] of Object.entries(schema)){
   const sheet=sheets.find(s=>s.getAttribute('name')===name);if(!sheet)continue;
   const target=relationships.get(sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id'));if(!target)throw new Error('Missing worksheet relationship: '+name);
   const parts=(target.startsWith('/')?target.slice(1):'xl/'+target).split('/'),normalized=[];for(const p of parts){if(p==='..')normalized.pop();else if(p&&p!=='.')normalized.push(p)}
   const doc=await xml(normalized.join('/')),rows=all(doc,'row');if(rows.length>20001)throw new Error(name+': maximum 20,000 data rows.');
   const matrix=rows.map(row=>{const cells=[];for(const c of all(row,'c')){const address=c.getAttribute('r')||'',letters=address.match(/^[A-Z]+/)?.[0];if(!letters)throw new Error(name+': cell address missing');let col=0;for(const letter of letters)col=col*26+letter.charCodeAt(0)-64;if(col>512)throw new Error(name+': too many columns');if(all(c,'f').length&&name.startsWith('PV_'))throw new Error(name+': module master records require entered values.');const t=c.getAttribute('t'),s=all(c,'v')[0]?.textContent??'';let value=t==='inlineStr'?all(c,'t').map(x=>x.textContent).join(''):t==='s'?ss[Number(s)]:t==='b'?s==='1':t==='e'?null:t==='str'||t==='d'?s:s===''?'':Number(s);if(value===null||value===undefined)throw new Error(name+': invalid cell value at '+address);cells[col-1]=value;}return {row:Number(row.getAttribute('r')),cells}});
   const native=window.AIP_PV864?.nativeFields(name);const head=matrix.find(r=>fields.every(f=>r.cells.includes(f))||native?.every(f=>r.cells.includes(f)));if(!head)throw new Error(name+': required column headers missing: '+fields.join(', '));
   const header=head.cells.map(v=>String(v??''));
   data[name]=matrix.filter(r=>r.row>head.row&&r.cells.some(x=>x!==''&&x!==undefined)).map(r=>({...Object.fromEntries(header.filter(Boolean).map(f=>{const i=header.indexOf(f);let value=r.cells[i]??'';if(typeof value==='number'&&/(?:_Date(?:_Time)?|_Timestamp|Balance_As_Of|Last_Done|Next_Due|SLA_Due|Required_By|Planned_Start|Planned_Finish|Observation_Date|Commissioned_Date)$/.test(f)&&value>20000&&value<80000)value=new Date(Date.UTC(1899,11,30)+(value+(date1904?1462:0))*86400000).toISOString().replace('T',' ').replace(/ 00:00:00.000Z$/,'').replace(/:00.000Z$/,'');return [f,value]})),__sourceRow:r.row}));
  }
  return data;
 }
 window.AIP_PV864_READ_XLSX=read;
})();
