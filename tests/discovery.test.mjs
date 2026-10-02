import test from 'node:test';
import assert from 'node:assert/strict';
import {STYLES,STYLE_GROUPS} from '../src/unicode.mjs';
import {symbols,categories} from '../src/catalog.mjs';
import {filterStyles,matchesStyleFilters,filterSymbols,matchesSymbolQuery,pickItem} from '../src/discovery.mjs';

test('style families partition the entire catalog, and saved filtering keeps only saved style IDs',()=>{
  const groups=STYLE_GROUPS.map(group=>filterStyles(STYLES,{family:group.id}));
  assert.ok(groups.every(group=>group.length>0));
  assert.equal(new Set(groups.flat().map(style=>style.id)).size,STYLES.length);
  assert.deepEqual(filterStyles(STYLES,{filter:'saved',favoriteIds:['symbol:heart-0','style:script']}).map(style=>style.id),['script']);
  assert.equal(filterStyles(STYLES,{filter:'all'}).length,STYLES.length);
  assert.deepEqual(filterStyles([{id:'new-future-style',group:'new-family'}]),[{id:'new-future-style',group:'new-family'}]);
});

test('style search uses group metadata and aliases, and applies the same constraints to saved mixes',()=>{
  const aliases={fraktur:'gothic blackletter old english'};
  assert.deepEqual(filterStyles(STYLES,{family:'lettering',query:'english old',aliases}).map(style=>style.id),['fraktur']);
  assert.deepEqual(filterStyles(STYLES,{family:'effects',query:'old english',aliases}),[]);
  const mixed={id:'mixed',label:'Bold · Underline · Stars',description:'Bold Unicode letters.',group:'lettering'};
  assert.ok(matchesStyleFilters(mixed,{family:'lettering',query:'stars underline'}));
  assert.ok(!matchesStyleFilters(mixed,{family:'enclosed',query:'stars'}));
});

test('every visible collection label finds its symbols, including plural labels and kaomoji',()=>{
  for(const category of categories){
    const matches=filterSymbols(symbols,{query:category.label});
    assert.ok(matches.length>0,category.label);
    assert.ok(symbols.filter(symbol=>symbol.category===category.id).every(symbol=>matches.includes(symbol)),category.label);
  }
  for(const query of ['stars','flowers','hearts','kaomoji','dividers'])assert.ok(filterSymbols(symbols,{query}).length>0,query);
});

test('multiword search matches across names and tags regardless of order, without mutating Unicode payloads',()=>{
  const heart=symbols.find(symbol=>symbol.text==='♡');
  assert.ok(matchesSymbolQuery(heart,' OUTLINE  heart '));
  assert.ok(matchesSymbolQuery(heart,'heart outline'));
  assert.deepEqual(filterSymbols(symbols,{query:'sparkle star'}).map(symbol=>symbol.id),filterSymbols(symbols,{query:'star sparkle'}).map(symbol=>symbol.id));
  assert.ok(filterSymbols(symbols,{query:'sparkle star'}).length>0);
  assert.equal(filterSymbols(symbols,{query:'♡'})[0].text,'♡');
  assert.equal(heart.text,'♡');
});

test('category routes remain scoped and saved search combines all active constraints',()=>{
  assert.deepEqual(filterSymbols(symbols,{category:'heart',query:'stars'}),[]);
  const saved=['symbol:star-0','symbol:heart-0'];
  assert.deepEqual(filterSymbols(symbols,{category:'star',filter:'saved',favoriteIds:saved,query:'outline'}).map(symbol=>symbol.id),['star-0']);
  assert.equal(filterSymbols(symbols,{category:'all'}).length,symbols.length);
  assert.equal(filterSymbols(symbols,{query:'no-matching-symbol'}).length,0);
});

test('style picking stays inside the visible set, avoids immediate repeats and handles empty results',()=>{
  const items=filterStyles(STYLES,{family:'lettering'});
  assert.equal(pickItem([],undefined),undefined);
  assert.equal(pickItem([items[0]],items[0].id).id,items[0].id);
  assert.equal(pickItem(items,items[0].id,()=>0).id,items[1].id);
  assert.equal(pickItem(items,undefined,()=>0).id,items[0].id);
  assert.equal(pickItem(items,undefined,()=>1).id,items.at(-1).id);
  const savedItems=[{id:'style:bold'},{id:'mix:bold:underline:stars'}];
  assert.equal(pickItem(savedItems,'style:bold',()=>0).id,'mix:bold:underline:stars');
});
