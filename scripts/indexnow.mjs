// Notify IndexNow engines (Bing, Yandex, Seznam, Naver) of every canonical URL after a verified deploy.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const config=JSON.parse(await readFile(resolve(root,'config.json'),'utf8'));
if(!config.indexNowKey){console.log('IndexNow skipped: no key configured.');process.exit(0);}
const origin=new URL(config.siteUrl).origin;
const routes=JSON.parse(await readFile(resolve(root,'routes.json'),'utf8'));
const body={host:new URL(origin).host,key:config.indexNowKey,keyLocation:`${origin}/${config.indexNowKey}.txt`,urlList:routes.map(r=>origin+r.path)};
const res=await fetch('https://api.indexnow.org/indexnow',{method:'POST',headers:{'content-type':'application/json; charset=utf-8'},body:JSON.stringify(body)});
// IndexNow failures must not fail a deploy that is already live.
console.log(`IndexNow: HTTP ${res.status} for ${body.urlList.length} URLs.`);
