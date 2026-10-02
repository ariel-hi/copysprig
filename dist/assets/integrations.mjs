const config=JSON.parse(document.querySelector('#integration-data').textContent);
const exclusionKey='copysprig-analytics-excluded';
const consentKey='copysprig-analytics-consent';
const disableKey=`ga-disable-${config.analytics.measurementId}`;
function consentValue(){try{return localStorage.getItem(consentKey);}catch{return 'denied';}}
function savedExclusion(){
 try{if(localStorage.getItem(exclusionKey)==='1')return true;}catch{return true;}
 return (document.cookie||'').split(';').some(value=>value.trim()===`${exclusionKey}=1`);
}
const ownerVisit=new URLSearchParams(location.search).get('analytics')==='off';
if(ownerVisit){
 try{localStorage.setItem(exclusionKey,'1');}catch{}
 // A host-only preference cookie also protects visits if local storage fills up.
 try{document.cookie=`${exclusionKey}=1; Path=/; Max-Age=34560000; SameSite=Lax; Secure`;}catch{}
}
const automated= navigator.webdriver===true||/HeadlessChrome|Playwright|Puppeteer|Selenium/i.test(navigator.userAgent||'')||window.__COPYSPRIG_TEST__===true;
let analyticsExcluded=ownerVisit||savedExclusion()||automated||location.origin!==config.siteUrl;
let analyticsStarted=false;
function stopAnalytics(){window[disableKey]=true;window.copysprigTrack=undefined;}
function showExclusion(){
 const box=document.querySelector('#analytics-consent');if(box)box.hidden=true;
 const settings=document.querySelector('#privacy-settings');
 if(settings){settings.textContent='Analytics excluded';settings.setAttribute('aria-disabled','true');settings.title='Visits and actions from this browser are excluded from analytics.';}
}
function refreshExclusion(){
 if(!analyticsExcluded&&savedExclusion()){analyticsExcluded=true;stopAnalytics();showExclusion();}
 return analyticsExcluded;
}
if(analyticsExcluded){stopAnalytics();showExclusion();}
function loadAnalytics(){
 if(refreshExclusion()||analyticsStarted||consentValue()!=='granted'||config.analytics.mode!=='ga4'||!/^G-[A-Z0-9]+$/.test(config.analytics.measurementId))return;
 analyticsStarted=true;window.dataLayer=window.dataLayer||[];
 function gtag(){window.dataLayer.push(arguments);}window.gtag=gtag;
 const safePage={page_location:location.origin+location.pathname,page_title:document.title,page_referrer:document.referrer?new URL(document.referrer).origin:''};
 gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
 // GA otherwise defaults later/custom events to the full browser URL/referrer.
 // Set global and stream defaults before initialization, then explicit event
 // fields too; optional visitor attributes can never override these values.
 gtag('set',safePage);
 gtag('js',new Date());
 gtag('config',config.analytics.measurementId,{...safePage,send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});
 gtag('event','page_view',safePage);
 window.copysprigTrack=(name,attrs={})=>{
  if(refreshExclusion()||window[disableKey]||consentValue()!=='granted')return;
  const allowed=new Set(['copy','favorite_toggle']);if(!allowed.has(name))return;
  const safe={};if(['style','symbol'].includes(attrs.item_kind))safe.item_kind=attrs.item_kind;
  if(typeof attrs.item_id==='string'&&/^(style:[a-z-]+|symbol:[a-z]+-\d+)$/.test(attrs.item_id))safe.item_id=attrs.item_id;
  gtag('event',name,{...safePage,...safe});
 };
 const script=document.createElement('script');script.async=true;script.src=`https://www.googletagmanager.com/gtag/js?id=${config.analytics.measurementId}`;document.head.append(script);
}
if(config.analytics.mode==='ga4'){
 const box=document.querySelector('#analytics-consent');box.hidden=analyticsExcluded||consentValue()!==null;if(!analyticsExcluded&&consentValue()==='granted')loadAnalytics();
 box.querySelector('[data-consent=allow]').addEventListener('click',()=>{if(refreshExclusion())return;try{localStorage.setItem(consentKey,'granted');}catch{}box.hidden=true;if(consentValue()!=='granted')return;window[disableKey]=false;if(analyticsStarted){window.gtag?.('consent','update',{analytics_storage:'granted'});location.reload();}else loadAnalytics();});
 box.querySelector('[data-consent=decline]').addEventListener('click',()=>{try{localStorage.setItem(consentKey,'denied');}catch{}stopAnalytics();window.gtag?.('consent','update',{analytics_storage:'denied'});box.hidden=true;});
 document.querySelector('#privacy-settings')?.addEventListener('click',()=>{if(refreshExclusion())return;box.hidden=false;box.scrollIntoView({block:'center'});box.querySelector('button').focus();});
 window.addEventListener('storage',event=>{
  if(event.key===exclusionKey&&event.newValue==='1'){analyticsExcluded=true;stopAnalytics();showExclusion();}
  else if((event.key===consentKey||event.key===null)&&consentValue()!=='granted')stopAnalytics();
 });
 // Cookie fallback changes do not raise storage events; recheck on tab focus.
 window.addEventListener('focus',refreshExclusion);
}
// Ads are inactive until a real publisher, slot, approval and certified CMP exist.
// An activated implementation waits for the site's consent bridge; it never
// treats analytics consent as advertising consent.
if(config.ads.enabled&&config.ads.cmpReady&&/^ca-pub-\d{16}$/.test(config.ads.publisherId)&&/^\d+$/.test(config.ads.slotId)){
 window.addEventListener('copysprig-ad-consent',e=>{if(e.detail?.allowed!==true||document.querySelector('script[data-copysprig-ads]'))return;const section=document.querySelector('#ad-placement');if(!section)return;section.hidden=false;const ad=document.createElement('ins');ad.className='adsbygoogle';ad.style.display='block';ad.dataset.adClient=config.ads.publisherId;ad.dataset.adSlot=config.ads.slotId;ad.dataset.adFormat='auto';ad.dataset.fullWidthResponsive='true';section.append(ad);const script=document.createElement('script');script.async=true;script.crossOrigin='anonymous';script.dataset.copysprigAds='true';script.src=`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.ads.publisherId}`;script.onload=()=>{(window.adsbygoogle=window.adsbygoogle||[]).push({});};document.head.append(script);});
}
