
(function(){
 window.AIPSourceAudit={
  syntheticSheets:Object.keys(AIP_INDEPENDENT_SYNTHETIC_DATA||{}).length,
  rows:(name)=>({excel:(EMBEDDED_EXCEL_DATA?.[name]||[]).length,synthetic:(AIP_INDEPENDENT_SYNTHETIC_DATA?.[name]||[]).length}),
  active:()=>String(window.APM_DATA_MODE||'').toLowerCase()==='demo data'?'Synthetic':'Excel/Imported',
  differs:(name,field)=>{const a=EMBEDDED_EXCEL_DATA?.[name]||[],b=AIP_INDEPENDENT_SYNTHETIC_DATA?.[name]||[];return a.some((r,i)=>b[i]&&String(r?.[field])!==String(b[i]?.[field]));}
 };
})();
