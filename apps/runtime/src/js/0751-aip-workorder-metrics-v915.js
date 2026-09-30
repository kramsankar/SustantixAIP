(function(){
'use strict';
const norm=v=>String(v??'').trim().toLowerCase();
const open=r=>!['completed','closed','cancelled','canceled','rejected','verified','erp closed'].includes(norm(r.status??r.Status));
function dueTime(value){
 const v=String(value??'').trim();if(!v)return NaN;
 if(/^\d{4}-\d{2}-\d{2}$/.test(v))return new Date(v+'T23:59:59.999').getTime();
 return new Date(v.replace(' ','T')).getTime();
}
function overdue(r,asOf=Date.now()){
 if(!open(r))return false;
 const due=dueTime(r.SLA_Due||r.slaDue||r.Planned_Finish||r.Due_Date||r.PM_Due_Date||r.pmDueDate);
 if(Number.isFinite(due))return Number(asOf)>due;
 return r.overdue===true||/^(breached|overdue|overdue actions)$/.test(norm(r.SLA_Result||r.slaResult||r.status||r.Status))||Number(r.PM_Overdue_Days||r.overdueDays)>0;
}
function ready(r){
 const clear=v=>['ready','not required'].includes(norm(v));
 const crew=norm(r.crew??r.Assigned_Crew??r.Crew_ID);
 return open(r)&&clear(r.parts??r.Parts_Status)&&clear(r.permit??r.Permit_Status)&&['','unassigned'].includes(crew);
}
window.AIPWorkOrder915={open,overdue,ready,dueTime};
})();

