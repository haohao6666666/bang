import http from 'node:http';
import { createCompanion } from './companion.mjs';
import { pathToFileURL } from 'node:url';
import { createService } from './service.mjs';
import { ServiceError } from './validation.mjs';

export function startApi({port=4175,host='127.0.0.1',service=createService(),companion=createCompanion()}={}) {
  const server=http.createServer(async(req,res)=>{
    const send=(status,data)=>{if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
    try{
      const host=req.headers.host||'';
      if(!/^(127\.0\.0\.1|localhost|[\da-fA-F:.]+):\d+$/.test(host))throw new ServiceError('只允许本机或局域网访问。',403);
      const origin=req.headers.origin;
      if(origin&&!(new URL(origin).hostname===host.split(':')[0]&&['4173','4174'].includes(new URL(origin).port))&&!['http://127.0.0.1:4173','http://localhost:4173','http://127.0.0.1:4174','http://localhost:4174'].includes(origin))throw new ServiceError('不允许这个来源访问本机模型服务。',403);
      if(req.headers['sec-fetch-site']==='cross-site')throw new ServiceError('不允许跨站请求。',403);
      const url=new URL(req.url,'http://127.0.0.1');
      if(req.method==='GET'&&url.pathname==='/api/ai/status')return send(200,await service.status());
      if(req.method==='GET'&&url.pathname==='/api/ai/stamps')return send(200,await service.stamps());
      if(req.method==='GET'&&url.pathname.startsWith('/api/ai/stamp-assets/')){const asset=await service.asset(url.pathname.split('/').pop());res.writeHead(200,{'Content-Type':asset.mime,'Cache-Control':'private,max-age=31536000,immutable','X-Content-Type-Options':'nosniff'});return res.end(asset.bytes);}
      if(req.method!=='POST')return send(404,{error:'接口不存在。'});
      if(!req.headers['content-type']?.startsWith('application/json')||req.headers['x-jixiang-request']!=='1')throw new ServiceError('请从知途界面发起请求。',403);
      const parts=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>(url.pathname==='/api/ai/companion'?3000000:900000))throw new ServiceError('发送内容过大，请减少收藏片段。',413);parts.push(chunk);}
      let body;try{body=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw new ServiceError('请求不是有效的 JSON。');}
      const name=url.pathname.slice('/api/ai/'.length);
      if(!url.pathname.startsWith('/api/ai/')||!['config','echo','weekly','stamp','companion'].includes(name))return send(404,{error:'接口不存在。'});
      const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
      const result=name==='companion'?await companion(body):await service[name==='config'?'configure':name](body,controller.signal);send(200,result);
    }catch(error){send(error instanceof ServiceError?error.status:500,{error:error instanceof ServiceError?error.message:'本机服务遇到问题，请检查配置后重试。'});}
  });
  server.on('close',()=>companion.close?.());
  return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>resolve(server));});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}const server=await startApi();console.log(`知途 API: http://127.0.0.1:${server.address().port}`);}
