(() => {
 function init(){
  const date=document.getElementById('shopWelcomeDate');
  const showDate=()=>{if(date)date.textContent=new Intl.DateTimeFormat({hi:'hi-IN',te:'te-IN'}[window.hisabI18n?.language]||'en-IN',{weekday:'long',day:'numeric',month:'long',timeZone:'Asia/Kolkata'}).format(new Date());};
  showDate();document.addEventListener('hisab-language-change',showDate);
  const grid=document.querySelector('#dashboardStatsContent>.kpi-grid');
  if(grid&&grid.children.length>4){const details=document.createElement('details'),summary=document.createElement('summary'),extra=document.createElement('div');details.className='shop-more-insights';summary.textContent='More shop insights';extra.className='kpi-grid';Array.from(grid.children).slice(4).forEach(card=>extra.append(card));details.append(summary,extra);grid.after(details);}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
