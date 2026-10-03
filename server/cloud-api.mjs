import {createCompanion} from './companion.mjs';
import {cloudStorage} from './cloud-storage.mjs';

function configuration(env){
  return Object.fromEntries(['text','image','vision'].map(kind=>{
    const prefix='JIXIANG_'+kind.toUpperCase()+'_';
    return [kind,{provider:env[prefix+'PROVIDER'],baseUrl:env[prefix+'BASE_URL'],model:env[prefix+'MODEL'],apiKey:env[prefix+'API_KEY']??''}];
  }));
}
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function cloudApi(request,env,ctx){
  const url=new URL(request.url),origin=request.headers.get('origin');
  if(origin&&origin!==url.origin&&origin!==env.PUBLIC_ORIGIN)return json({error:'请从知途页面打开。'},403);
  if(request.method==='GET'&&url.pathname==='/api/ai/status'){
    const config=configuration(env),publicPart=kind=>({provider:config[kind].provider,baseUrl:config[kind].baseUrl,model:config[kind].model,configured:!!config[kind].apiKey});
    return json({text:publicPart('text'),image:publicPart('image'),bookmarks:{zhihu:'import',xiaohongshu:'import'},managed:true});
  }
  if(request.method==='GET'&&url.pathname==='/api/ai/stamps')return json({stamps:[]});
  // Public visitors cannot replace the owner's model configuration or call unscoped art APIs.
  if(url.pathname!=='/api/ai/companion'||request.method!=='POST')return json({error:'请求不存在。'},404);
  if(request.headers.get('X-Jixiang-Request')!=='1'||!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'请重新打开知途。'},403);
  if(!env.DB||!env.BUCKET)return json({error:'连接正在恢复，请稍后再试。'},503);
  try{
    const reader=request.body?.getReader();if(!reader)return json({error:'没有收到消息。'},400);
    const chunks=[];let size=0;
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>3*1024*1024){await reader.cancel();return json({error:'图片有点大，换一张试试。'},413);}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const body=JSON.parse(new TextDecoder().decode(bytes));
    const service=createCompanion({dataDir:'/private',...cloudStorage(env),fetcher:env.PROVIDER_FETCH??fetch,getConfig:async()=>configuration(env),background:false,workLeaseMs:180000,schedule:()=>{}});
    if(body.action==='drawPending')return json(await service.drawPending(body.token));
    return json({...await service(body),managed:true});
  }catch(error){if(error instanceof SyntaxError)return json({error:'消息没有读完整，再发一次吧。'},400);console.error('Companion request failed',{status:error.status??500,name:error.name});return json({error:error.status?error.message:'刚才没连上，会接着试。'},error.status??503);}
}
