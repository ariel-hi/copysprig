import {categories} from './catalog.mjs?v=e56d9793c17e';

const categoryWords = new Map(categories.map(category=>[category.id,`${category.id} ${category.label} ${category.path.replace(/-/g,' ')}`.toLowerCase()]));

export function matchesStyleFilters(style,{family='all',query='',aliases={}}={}){
  const words=String(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
  const haystack=`${style.label||''} ${style.description||''} ${style.id} ${style.group||''} ${aliases[style.id]||''}`.toLowerCase();
  return (family==='all'||style.group===family)&&words.every(word=>haystack.includes(word));
}

export function filterStyles(styles,{filter='all',favoriteIds=[],...search}={}){
  return styles.filter(style=>(filter!=='saved'||favoriteIds.includes(`style:${style.id}`))&&matchesStyleFilters(style,search));
}

// Search stays local. Names, category labels and tags help common plural and
// multiword requests such as "stars" or "outline heart" find useful results.
export function matchesSymbolQuery(symbol,query=''){
  const words=String(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
  const haystack=`${symbol.name} ${symbol.tags} ${symbol.text} ${categoryWords.get(symbol.category)||symbol.category||''}`.toLowerCase();
  return words.every(word=>haystack.includes(word));
}

export function filterSymbols(items,{query='',category,filter='all',favoriteIds=[]}={}){
  return items.filter(symbol=>(!category||category==='all'||symbol.category===category)&&matchesSymbolQuery(symbol,query)&&(filter!=='saved'||favoriteIds.includes(`symbol:${symbol.id}`)));
}

// A second pick feels intentional: avoid immediately repeating the same style
// when there is another visible option. Never reach beyond the active filter.
export function pickItem(items,previousId,random=Math.random){
  if(!items.length)return undefined;
  const choices=items.length>1?items.filter(item=>item.id!==previousId):items;
  return choices[Math.min(choices.length-1,Math.max(0,Math.floor(random()*choices.length)))];
}
