import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {startApi} from './index.mjs';
import {createCompanion} from './companion.mjs';
import {createService} from './service.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const types={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.mp3':'audio/mpeg'};
export async function startProduction({port=8080,host='0.0.0.0',publicOrigin=process.env.PUBLIC_ORIGIN,dataDir=process.env.JIXIANG_DATA_DIR||path.join(root,'.local'),service=createService({dataDir}),companion=createCompanion({dataDir})}={}){
  const origin=new URL(publicOrigin);
  if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('PUBLIC_ORIGIN must be the exact public origin.');
  const client=path.join(root,'dist/client');await fs.access(path.join(client,'index.html'));await fs.mkdir(dataDir,{recursive:true});
  const api=await startApi({port:0,service,companion,publicMode:true,publicOrigin:origin.origin});
  const server=http.createServer(async(req,res)=>{
    const finish=(status,text)=>{res.writeHead(status,{'Content-Type':'text/plain;charset=utf-8','Cache-Control':'no-store'});res.end(text);};
    try{
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/healthz'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"ok":true}');return;}
      if(url.pathname.startsWith('/api/')){
        if(req.headers.host!==origin.host)return finish(403,'请从知途页面打开。');
        const upstream=http.request({hostname:'127.0.0.1',port:api.address().port,path:req.url,method:req.method,headers:req.headers},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});
        upstream.on('error',()=>{if(!res.headersSent)finish(503,'连接正在恢复，请稍后再试。');else res.destroy();});
        res.on('close',()=>{if(!res.writableEnded)upstream.destroy();});req.pipe(upstream);return;
      }
      if(!['GET','HEAD'].includes(req.method))return finish(405,'Method not allowed');
      const decoded=decodeURIComponent(url.pathname);
      if(decoded.includes('\\')||decoded.includes('\0')||decoded.split('/').some(part=>part.startsWith('.')||part==='server'))return finish(404,'Not found');
      let filename=path.resolve(client,'.'+decoded);if(!filename.startsWith(client+path.sep)&&filename!==client)return finish(404,'Not found');
      let stat=await fs.stat(filename).catch(()=>null);
      if(!stat?.isFile()){
        if(path.extname(decoded)||!req.headers.accept?.includes('text/html'))return finish(404,'Not found');
        filename=path.join(client,'index.html');stat=await fs.stat(filename);
      }
      const body=await fs.readFile(filename);
      res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':filename.endsWith('index.html')?'no-cache':decoded.startsWith('/assets/')?'public,max-age=31536000,immutable':'public,max-age=3600','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});
      res.end(req.method==='HEAD'?undefined:body);
    }catch{if(!res.headersSent)finish(500,'服务暂时没连上，请稍后再试。');else res.destroy();}
  });
  server.requestTimeout=210000;server.headersTimeout=15000;
  server.on('close',()=>api.close());
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
  return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
  const server=await startProduction({port:Number(process.env.PORT||8080)});
  console.log('知途正式服务已启动。');
  const close=()=>server.close(()=>process.exit(0));process.on('SIGINT',close);process.on('SIGTERM',close);
}
