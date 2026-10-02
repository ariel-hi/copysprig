import {STYLES,EFFECTS,FRAMES,transformText,plainText,mixText} from './unicode.mjs?v=351e3cf4a98f';
import {symbols} from './catalog.mjs?v=351e3cf4a98f';
import {copyText} from './copy.mjs?v=351e3cf4a98f';
const data = JSON.parse(document.querySelector('#page-data').textContent);
const input = document.querySelector('#text-input');
// Keep the example out of the editable value so the first keystroke replaces it.
function previewText(){return input.value||data.example||'Make something lovely';}
const results = document.querySelector('#results');
const mixerResult = document.querySelector('#mixer-result');
const styleSearch = document.querySelector('#style-search');
const styleFamily = document.querySelector('#style-family');
const styleAliases = {
  fraktur:'gothic blackletter old english', 'bold-fraktur':'gothic blackletter old english',
  circled:'bubble round', 'negative-circled':'black bubble filled circle round',
  squared:'square boxed', 'negative-squared':'black square boxed filled',
  'small-caps':'tiny small capitals', superscript:'tiny small raised', subscript:'tiny small lowered',
  script:'cursive handwriting', 'bold-script':'cursive handwriting', fullwidth:'wide aesthetic',
  'glitch-light':'zalgo creepy', 'glitch-heavy':'zalgo creepy',
};
const search = document.querySelector('#symbol-search');
const grid = document.querySelector('#symbol-grid');
const toast = document.querySelector('#toast');
const manual = document.querySelector('#manual-copy');
const collection = document.querySelector('#collection');
const collectionCount = document.querySelector('#collection-count');
const frames = FRAMES.filter(frame=>frame.id!=='none').map(({id,left,right})=>[id,left,right]);
const copiedTimers = new WeakMap();
let toastTimer;
let filter='all';
let favorites=read('copysprig-favorites',[]);
let recent=read('copysprig-recent',[]);
function read(key,fallback){try{const value=JSON.parse(localStorage.getItem(key));return Array.isArray(value)?value.filter(x=>typeof x==='string').slice(0,60):fallback;}catch{return fallback;}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{notify('Storage is unavailable. Copying still works.');}}
function notify(message){clearTimeout(toastTimer);toast.textContent=message;toastTimer=setTimeout(()=>{toast.textContent='';},3500);}
function event(name,attributes={}){if(window.copysprigTrack)window.copysprigTrack(name,attributes);}
function favorite(id){
  const active=document.activeElement;
  const container=active?.closest('#mixer-result')||grid||results;
  const restoreFocus=filter==='saved'&&container?.contains(active)&&active?.dataset?.save===id;
  let nextId;
  if(restoreFocus){const buttons=Array.from(container.querySelectorAll('[data-save]'));const index=buttons.indexOf(active);nextId=buttons[index+1]?.dataset.save||buttons[index-1]?.dataset.save;}
  favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[id,...favorites].slice(0,60);
  write('copysprig-favorites',favorites);renderShelf();renderFavorites();
  if(filter==='saved'){if(grid)renderSymbols();if(results)renderStyles();}
  if(restoreFocus){const next=Array.from(container.querySelectorAll('[data-save]')).find(b=>b.dataset.save===nextId);(next||document.querySelector('[data-filter="saved"]'))?.focus();}
  event('favorite_toggle',{item_kind:id.startsWith('symbol:')?'symbol':'style'});
}
function renderFavorites(){document.querySelectorAll('[data-save]').forEach(b=>{const yes=favorites.includes(b.dataset.save);b.setAttribute('aria-pressed',String(yes));b.textContent=yes?'★':'☆';b.setAttribute('aria-label',`${yes?'Unsave':'Save'} ${b.dataset.name}`);});}
function record(id){recent=[id,...recent.filter(x=>x!==id)].slice(0,8);write('copysprig-recent',recent);renderShelf();}
function copied(button){if(!button)return;clearTimeout(copiedTimers.get(button));button.dataset.copied='true';copiedTimers.set(button,setTimeout(()=>{delete button.dataset.copied;copiedTimers.delete(button);},1800));}
async function copy(value,id,button){const outcome=await copyText(value);if(outcome==='manual'){const field=manual.querySelector('textarea');field.value=value;manual.showModal();field.focus();field.select();notify('Select the text and use your device’s copy command.');return;}record(id);notify('Copied. Ready to paste.');copied(button);event('copy',{item_kind:id.startsWith('symbol:')?'symbol':'style',item_id:id.startsWith('mix:')?'style:mixed':id});}
function specimenNumber(id){const index=STYLES.findIndex(s=>s.id===id);if(index>=0)return index+1;const frame=frames.findIndex(f=>`frame-${f[0]}`===id);return frame>=0?frame+1:1;}
function enableCardCopy(article,button){
  article.dataset.copyable=String(!button.disabled);
  article.addEventListener('click',e=>{
    if(button.disabled||e.detail>1||e.target.closest('button,a,input,textarea,select,summary'))return;
    // Selecting a specimen should leave both the selection and clipboard alone.
    const selection=window.getSelection();
    if(selection&&!selection.isCollapsed){for(let i=0;i<selection.rangeCount;i++){if(selection.getRangeAt(i).intersectsNode(article))return;}}
    button.focus({preventScroll:true});
    button.click();
  });
}
function card(style,text,id='style:'+style.id){
  const article=document.createElement('article');article.className='result';article.id=id.replaceAll(':','-');
  const content=document.createElement('div');const label=document.createElement('div');label.className='result-label';
  const number=document.createElement('span');number.className='specimen-index';number.setAttribute('aria-hidden','true');number.textContent=String(specimenNumber(style.id)).padStart(2,'0');
  const name=document.createElement('span');name.textContent=style.label;label.append(number,name);
  const output=document.createElement('p');output.className='output';output.dir='auto';output.textContent=text;content.append(label,output);
  if(style.description){const note=document.createElement('p');note.className='style-note';note.textContent=style.description;content.append(note);}
  const actions=document.createElement('div');actions.className='result-actions';
  const c=document.createElement('button');c.className='copy';c.type='button';c.textContent='Copy';c.setAttribute('aria-label','Copy '+style.label);c.disabled=!text;c.addEventListener('click',()=>copy(text,id,c));
  const s=document.createElement('button');s.type='button';s.className='save';s.dataset.save=id;s.dataset.name=style.label;s.addEventListener('click',()=>favorite(id));
  actions.append(c,s);article.append(content,actions);enableCardCopy(article,c);return article;
}
function mixSelection(id){
  const parts=id.split(':');if(parts.length!==4||parts[0]!=='mix')return;
  const [,styleId,effectId,frameId]=parts;
  if(styleId!=='plain'&&!STYLES.some(s=>s.id===styleId))return;
  if(!EFFECTS.some(e=>e.id===effectId)||!FRAMES.some(f=>f.id===frameId))return;
  return {styleId,effectId,frameId};
}
function mixMetadata(selection){
  const style=STYLES.find(s=>s.id===selection.styleId);const effect=EFFECTS.find(e=>e.id===selection.effectId);const frame=FRAMES.find(f=>f.id===selection.frameId);
  const notes=[style?.description||'Ordinary letters.'];
  if(selection.effectId!=='none'){notes.push(STYLES.find(s=>s.id===selection.effectId).description,'Effects combine on supported letters; duplicate marks are skipped.');}
  if(selection.frameId!=='none')notes.push('A frame around each nonempty line.');
  return {id:'mixed',label:[style?.label||'Plain letters',selection.effectId!=='none'&&effect.label,selection.frameId!=='none'&&frame.label].filter(Boolean).join(' · '),description:notes.join(' ')};
}
function mixerSelection(){return {styleId:document.querySelector('#mix-style').value,effectId:document.querySelector('#mix-effect').value,frameId:document.querySelector('#mix-frame').value};}
function mixId(selection){return ['mix',selection.styleId,selection.effectId,selection.frameId].join(':');}
function renderMixer(){
  if(!mixerResult||!input)return;const selection=mixerSelection();const output=mixText(previewText(),selection);
  const node=card(mixMetadata(selection),output,mixId(selection));node.id='mixed-preview';mixerResult.replaceChildren(node);
  document.querySelector('#mix-count').textContent=Array.from(output).length+' output characters';renderFavorites();
}
function renderStyles(){
  if(!input)return;document.querySelector('#character-count').textContent=Array.from(input.value).length+' / 500 characters';
  renderMixer();if(!results){renderShelf();return;}
  const value=previewText();const fragment=document.createDocumentFragment();
  if(data.mode==='plain'){fragment.append(card({id:'plain',label:'Ordinary text'},plainText(value)));}
  else if(data.mode==='decorator'){
    const chosen=document.querySelector('#frame').value;
    frames.filter(f=>chosen==='all'||f[0]===chosen).forEach(([id])=>{const frame=FRAMES.find(f=>f.id===id);fragment.append(card({id:'frame-'+id,label:frame.label+' frame'},mixText(value,{frameId:id})));});
  }else{
    const query=(styleSearch?.value||'').trim().toLowerCase();const family=styleFamily?.value||'all';
    const matches=s=>(family==='all'||s.group===family)&&(!query||(s.label+' '+s.description+' '+s.id+' '+(styleAliases[s.id]||'')).toLowerCase().includes(query));
    const styles=STYLES.filter(s=>(!data.styleIds||data.styleIds.includes(s.id))&&(filter!=='saved'||favorites.includes('style:'+s.id))&&matches(s));
    styles.forEach(s=>fragment.append(card(s,transformText(value,s.id))));let count=styles.length;
    if(filter==='saved'&&!data.styleIds){for(const id of favorites){const selection=mixSelection(id);if(!selection)continue;const metadata={...mixMetadata(selection),group:STYLES.find(s=>s.id===selection.styleId)?.group||'effects'};if(!matches(metadata))continue;fragment.append(card(metadata,mixText(value,selection),id));count++;}}
    document.querySelector('#style-count').textContent=count+(count===1?' style':' styles');
    if(!count){const p=document.createElement('p');p.className='empty';p.textContent=filter==='saved'&&!query&&family==='all'?'Save a style or mix with the star button, then find it here.':'No styles match. Clear the search or choose All families and All styles.';fragment.append(p);}
  }
  results.replaceChildren(fragment);renderFavorites();renderShelf();
}
function renderSymbols(){if(!grid)return;const query=(search?.value??'').trim().toLowerCase();const candidates=symbols.filter(s=>(!data.category||s.category===data.category)&&(!query||`${s.name} ${s.tags} ${s.text}`.toLowerCase().includes(query))&&(filter!=='saved'||favorites.includes(`symbol:${s.id}`)));const frag=document.createDocumentFragment();candidates.forEach(s=>{const a=document.createElement('article');a.className='symbol-card';const b=document.createElement('button');b.type='button';b.className='symbol-copy';b.setAttribute('aria-label',`Copy ${s.name}`);const glyph=document.createElement('span');glyph.className='symbol-glyph';glyph.setAttribute('aria-hidden','true');glyph.textContent=s.text;const name=document.createElement('span');name.className='symbol-name';name.textContent=s.name;b.append(glyph,name);b.addEventListener('click',()=>copy(s.text,`symbol:${s.id}`,b));const foot=document.createElement('div');foot.className='symbol-footer';const hint=document.createElement('span');hint.textContent='Tap to copy';const save=document.createElement('button');save.className='save';save.type='button';save.dataset.save=`symbol:${s.id}`;save.dataset.name=s.name;save.addEventListener('click',()=>favorite(save.dataset.save));foot.append(hint,save);a.append(b,foot);frag.append(a);});grid.replaceChildren(frag);document.querySelector('#symbol-count').textContent=`${candidates.length} ${candidates.length===1?'item':'items'}`;document.querySelector('#symbol-empty').hidden=candidates.length>0;renderFavorites();}
function shelfItem(id){
  const [kind,key]=id.split(':');
  if(kind==='symbol'){const s=symbols.find(x=>x.id===key);if(!s)return;const b=document.createElement('button');b.className='shelf-item';b.dataset.itemId=id;b.type='button';b.textContent=s.text;b.setAttribute('aria-label',`Copy ${s.name}`);b.addEventListener('click',()=>copy(s.text,id,b));return b;}
  if(kind==='mix'){
    const selection=mixSelection(id);if(!selection)return;const s=mixMetadata(selection);
    const copiesHere=input&&['styles','mixer'].includes(data.mode);const b=document.createElement(copiesHere?'button':'a');
    b.className='shelf-item';b.dataset.itemId=id;b.textContent=s.label;
    if(copiesHere){b.type='button';b.setAttribute('aria-label','Copy '+s.label);b.addEventListener('click',()=>copy(mixText(previewText(),selection),id,b));}
    else b.href='/style-mixer/#'+id;
    return b;
  }
  if(kind==='style'){const special=key==='plain'?{id:key,label:'Ordinary text',href:'/plain-text/'}:key.startsWith('frame-')?{id:key,label:`${key.slice(6)} frame`,href:'/text-decorator/'}:null;const s=STYLES.find(x=>x.id===key)||special;if(!s)return;const copiesHere=input&&['styles','mixer'].includes(data.mode)&&(!data.styleIds||data.styleIds.includes(s.id))&&!special;const b=document.createElement(copiesHere?'button':'a');b.className='shelf-item';b.dataset.itemId=id;b.textContent=s.label;if(copiesHere){b.type='button';b.setAttribute('aria-label',`Copy ${s.label}`);b.addEventListener('click',()=>copy(transformText(previewText(),s.id),id,b));}else b.href=s.href||`/#style-${s.id}`;return b;}
}
function renderShelf(){for(const [id,list]of [['saved-list',favorites],['recent-list',recent]]){const el=document.querySelector(`#${id}`);if(!el)continue;const previous=new Map(Array.from(el.children,b=>[b.dataset.itemId,b]));const nodes=list.map(id=>previous.get(id)||shelfItem(id)).filter(Boolean);nodes.forEach(node=>{if(node.tagName==='BUTTON'&&node.dataset.itemId.startsWith('style:'))node.disabled=!input||!previewText();});if(id==='saved-list'&&collectionCount)collectionCount.textContent=`${nodes.length} saved`;if(!nodes.length){const p=document.createElement('p');p.textContent=id==='saved-list'?'Use a star to save a style or symbol.':'Your copied styles and symbols appear here.';el.replaceChildren(p);}else if(nodes.length!==el.children.length||nodes.some((node,i)=>node!==el.children[i]))el.replaceChildren(...nodes);}}
input?.addEventListener('input',renderStyles);
styleSearch?.addEventListener('input',renderStyles);
styleFamily?.addEventListener('change',renderStyles);
for(const id of ['mix-style','mix-effect','mix-frame'])document.querySelector('#'+id)?.addEventListener('change',renderMixer);
document.querySelector('#mix-reset')?.addEventListener('click',()=>{document.querySelector('#mix-style').value='sans-bold';document.querySelector('#mix-effect').value='none';document.querySelector('#mix-frame').value='none';renderMixer();});
if(mixerResult){const selection=mixSelection(location.hash.slice(1));if(selection){for(const [id,value]of [['mix-style',selection.styleId],['mix-effect',selection.effectId],['mix-frame',selection.frameId]])document.querySelector('#'+id).value=value;const panel=document.querySelector('#style-mixer');if(panel.tagName==='DETAILS')panel.open=true;}}
function openMixer(){const panel=document.querySelector('#style-mixer');if(panel?.tagName==='DETAILS')panel.open=true;}
if(location.hash==='#style-mixer')openMixer();
document.querySelectorAll('a[href="#style-mixer"]').forEach(link=>link.addEventListener('click',openMixer));
search?.addEventListener('input',renderSymbols);
document.querySelector('#frame')?.addEventListener('change',renderStyles);
document.querySelector('#clear-text')?.addEventListener('click',()=>{input.value='';renderStyles();input.focus();});
document.querySelector('#restore-example')?.addEventListener('click',()=>{input.value='';renderStyles();input.focus();});
document.querySelector('#clear-history')?.addEventListener('click',()=>{recent=[];write('copysprig-recent',recent);renderShelf();notify('Recent selections cleared.');});
document.querySelector('#clear-favorites')?.addEventListener('click',()=>{favorites=[];write('copysprig-favorites',favorites);renderShelf();renderFavorites();if(grid)renderSymbols();if(results)renderStyles();notify('Saved selections cleared.');});
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));if(results)renderStyles();if(grid)renderSymbols();}));
manual?.querySelector('button')?.addEventListener('click',()=>manual.close());
// Categories start closed on every screen; opening them is an explicit choice.
// Only the secondary collection expands automatically on desktop.
if(collection&&typeof window.matchMedia==='function'){const mobile=window.matchMedia('(max-width: 760px)');collection.open=!mobile.matches;mobile.addEventListener('change',e=>{if(!e.matches)collection.open=true;});}
renderShelf();renderStyles();renderSymbols();
// Optional proposed WebMCP interface; browser support is feature-detected.
const model=document.modelContext;
if(model?.registerTool&&input){try{const life=new AbortController();Promise.resolve(model.registerTool({name:'style_text',title:'Preview text styles',description:'Update the visible input and preview the selected CopySprig styles. Does not copy or send text.',inputSchema:{type:'object',properties:{text:{type:'string',maxLength:500}},required:['text'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(arg){if(!arg||typeof arg.text!=='string'||Array.from(arg.text).length>500||Object.keys(arg).some(k=>k!=='text'))throw new Error('Provide text of at most 500 characters.');input.value=arg.text;renderStyles();return {updated:true,resultCount:(results||mixerResult).querySelectorAll('.result').length};}},{signal:life.signal})).catch(()=>{});window.addEventListener('pagehide',()=>life.abort(),{once:true});}catch{/* Optional support must not affect the tool. */}}
