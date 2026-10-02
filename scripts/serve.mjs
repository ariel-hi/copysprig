import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const base=resolve(import.meta.dirname,'../dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.xml':'application/xml','.txt':'text/plain; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const port=Number(process.env.PORT||4173);
http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=resolve(base,'.'+pathname);if(file!==base&&!file.startsWith(base+sep)){res.writeHead(400).end();return;}if((await stat(file)).isDirectory())file=resolve(file,'index.html');const body=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404,{'content-type':'text/html; charset=utf-8'});res.end(await readFile(resolve(base,'404.html')));}}).listen(port,'127.0.0.1',()=>console.log(`CopySprig preview: http://127.0.0.1:${port}`));
