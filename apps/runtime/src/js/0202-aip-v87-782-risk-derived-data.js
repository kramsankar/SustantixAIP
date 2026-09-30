
(function(){
const EXCEL_RISK=__AIP_DS("b061cdacda55306e");
const SYNTH_RISK=__AIP_DS("7625bc87c06dc230");
window.AIP_RISK_QUEUE_EXCEL=EXCEL_RISK;window.AIP_RISK_QUEUE_SYNTHETIC=SYNTH_RISK;
try{if(typeof EMBEDDED_EXCEL_DATA!=='undefined')EMBEDDED_EXCEL_DATA["Risk Queue"]=EXCEL_RISK;}catch(_e){}
try{window.EMBEDDED_EXCEL_DATA=window.EMBEDDED_EXCEL_DATA||{};window.EMBEDDED_EXCEL_DATA["Risk Queue"]=EXCEL_RISK;}catch(_e){}
try{window.AIP_INDEPENDENT_SYNTHETIC_DATA=window.AIP_INDEPENDENT_SYNTHETIC_DATA||{};window.AIP_INDEPENDENT_SYNTHETIC_DATA.platformSyntheticData=window.AIP_INDEPENDENT_SYNTHETIC_DATA.platformSyntheticData||{};window.AIP_INDEPENDENT_SYNTHETIC_DATA.platformSyntheticData["Risk Queue"]=SYNTH_RISK;}catch(_e){}
})();
