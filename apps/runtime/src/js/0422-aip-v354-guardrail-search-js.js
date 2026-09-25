
(function(){
 function norm(v){return String(v||'').toLowerCase().trim()}
 window.aig54Filter=function(inputId,value){
   const input=document.getElementById(inputId); if(!input)return;
   const panel=input.closest('.aig49-panel'); if(!panel)return;
   const table=panel.querySelector('.aig49-table'); if(!table)return;
   const q=norm(value);
   table.querySelectorAll('tbody tr').forEach(tr=>{
     const text=norm(tr.innerText||tr.textContent||'');
     tr.style.display=(!q||text.includes(q))?'':'none';
   });
 };
})();
