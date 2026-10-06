
(function(){
 const EXCEL=__AIP_DS("b604281cdbc1878b"); const SYNTH=__AIP_DS("5b6d2de1817ffa03");
 window.AIP_CBM_EXCEL_DATA=EXCEL;
 try{Object.keys(EXCEL).forEach(k=>{EMBEDDED_EXCEL_DATA[k]=EXCEL[k]})}catch(_){window.EMBEDDED_EXCEL_DATA=window.EMBEDDED_EXCEL_DATA||{};Object.assign(window.EMBEDDED_EXCEL_DATA,EXCEL)}
 try{AIP_INDEPENDENT_SYNTHETIC_DATA['CBM Assessments']=SYNTH['CBM Assessments'];AIP_INDEPENDENT_SYNTHETIC_DATA['CBM Evidence']=SYNTH['CBM Evidence'];AIP_INDEPENDENT_SYNTHETIC_DATA['CBM Governance']=SYNTH['CBM Governance'];AIP_INDEPENDENT_SYNTHETIC_DATA.conditionBasedMaintenance=SYNTH}catch(_){window.AIP_INDEPENDENT_SYNTHETIC_DATA=window.AIP_INDEPENDENT_SYNTHETIC_DATA||{};Object.assign(window.AIP_INDEPENDENT_SYNTHETIC_DATA,{'CBM Assessments':SYNTH['CBM Assessments'],'CBM Evidence':SYNTH['CBM Evidence'],'CBM Governance':SYNTH['CBM Governance'],conditionBasedMaintenance:SYNTH})}
})();
