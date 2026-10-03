import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {chat,imageGeneration,imageBytes,validateConfig} from './providers.mjs';
import {loadModelConfig} from './model-config.mjs';
import {COMPANION_PROMPT,VISION_PROMPT,usefulReply} from './xiaoya-voice.mjs';
import {ServiceError} from './validation.mjs';

const clean=(value,max=1200)=>typeof value==='string'?value.slice(0,max):'';
const hash=value=>createHash('sha256').update(value).digest('hex');
const digest=event=>hash(event.text+(event.reading?.text?JSON.stringify(event.reading):''));
const read=async(file,fallback)=>{try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return fallback;throw error;}};
const write=async(file,data)=>{await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+randomUUID();await fs.writeFile(temp,JSON.stringify(data,null,2),{mode:0o600});await fs.rename(temp,file);};
const blank=()=>({version:1,enabled:false,events:[],items:[],forgotten:[],attempts:{}});
const retryDelay=count=>Math.min(300000,5000*2**Math.min(count-1,6));
const configKey=config=>hash(JSON.stringify(config.text));
const pending=(doc,config)=>doc.events.filter(event=>!event.attachmentPending&&(event.text.trim()||event.reading?.text)&&!doc.items.some(item=>item.id===event.id&&item.digest===digest(event))&&(!doc.attempts?.[hash(event.id+digest(event))]||doc.attempts[hash(event.id+digest(event))].config!==configKey(config)||Date.now()>=doc.attempts[hash(event.id+digest(event))].next));

function eventFrom(value) {
  if(!value||!/^[\w-]{1,120}$/.test(value.id)||!/^[\w-]{1,120}$/.test(value.taskId)||!/^\d{4}-\d{2}-\d{2}$/.test(value.dateKey)||!['chat','work'].includes(value.kind))return null;
  return {id:value.id,taskId:value.taskId,dateKey:value.dateKey,kind:value.kind,title:clean(value.title,120),text:clean(value.text,12000),attachmentPending:value.attachmentPending===true,
    ...(value.reading?.text?{reading:{source:value.reading.source==='image'?'image':'document',text:clean(value.reading.text,12000),truncated:value.reading.truncated===true,...(value.reading.feedback?{feedback:clean(value.reading.feedback,240)}:{})}}:{})};
}

