/* GA4 basic consent: no Google script or requests before explicit opt-in. */
(() => {
 'use strict';
 const key='hisab_analytics_consent';
 const publicPages=new Map([['/','Hisab home'],['/index.html','Hisab home'],['/privacy.html','Privacy policy'],['/terms.html','Terms and conditions'],['/cookies.html','Cookies policy'],['/refund.html','Refund policy']]);
 const eligible=publicPages.has(location.pathname)&&location.protocol!=='file:';
 let id='',script=null,loading=false;
 const allowed=()=>{try{return localStorage.getItem(key)==='yes';}catch{return false;}};
 function clearCookies(){
  for(const item of document.cookie.split(';')){
   const name=item.split('=')[0].trim();if(!/^_ga(?:_|$)/.test(name))continue;
   document.cookie=name+'=; Max-Age=0; path=/';
   const parts=location.hostname.split('.');
   for(let i=0;i<parts.length-1;i++)document.cookie=name+'=; Max-Age=0; path=/; domain=.'+parts.slice(i).join('.');
  }
 }
 async function start(){
  if(!eligible||!allowed()||script||loading)return;
  loading=true;
  try{
   const response=await fetch('/api/privacy/analytics');
   const result=await response.json();id=result.data?.measurementId||'';
   if(!/^G-[A-Z0-9]{5,20}$/.test(id)||!allowed())return;
   window['ga-disable-'+id]=false;
   window.dataLayer=window.dataLayer||[];
   window.gtag=function(){window.dataLayer.push(arguments);};
   window.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
   window.gtag('consent','update',{analytics_storage:'granted'});
   window.gtag('js',new Date());
   const page=location.origin+location.pathname;
   window.gtag('config',id,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,page_location:page,page_referrer:'',page_title:publicPages.get(location.pathname)});
   window.gtag('event','page_view',{send_to:id,page_location:page,page_referrer:'',page_title:publicPages.get(location.pathname)});
   script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id);script.id='hisab-ga4';script.onerror=()=>{script?.remove();script=null;};document.head.append(script);
  }catch{/* Analytics never blocks the ledger or forms. */}finally{loading=false;}
 }
 function sync(){document.querySelectorAll('[data-analytics-toggle]').forEach(el=>el.checked=allowed());}
 function consent(allow){
  try{localStorage.setItem(key,allow?'yes':'no');}catch{return;}
  sync();
  if(allow){start();return;}
  if(id)window['ga-disable-'+id]=true;
  clearCookies();
  // Reload clears an already-running Google tag after withdrawal.
  if(script){script.remove();script=null;location.reload();}
 }
 window.hisabAnalytics={consent,allowed};
 window.addEventListener('storage',event=>{if(event.key!==key)return;sync();if(allowed())start();else{if(id)window['ga-disable-'+id]=true;clearCookies();if(script)location.reload();}});
 document.addEventListener('DOMContentLoaded',()=>{
  const panel=document.getElementById('privacyControls');
  if(panel){const section=document.createElement('div');section.className='campaign-controls';const label=document.createElement('label');const check=document.createElement('input');check.type='checkbox';check.setAttribute('data-analytics-toggle','');check.checked=allowed();label.append(check,document.createTextNode('Allow Google Analytics on public website pages (dashboard records excluded)'));const save=document.createElement('button');save.type='button';save.textContent='Save analytics preference';save.onclick=()=>{consent(check.checked);const status=document.createElement('p');status.setAttribute('role','status');status.textContent=check.checked?'Analytics enabled for public pages when configured.':'Analytics disabled on this device.';section.querySelector('p')?.remove();section.append(status);};section.append(label,save);panel.append(section);}
  start();
 });
})();
