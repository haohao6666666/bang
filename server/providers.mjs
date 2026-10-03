import { ServiceError, text } from './validation.mjs';
export const defaults = {
  text:{provider:'qwen',baseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1',model:'qwen-plus',apiKey:''},
  image:{provider:'wan',baseUrl:'https://dashscope.aliyuncs.com/api/v1',model:'wan2.2-t2i-flash',apiKey:''}
};
export function validateConfig(part, kind) {
  if (!part || typeof part !== 'object') throw new ServiceError('模型配置不完整。');
  const providers=kind==='text'?['qwen','deepseek','tokendance','doubao']:['wan','doubao'];
  if(!providers.includes(part.provider)) throw new ServiceError('不支持这个模型服务。');
  let url; try{url=new URL(part.baseUrl);}catch{throw new ServiceError('请填写官方 HTTPS API 地址。');}
  const ali=url.hostname==='dashscope.aliyuncs.com'||/^[a-z0-9-]+\.cn-beijing\.maas\.aliyuncs\.com$/.test(url.hostname);
  const allowed=(['qwen','wan'].includes(part.provider)&&ali)||(part.provider==='deepseek'&&url.hostname==='api.deepseek.com')||(part.provider==='tokendance'&&url.hostname==='tokendance.space')||(part.provider==='doubao'&&url.hostname==='ark.cn-beijing.volces.com');
  if(!allowed||url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash) throw new ServiceError('地址必须是所选厂商的中国大陆官方 API 地址，或已配置的 Token Dance 网关。');
  const model=text(part.model,160); if(!model || !/^[a-zA-Z0-9._:/-]+$/.test(model)) throw new ServiceError('请填写控制台中的有效模型名称或接入点 ID。');
  return {provider:part.provider,baseUrl:url.href.replace(/\/$/,''),model,apiKey:text(part.apiKey,1024)};
}
async function jsonRequest(url, options, fetcher) {
  let response;
  try { response=await fetcher(url,{...options,redirect:'error'}); } catch(e) { if(e.name==='AbortError'||e.name==='TimeoutError')throw new ServiceError('模型请求超时或已取消，请稍后重试。',504); throw new ServiceError('无法连接模型服务，请检查网络与官方 API 地址。',502); }
  if(!response.ok) throw new ServiceError(response.status===401||response.status===403?'模型鉴权失败，请检查 API Key 和模型权限。':response.status===429?'模型额度不足或请求过多，请稍后重试。':`模型服务返回错误（${response.status}），未保存结果。`,502);
  const reader=response.body?.getReader();if(!reader)throw new ServiceError('模型返回了空内容。',502);
  const chunks=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>24*1024*1024){await reader.cancel();throw new ServiceError('模型结果超过大小限制。',502);}chunks.push(value);}
  const content=Buffer.concat(chunks).toString('utf8');
  try{return JSON.parse(content);}catch{throw new ServiceError('模型服务没有返回有效 JSON。',502);}
}
export async function chat(config, messages, {fetcher=fetch,signal}={}) {
  if(!config.apiKey) throw new ServiceError('尚未配置文本模型 API Key，请在「我的 → 模型与收藏」中填写。',503);
  const body={model:config.model,messages,stream:false,response_format:{type:'json_object'},max_tokens:5000};
  if(config.provider==='qwen')body.enable_thinking=false;
  const data=await jsonRequest(`${config.baseUrl}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(90000)]):AbortSignal.timeout(90000)},fetcher);
  const content=data?.choices?.[0]?.message?.content;
  if(typeof content!=='string')throw new ServiceError('模型未返回可解析的回声。',502);
  try{return JSON.parse(content.replace(/^\s*```(?:json)?\s*/,'').replace(/\s*```\s*$/,''));}catch{throw new ServiceError('模型返回的 JSON 不完整，请重试。',502);}
}
const wait=(ms,signal)=>new Promise((resolve,reject)=>{const done=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);resolve();}; const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new ServiceError('已停止等待绘图；已提交的模型任务可能仍产生费用。',499));}; const timer=setTimeout(done,ms);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();});
export async function imageGeneration(config,prompt,{fetcher=fetch,signal,onJob=async()=>{},jobId,pollDelay=2000}={}) {
  if(!config.apiKey)throw new ServiceError('尚未配置绘图模型 API Key，请先在设置中填写。',503);
  const headers={Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json'};
  const timeout=signal?AbortSignal.any([signal,AbortSignal.timeout(180000)]):AbortSignal.timeout(180000);
  if(config.provider==='doubao'){
    const data=await jsonRequest(`${config.baseUrl}/images/generations`,{method:'POST',headers,body:JSON.stringify({model:config.model,prompt,size:'2048x2048',response_format:'b64_json',watermark:true}),signal:timeout},fetcher);
    return data?.data?.[0];
  }
  if(!jobId){
    const data=await jsonRequest(`${config.baseUrl}/services/aigc/text2image/image-synthesis`,{method:'POST',headers:{...headers,'X-DashScope-Async':'enable'},body:JSON.stringify({model:config.model,input:{prompt},parameters:{size:config.model.startsWith('wan2.6')?'1280*1280':'1024*1024',n:1,prompt_extend:false,watermark:true}}),signal:timeout},fetcher);
    jobId=data?.output?.task_id;if(typeof jobId!=='string'||!/^[\w-]{1,160}$/.test(jobId))throw new ServiceError('绘图服务未返回任务 ID。',502);
    await onJob(jobId);
  }
  for(let attempt=0;attempt<70;attempt++){
    await wait(pollDelay,timeout);
    const data=await jsonRequest(`${config.baseUrl}/tasks/${encodeURIComponent(jobId)}`,{headers,signal:timeout},fetcher);
    if(data?.output?.task_status==='SUCCEEDED')return data.output.results?.[0];
    if(['FAILED','CANCELED','UNKNOWN'].includes(data?.output?.task_status))throw new ServiceError('绘图任务未完成，可能受到内容或服务限制。已保留任务编号以避免重复提交。',502);
  }
  throw new ServiceError('绘图仍在处理中。再次点击将继续查询同一任务，不会重复提交。',504);
}
export async function imageBytes(result,{fetcher=fetch,signal}={}){
  let bytes;
  if(typeof result?.b64_json==='string') {if(result.b64_json.length>24*1024*1024)throw new ServiceError('图片过大。',502);bytes=Buffer.from(result.b64_json,'base64');}
  else {
    let url;try{url=new URL(result?.url);}catch{throw new ServiceError('绘图结果没有有效图片。',502);}
    const allowed=['aliyuncs.com','volces.com','volccdn.com','byteimg.com'].some(host=>url.hostname.endsWith('.'+host));
    if(!allowed||url.protocol!=='https:'||url.username||url.password||url.port)throw new ServiceError('绘图返回了非受信的图片地址，已阻止下载。',502);
    const response=await fetcher(url,{redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000)});
    if(!response.ok||!/^image\/(png|jpeg|webp)/.test(response.headers.get('content-type')||''))throw new ServiceError('图片暂时无法下载。',502);
    const reader=response.body.getReader();const chunks=[];let size=0;
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>16*1024*1024){await reader.cancel();throw new ServiceError('图片超过 16 MB。',502);}chunks.push(value);}
    bytes=Buffer.concat(chunks);
  }
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;const webp=bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
  if(!png&&!jpeg&&!webp)throw new ServiceError('图片内容格式无法验证。',502);
  return {bytes,extension:png?'png':jpeg?'jpg':'webp',mime:png?'image/png':jpeg?'image/jpeg':'image/webp'};
}
