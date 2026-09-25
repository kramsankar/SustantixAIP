
(function(){
  const main=document.getElementById('main');
  if(!main)return;

  main.addEventListener('scroll',function(){
    const view=document.getElementById('view-commercialppa');
    if(view&&view.classList.contains('active')&&window.__cppaRankingKeyboardScope){
      window.__cppaRankingKeyboardScope=true;
    }
  },{passive:true});

  main.addEventListener('pointerdown',function(){
    const view=document.getElementById('view-commercialppa');
    if(view&&view.classList.contains('active')&&window.__cppaRankingKeyboardScope){
      window.__cppaRankingKeyboardScope=true;
    }
  },true);
})();