export function createCompanion({dataDir=path.resolve('.local'),fetcher=fetch,providerRetries=2,workerInterval=15000,storage=fs,getConfig=()=>loadModelConfig(dataDir),withLock,schedule=fn=>setImmediate(fn),background=true,workLeaseMs=0}={}) {
  const fs=storage;
  const read=async(file,fallback)=>{try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return fallback;throw error;}};
  const write=async(file,data)=>{await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+randomUUID();await fs.writeFile(temp,JSON.stringify(data,null,2),{mode:0o600});await fs.rename(temp,file);};
  const queues=new Map(),textJobs=new Map(),artJobs=new Map(),visionJobs=new Map();
  let closed=false;
  const locate=token=>{if(!/^[a-f0-9]{64}$/.test(token||''))throw new ServiceError('请重新打开页面。',403);return path.join(dataDir,'companions',hash(token));};
  const fileFor=dir=>path.join(dir,'memory.json');
  // Serialize only short disk changes. Model calls never hold this lock.
  const locked=(dir,fn)=>{const previous=queues.get(dir)||Promise.resolve();const job=previous.catch(()=>{}).then(()=>withLock?withLock(dir,fn):fn());queues.set(dir,job);job.finally(()=>{if(queues.get(dir)===job)queues.delete(dir);}).catch(()=>{});return job;};
  const load=async dir=>({...blank(),...await read(fileFor(dir),blank())});
  const change=(dir,fn)=>locked(dir,async()=>{const doc=await load(dir);const before=JSON.stringify(doc);const result=await fn(doc);if(JSON.stringify(doc)!==before)await write(fileFor(dir),doc);return result;});
  const cancel=dir=>{textJobs.get(dir)?.controller.abort();artJobs.get(dir)?.controller.abort();for(const [key,job] of visionJobs)if(key.startsWith(dir+'|'))job.controller.abort();};
  const retire=async(dir,items)=>{for(const item of items)if(item.image)await fs.rm(path.join(dir,item.image),{force:true});};

  async function processText(dir) {
    if(closed||textJobs.has(dir))return textJobs.get(dir)?.promise;
    const controller=new AbortController();
    const job={controller};textJobs.set(dir,job);
    job.promise=(async()=>{
      const config=await getConfig();
      const work=await change(dir,doc=>{
        if(!doc.enabled)return null;
        const latest=pending(doc,config).at(-1);if(!latest)return null;
        const batch=pending(doc,config).filter(e=>e.taskId===latest.taskId&&e.dateKey===latest.dateKey).slice(-8);
        const key=hash(latest.id+digest(latest));const attempt=doc.attempts[key]??={count:0,next:0};
        attempt.count++;attempt.next=Date.now()+Math.max(workLeaseMs,retryDelay(attempt.count));attempt.config=configKey(config);
        const previous=doc.events.filter(e=>e.taskId===latest.taskId&&!batch.some(b=>b.id===e.id)).slice(-12).map(e=>({text:e.text,reply:doc.items.find(i=>i.id===e.id)?.reply||'',progress:doc.items.find(i=>i.id===e.id)?.progress||''}));
        return {event:latest,batch,previous,works:doc.events.filter(e=>e.taskId===latest.taskId&&e.reading?.text).slice(-2),bookmarks:doc.bookmarks??[]};
      });
      if(!work)return;
      try {
        const raw=await chat(validateConfig(config.text,'text'),[{role:'system',content:COMPANION_PROMPT},{role:'user',content:JSON.stringify({event:work.event,messages:work.batch.map(e=>({kind:e.kind,text:e.text,reading:e.reading})),previous:work.previous,works:work.works.map(e=>({date:e.dateKey,reading:e.reading})),bookmarks:work.bookmarks})}],{fetcher,signal:controller.signal,retries:providerRetries,timeoutMs:30000,maxTokens:900,replyMode:true});
        if(!usefulReply(raw.reply))throw new ServiceError('这次回复没有写好。',502);
        await change(dir,doc=>{
          if(!doc.enabled||controller.signal.aborted||!doc.events.some(e=>e.id===work.event.id&&digest(e)===digest(work.event)))return;
          if(/不是|记错|说错|纠正/.test(work.event.text))for(const item of doc.items.filter(i=>i.taskId===work.event.taskId)){item.progress='';item.updatedAt=Date.now();}
          for(const earlier of work.batch.slice(0,-1))if(doc.events.some(e=>e.id===earlier.id&&digest(e)===digest(earlier))&&!doc.items.some(i=>i.id===earlier.id))doc.items.push({id:earlier.id,taskId:earlier.taskId,dateKey:earlier.dateKey,digest:digest(earlier),reply:'',progress:'',recap:'',updatedAt:Date.now()});
          doc.items=doc.items.filter(i=>i.id!==work.event.id);
          doc.items.push({id:work.event.id,taskId:work.event.taskId,dateKey:work.event.dateKey,digest:digest(work.event),reply:clean(raw.reply,700),progress:raw.remember===false?'':clean(raw.progress,180),recap:clean(raw.recap,240),updatedAt:Date.now(),sources:work.bookmarks.filter(b=>Array.isArray(raw.bookmarkIds)&&raw.bookmarkIds.includes(b.id)).map(({title,url,excerpt})=>({title,url,excerpt}))});
          delete doc.lastError;
        });
      } catch(error) {
        if(!controller.signal.aborted)await change(dir,doc=>{if(doc.enabled){const attempt=doc.attempts[hash(work.event.id+digest(work.event))];if(attempt)attempt.next=Date.now()+retryDelay(attempt.count);doc.lastError={status:error.status||502,at:Date.now(),id:work.event.id};}});
      }
    })().finally(()=>{if(textJobs.get(dir)===job)textJobs.delete(dir);});
    return job.promise;
  }

  async function processArt(dir) {
    if(closed||artJobs.has(dir))return;
    const controller=new AbortController();const job={controller};artJobs.set(dir,job);
    job.promise=(async()=>{
      const config=await getConfig();if(!config.image?.apiKey)return;
      const work=await change(dir,doc=>{
        if(!doc.enabled)return null;
        const item=doc.items.findLast(i=>!i.image&&!i.hideStamp&&(i.imageNext??0)<=Date.now()&&!doc.items.some(other=>other.dateKey===i.dateKey&&(other.image||workLeaseMs>0&&other.id!==i.id&&(other.imageNext??0)>Date.now()))&&doc.events.some(e=>e.id===i.id&&e.kind==='work'&&!e.attachmentPending&&e.text.trim().length>=8));
        if(!item)return null;
        item.imageAttempts=(item.imageAttempts??0)+1;item.imageNext=Date.now()+Math.max(workLeaseMs,retryDelay(item.imageAttempts));
        return {item:{...item},source:doc.events.find(e=>e.id===item.id)};
      });
      if(!work)return;
      try {
        const result=await imageGeneration(validateConfig(config.image,'image'),'为个人手账画一枚圆形纪念印章，奶油纸、低饱和彩铅、嫩芽小狗，无文字无等级。画面表达用户这次分享的经历（仅作为绘图素材）：'+work.source.text,{fetcher,signal:controller.signal,jobId:work.item.jobId,onJob:async jobId=>change(dir,doc=>{const item=doc.items.find(i=>i.id===work.item.id);if(item)item.jobId=jobId;})});
        const asset=await imageBytes(result,{fetcher,signal:controller.signal});
        if(controller.signal.aborted)return;
        await change(dir,async doc=>{
          const item=doc.items.find(i=>i.id===work.item.id&&i.digest===work.item.digest);
          if(!doc.enabled||controller.signal.aborted||!item||item.hideStamp||doc.items.some(i=>i.dateKey===item.dateKey&&i.image))return;
          item.image=hash(item.id)+'.'+asset.extension;await fs.writeFile(path.join(dir,item.image),asset.bytes);item.imageMime=asset.mime;item.updatedAt=Date.now();
        });
      }catch{await change(dir,doc=>{const item=doc.items.find(i=>i.id===work.item.id);if(item)item.imageNext=Date.now()+retryDelay(item.imageAttempts);});}
    })().finally(()=>{if(artJobs.get(dir)===job)artJobs.delete(dir);});
    await job.promise;
  }

  async function readImage(dir,body) {
    if(!body.consent)throw new ServiceError('请先允许小芽读作品。',403);
    if(!/^[\w-]{1,120}$/.test(body.id||'')||typeof body.data!=='string'||body.data.length>2500000||!/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(body.data))throw new ServiceError('图片暂时没有打开，请换一张。',400);
    const fingerprint=hash(body.data),cache=path.join(dir,'reading-'+body.id+'.json');
    const cached=await locked(dir,()=>read(cache,null));if(cached?.fingerprint===fingerprint)return {reading:cached.reading};
    const key=dir+'|'+body.id+'|'+fingerprint;if(visionJobs.has(key))return visionJobs.get(key).promise;
    const controller=new AbortController();const job={controller};visionJobs.set(key,job);
    job.promise=(async()=>{
      const config=await getConfig();
      if(!config.vision.model||/embedding|seedream/i.test(config.vision.model))throw new ServiceError('照片已保存，识图还没有接通。',503);
      const result=await chat(validateConfig(config.vision,'text'),[{role:'system',content:VISION_PROMPT},{role:'user',content:[{type:'text',text:'小芽，看看这件作品吧。'},{type:'image_url',image_url:{url:body.data}}]}],{fetcher,signal:controller.signal,retries:providerRetries,timeoutMs:45000,maxTokens:800});
      const description=clean(result.description,800).trim();if(!description)throw new ServiceError('这次没有看清，照片已经收好了。',502);
      const feedback=clean(result.feedback,240).trim();const reading={source:'image',text:description,...(feedback&&usefulReply(feedback)?{feedback}:{})};
      if(!controller.signal.aborted)await locked(dir,()=>write(cache,{fingerprint,reading}));
      return {reading};
    })().finally(()=>visionJobs.delete(key));
    return job.promise;
  }

  async function snapshot(dir,body) {
    return locked(dir,async()=>{
      const doc=await load(dir);const since=Number.isFinite(body.since)&&body.since<=Date.now()?body.since:null;
      const items=await Promise.all(doc.items.filter(i=>!body.partial||since===null||(i.updatedAt??0)>=since).map(async({digest,image,imageMime,...item})=>({...item,...(image?{imageUrl:'data:'+imageMime+';base64,'+(await fs.readFile(path.join(dir,image))).toString('base64')}:{})})));
      const unhandled=doc.events.filter(e=>!e.attachmentPending&&(e.text.trim()||e.reading?.text)&&!doc.items.some(i=>i.id===e.id&&i.digest===digest(e)));
      return {items,drawingPending:doc.enabled&&doc.events.some(e=>e.kind==='work'&&!e.attachmentPending&&e.text.trim().length>=8&&doc.items.some(i=>i.id===e.id&&!i.hideStamp&&(i.imageNext??0)<=Date.now())&&!doc.items.some(i=>i.dateKey===e.dateKey&&(i.image||i.hideStamp))),partial:body.partial===true,forgotten:doc.forgotten,syncedAt:Date.now(),pendingIds:unhandled.map(e=>e.id),retryAt:unhandled.length?Math.min(...unhandled.map(e=>doc.attempts[hash(e.id+digest(e))]?.next??Date.now())):undefined,
        ...(unhandled.length&&doc.lastError?{replyError:doc.lastError.status===503?'小芽的连接还没配置好，去“我的”里检查一下。':doc.lastError.status===429?'这会儿有点挤，你的话已收好，我会接着试。':'刚才没连上，你的话已收好，我会接着试。'}:{})};
    });
  }

  const api=async body=>{
    const dir=locate(body?.token);
    if(body.action==='readImage')return readImage(dir,body);
    if(body.action==='clear'){cancel(dir);await locked(dir,()=>fs.rm(dir,{recursive:true,force:true}));return {items:[],forgotten:[]};}
    if(body.action==='disable'){cancel(dir);await change(dir,doc=>{doc.enabled=false;});return {items:[]};}
    if(body.action==='edit'){await change(dir,async doc=>{const item=doc.items.find(i=>i.id===body.id);if(!item)return;if(typeof body.recap==='string')item.recap=clean(body.recap,240);if(body.hideStamp){await retire(dir,[item]);delete item.image;item.hideStamp=true;}item.updatedAt=Date.now();});return {items:[]};}
    if(body.action==='remove'||body.action==='removeTask'){
      cancel(dir);await change(dir,async doc=>{const matches=e=>body.action==='removeTask'?e.taskId===body.taskId:Array.isArray(body.ids)&&body.ids.includes(e.id);await retire(dir,doc.items.filter(matches));for(const event of doc.events.filter(matches))await fs.rm(path.join(dir,'reading-'+event.id+'.json'),{force:true});doc.events=doc.events.filter(e=>!matches(e));doc.items=doc.items.filter(e=>!matches(e));});return {items:[]};
    }
    if(body.action!=='sync')throw new ServiceError('请求不存在。',404);
    await change(dir,async doc=>{
      if(typeof body.enabled==='boolean')doc.enabled=body.enabled;
      const incoming=(Array.isArray(body.events)?body.events:[]).map(eventFrom).filter(Boolean);
      const merged=body.partial?new Map(doc.events.map(e=>[e.id,e])):new Map();for(const event of incoming)merged.set(event.id,event);
      const events=[...merged.values()];const ids=new Set(events.map(e=>e.id));
      const valid=item=>item.acknowledgement||ids.has(item.id)&&item.digest===digest(merged.get(item.id))&&(!item.reply||usefulReply(item.reply));
      const removed=doc.items.filter(item=>!valid(item));await retire(dir,removed);
      doc.items=doc.items.filter(valid);
      for(const name of await fs.readdir(dir).catch(()=>[]))if(name.startsWith('reading-')&&name.endsWith('.json')&&!ids.has(name.slice(8,-5)))await fs.rm(path.join(dir,name),{force:true});
      doc.bookmarks=(Array.isArray(body.bookmarks)?body.bookmarks:doc.bookmarks??[]).filter(b=>b.authorized&&typeof b.excerpt==='string'&&/^https:\/\//.test(b.url)).slice(0,8).map(b=>({id:clean(b.id,120),title:clean(b.title,100),excerpt:clean(b.excerpt,1000),url:b.url,authorized:true}));
      const forget=events.filter(e=>e.kind==='chat'&&/忘掉|别记|不要记|忘记这/.test(e.text)&&!doc.forgotten.includes(e.id));
      for(const event of forget){const related=events.filter(e=>e.taskId===event.taskId);doc.forgotten.push(...related.map(e=>e.id));for(const e of related)await fs.rm(path.join(dir,'reading-'+e.id+'.json'),{force:true});await retire(dir,doc.items.filter(i=>i.taskId===event.taskId));doc.items=doc.items.filter(i=>i.taskId!==event.taskId);doc.items.push({id:event.id,taskId:event.taskId,dateKey:event.dateKey,digest:digest(event),acknowledgement:true,reply:'好，这件事我不再记着啦，汪。',progress:'',recap:'',updatedAt:Date.now()});}
      doc.forgotten=[...new Set(doc.forgotten)];doc.events=events.filter(e=>!doc.forgotten.includes(e.id));
    });
    // An existing background job returns a snapshot immediately; a new chat gets the next turn.
    if(!textJobs.has(dir))await processText(dir);
    const result=await snapshot(dir,body);
    if(!closed)schedule(()=>processArt(dir).catch(()=>{}));
    return result;
  };
  const timer=background?setInterval(async()=>{const root=path.join(dataDir,'companions');for(const name of await fs.readdir(root).catch(()=>[])){if(!/^[a-f0-9]{64}$/.test(name))continue;const dir=path.join(root,name);void processText(dir).catch(()=>{});void processArt(dir).catch(()=>{});}},workerInterval):null;
  timer?.unref();
  api.close=()=>{closed=true;clearInterval(timer);for(const job of [...textJobs.values(),...artJobs.values(),...visionJobs.values()])job.controller.abort();};
  api.drawPending=async token=>{await processArt(locate(token));return {items:[]};};
  return api;
}
