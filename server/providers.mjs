import { ServiceError, text } from './validation.mjs';
export const defaults = {
  text:{provider:'qwen',baseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1',model:'qwen-plus',apiKey:''},
  image:{provider:'wan',baseUrl:'https://dashscope.aliyuncs.com/api/v1',model:'wan2.2-t2i-flash',apiKey:''}
};
export function validateConfig(part, kind) {
  if (!part || typeof part !== 'object') throw new ServiceError('模型配置不完整。');
  const providers=kind==='text'?['qwen','deepseek','doubao','tokendance']:['wan','doubao'];
  if(!providers.includes(part.provider)) throw new ServiceError('不支持这个模型服务。');
  let url; try{url=new URL(part.baseUrl);}catch{throw new ServiceError('请填写官方 HTTPS API 地址。');}
  const ali=url.hostname==='dashscope.aliyuncs.com'||/^[a-z0-9-]+\.cn-beijing\.maas\.aliyuncs\.com$/.test(url.hostname);
  const allowed=(['qwen','wan'].includes(part.provider)&&ali)||(part.provider==='deepseek'&&url.hostname==='api.deepseek.com')||(part.provider==='doubao'&&url.hostname==='ark.cn-beijing.volces.com')||(part.provider==='tokendance'&&url.hostname==='tokendance.space'&&url.pathname.replace(/\/$/,'')==='/gateway/v1');
  if(!allowed||url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash) throw new ServiceError('地址必须是所选厂商的官方 API 地址，或已确认的 Token Dance 网关。');
  const model=text(part.model,160); if(!model || !/^[a-zA-Z0-9._:/-]+$/.test(model)) throw new ServiceError('请填写控制台中的有效模型名称或接入点 ID。');
  return {provider:part.provider,baseUrl:url.href.replace(/\/$/,''),model,apiKey:text(part.apiKey,1024)};
}
async function jsonRequest(url, options, fetcher) {
  let response;
  try { response=await fetcher(url,{...options,redirect:'error'}); } catch(e) {
    const error=new ServiceError(e.name==='AbortError'||e.name==='TimeoutError'?'模型请求超时或已取消，请稍后重试。':'无法连接模型服务，请检查网络与官方 API 地址。',e.name==='AbortError'||e.name==='TimeoutError'?504:502);
    error.retryable=!options.signal?.aborted || options.signal.reason?.name==='TimeoutError'; throw error;
  }
  if(!response.ok) {
    const error=await response.json().catch(()=>({}));
    if(error?.error?.code==='ModelNotOpen')throw new ServiceError('照片已保存，识图模型还需要在方舟控制台开通。',503);
    const failure=new ServiceError(response.status===401||response.status===403?'模型鉴权失败，请检查 API Key 和模型权限。':response.status===429?'模型服务暂时繁忙，正在等待重试。':`模型服务返回错误（${response.status}），未保存结果。`,response.status===429?429:502);
    failure.retryable=response.status===429||response.status>=500;
    const retryAfter=response.headers.get('retry-after');
    failure.retryAfter=retryAfter?Math.min(30000,Math.max(0,Number(retryAfter)*1000||Date.parse(retryAfter)-Date.now())):0;
    throw failure;
  }
  const reader=response.body?.getReader();if(!reader)throw new ServiceError('模型返回了空内容。',502);
  const chunks=[];let size=0;
  try {while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>24*1024*1024){await reader.cancel();throw new ServiceError('模型结果超过大小限制。',502);}chunks.push(value);}}
  catch(error){if(error instanceof ServiceError)throw error;const failure=new ServiceError('模型连接中断，正在等待重试。',502);failure.retryable=true;throw failure;}
  const content=Buffer.concat(chunks).toString('utf8');
  try{return JSON.parse(content);}catch{throw new ServiceError('模型服务没有返回有效 JSON。',502);}
}
export async function chat(config, messages, {fetcher=fetch,signal,retries=0,timeoutMs=90000,maxTokens=5000,replyMode=false,retryBaseMs=1000}={}) {
  if(!config.apiKey) throw new ServiceError('尚未配置文本模型 API Key，请在「我的 → 模型与收藏」中填写。',503);
  const body={model:config.model,messages,stream:false,response_format:{type:'json_object'},max_tokens:maxTokens};
  if(config.provider==='qwen')body.enable_thinking=false;
  for(let attempt=0;;attempt++) {
    try {
      const timeout=signal?AbortSignal.any([signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs);
      const data=await jsonRequest(`${config.baseUrl}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:timeout},fetcher);
      const supplied=data?.choices?.[0]?.message?.content;
      const content=Array.isArray(supplied)?supplied.map(part=>part.text||'').join(''):supplied;
      if(typeof content!=='string'||!content.trim()) { const error=new ServiceError('模型这次没有回复内容。',502); error.retryable=true; throw error; }
      const trimmed=content.replace(/^\s*```(?:json)?\s*/,'').replace(/\s*```\s*$/,'').trim();
      try { return JSON.parse(trimmed); }
      catch {
        if(replyMode&&!/^[{\[]/.test(trimmed)&&!trimmed.includes('"reply"'))return {reply:trimmed};
        const error=new ServiceError('模型返回的 JSON 不完整，请重试。',502);error.retryable=true;throw error;
      }
    } catch(error) {
      if(signal?.aborted||!error.retryable||attempt>=retries)throw error;
      await wait(Math.max(error.retryAfter||0,retryBaseMs*2**attempt),signal);
    }
  }
}
const wait=(ms,signal)=>new Promise((resolve,reject)=>{const done=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);resolve();}; const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new ServiceError('已停止等待绘图；已提交的模型任务可能仍产生费用。',499));}; const timer=setTimeout(done,ms);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();});
export async function imageGeneration(config,prompt,{fetcher=fetch,signal,onJob=async()=>{},jobId,pollDelay=2000}={}) {
  if(!config.apiKey)throw new ServiceError('尚未配置绘图模型 API Key，请先在设置中填写。',503);
  const headers={Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json'};
  const timeout=signal?AbortSignal.any([signal,AbortSignal.timeout(180000)]):AbortSignal.timeout(180000);
  if(config.provider==='doubao'){
    const body={model:config.model,prompt,size:'2048x2048',response_format:'b64_json',watermark:true};
    if(!/^doubao-seedream-5-0-(pro|flash)/.test(config.model))body.sequential_image_generation='disabled';
    const data=await jsonRequest(`${config.baseUrl}/images/generations`,{method:'POST',headers,body:JSON.stringify(body),signal:timeout},fetcher);
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
