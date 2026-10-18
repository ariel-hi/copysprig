import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const base={source:'Synthetic test fixture, not business data',period:{start:'2026-10-01',end:'2026-10-04',timeZone:'America/Los_Angeles'},visits:10,successfulCopySessions:3,copySessionDefinition:'Sessions containing a copy event / all sessions; same consent and date scope'};
const script=fileURLToPath(new URL('../scripts/report.mjs',import.meta.url));
async function report(data){
 const dir=await mkdtemp(join(tmpdir(),'copysprig-report-'));
 try{
  await writeFile(join(dir,'input.json'),JSON.stringify(data));
  // Explicit fixtures keep local owner exports and health receipts out of test results.
  await writeFile(join(dir,'empty.json'),JSON.stringify({source:base.source,period:base.period}));
  await writeFile(join(dir,'health.json'),JSON.stringify({generatedAt:'2026-10-04T00:00:00Z',mode:'fixture',baseUrl:'https://example.invalid',summary:{passed:0,failed:0,skipped:0},checks:[]}));
  const run=spawnSync(process.execPath,[script,'--analytics',join(dir,'input.json'),'--search-console',join(dir,'empty.json'),'--bing',join(dir,'empty.json'),'--ads',join(dir,'empty.json'),'--health',join(dir,'health.json'),'--out',dir],{cwd:dir,encoding:'utf8'});
  assert.ifError(run.error);
  return {status:run.status,report:JSON.parse(await readFile(join(dir,'latest.json'),'utf8')),markdown:await readFile(join(dir,'latest.md'),'utf8')};
 }finally{await rm(dir,{recursive:true,force:true});}
}
test('report derives session conversion rather than treating repeated copy events as users',async()=>{
 const result=await report({...base,usefulInteractions:40,interactionDefinition:'copy event count',acquisitionChannels:[{channel:'Organic Search',visits:5,successfulCopySessions:2}]});
 assert.equal(result.status,0);
 assert.equal(result.report.metrics.successfulCopySessionRate.value,30);
 assert.equal(result.report.metrics.successfulCopySessions.definition,base.copySessionDefinition);
 assert.equal(result.report.metrics.successfulCopySessionRate.status,'derived');
 assert.equal(result.report.metrics.successfulCopySessionRate.unit,'percent');
 assert.match(result.markdown,/Organic Search \| 5 \| 2 \| 40.0%/);
 assert.match(result.markdown,/2026-10-01 to 2026-10-04 \(America\/Los_Angeles\)/);
 assert.match(result.markdown,/Copy-session definition: Sessions containing a copy event/);
 assert.equal(result.report.metrics.organicClicks.google.value,null,'no real local export is imported');
 assert.equal(result.report.health.mode,'fixture');
});
test('missing and zero denominators do not become an invented conversion rate',async()=>{
 for(const data of [{...base,successfulCopySessions:null},{...base,visits:null,successfulCopySessions:null},{...base,visits:0,successfulCopySessions:0}]){
  const result=await report(data);assert.equal(result.status,0);
  assert.equal(result.report.metrics.successfulCopySessionRate.value,null);
  assert.equal(result.report.metrics.successfulCopySessionRate.status,'unavailable');
 }
});
test('a measured zero numerator with a positive denominator remains a real zero rate',async()=>{
 const result=await report({...base,successfulCopySessions:0,acquisitionChannels:[{channel:'Direct',visits:2,successfulCopySessions:0}]});
 assert.equal(result.status,0);
 assert.equal(result.report.metrics.successfulCopySessionRate.value,0);
 assert.match(result.markdown,/Direct \| 2 \| 0 \| 0.0%/);
});
test('partial channel exports preserve missing counts instead of filling or summing them',async()=>{
 const result=await report({...base,successfulCopySessions:null,acquisitionChannels:[{channel:'Organic Search',visits:4,successfulCopySessions:1},{channel:'Referral',visits:null,successfulCopySessions:null},{channel:'Direct',visits:0,successfulCopySessions:0}]});
 assert.equal(result.status,0);
 assert.equal(result.report.metrics.successfulCopySessionRate.value,null);
 assert.match(result.markdown,/Organic Search \| 4 \| 1 \| 25.0%/);
 assert.match(result.markdown,/Referral \| Unavailable \| Unavailable \| Unavailable/);
 assert.match(result.markdown,/Direct \| 0 \| 0 \| Unavailable/);
});
test('report rejects impossible or undefined copy-session imports',async()=>{
 for(const data of [{...base,successfulCopySessions:11},{...base,visits:null},{...base,copySessionDefinition:''},{...base,copySessionDefinition:4},{...base,successfulCopySessions:1.5},{...base,acquisitionChannels:[{channel:'Referral',visits:2,successfulCopySessions:3}]},{...base,successfulCopySessions:null,copySessionDefinition:4,acquisitionChannels:[{channel:'Referral',visits:2,successfulCopySessions:1}]},{...base,acquisitionChannels:[{channel:'Referral',visits:null,successfulCopySessions:1}]}]){
  const result=await report(data);assert.equal(result.status,1);assert.ok(result.report.issues.length);
  assert.equal(result.report.metrics.visits.value,null,'invalid source is not partially imported');
  assert.equal(result.report.metrics.successfulCopySessionRate.value,null);
 }
});
test('channel rows cannot duplicate a dimension or exceed their matching totals',async()=>{
 for(const acquisitionChannels of [
  [{channel:'Direct',visits:2},{channel:' Direct ',visits:1}],
  [{channel:'Direct',visits:6},{channel:'Organic Search',visits:5}],
  [{channel:'Direct',visits:4,successfulCopySessions:2},{channel:'Organic Search',visits:3,successfulCopySessions:2}]
 ]){
  const result=await report({...base,acquisitionChannels});
  assert.equal(result.status,1);
  assert.match(result.report.issues.join(' '),/distinct rows|cannot exceed/);
 }
});
