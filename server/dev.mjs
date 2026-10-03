import { createServer } from 'vite';
import { startApi } from './index.mjs';
import { createCompanion } from './companion.mjs';
import { createService } from './service.mjs';
import path from 'node:path';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
const requested=process.argv.indexOf('--port');const port=requested>=0?Number(process.argv[requested+1]):4173;
if(![4173,4174].includes(port))throw new Error('本机预览支持端口 4173 或 4174。');
const lan=process.env.JIXIANG_LAN==='1'||process.argv.includes('--lan');const bindHost=lan?'0.0.0.0':'127.0.0.1';
const apiPort=port===4173?4175:4176;
const api=await startApi({port:apiPort,host:bindHost,service:createService({dataDir:path.resolve(port===4174?'.local/test-preview':'.local')}),companion:createCompanion({dataDir:path.resolve(port===4174?'.local/test-preview':'.local')})});
const privateFiles={name:'jixiang-private-files',configureServer(vite){vite.middlewares.use((req,res,next)=>{
  let requestedPath;try{requestedPath=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replaceAll('\\','/');}catch{res.writeHead(400);res.end();return;}
  if(requestedPath.split('/').some(part=>{const name=part.toLowerCase().split(':')[0].replace(/[. ]+$/,'');return ['.local','.git','server'].includes(name)||name==='.env'||name.startsWith('.env.');})){res.writeHead(403,{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end('Private project files are not served.');return;}
  next();
});}};
// Preserve the browser's Host so the API can validate the same-origin LAN request.
const server=await createServer({plugins:[privateFiles],server:{host:bindHost,port,strictPort:true,fs:{deny:['.env','.env.*','**/.local/**','**/server/**','**/*.{crt,pem}','**/.git/**']},proxy:{'/api':{target:`http://127.0.0.1:${apiPort}`,changeOrigin:false}}}});
await server.listen();server.printUrls();console.log('本机模型服务已启动；API Key 仅存服务端。');
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,async()=>{await server.close();api.close();process.exit(0);});
