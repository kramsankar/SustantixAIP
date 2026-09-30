
(function(){
 const rows=__AIP_DS("e85e0fcc3c300358");
 function merge(target){if(!Array.isArray(target))return;const seen=new Set(target.map(r=>String(r.Event_ID||r.id||'')));rows.forEach(r=>{if(!seen.has(r.Event_ID)){target.push(r);seen.add(r.Event_ID)}})}
 try{
  if(window.EMBEDDED_EXCEL_DATA){window.EMBEDDED_EXCEL_DATA['Event Log']=window.EMBEDDED_EXCEL_DATA['Event Log']||[];merge(window.EMBEDDED_EXCEL_DATA['Event Log'])}
  window.EVENT_LOG=window.EVENT_LOG||[];merge(window.EVENT_LOG);
  if(window.APM_IMPORTED_DATA){window.APM_IMPORTED_DATA['Event Log']=window.APM_IMPORTED_DATA['Event Log']||[];merge(window.APM_IMPORTED_DATA['Event Log'])}
 }catch(e){console.warn('Event source augmentation failed',e)}
})();
