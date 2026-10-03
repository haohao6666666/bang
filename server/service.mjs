import fs from 'node:fs/promises';
import path from 'node:path';
import { createMemoryStore } from './memory.mjs';
import { createOrganizer } from './organizer.mjs';
import { randomUUID, createHash } from 'node:crypto';
import { chat, vision, defaults, imageGeneration, imageBytes, validateConfig } from './providers.mjs';
import { ServiceError, normalizeSnapshot, validateDraft, validateCompanionTask, validateMessages, validateCompanionResponse, validateAnalyzeFile, validateAnalyzeResponse, text, list, dateKey, SYSTEM_PROMPT, DAILY_SCHEMA } from './validation.mjs';

const readJson=async(file,fallback)=>{try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw new ServiceError('本机服务文件损坏，请先备份并检查 .local 目录。',500);}};
async function writeJson(file,value){await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(value,null,2),{mode:0o600});await fs.rename(temp,file);}
export function createService({dataDir=path.resolve('.local'),fetcher=fetch,env=process.env,pollDelay=2000}={}) {
  const configFile=path.join(dataDir,'model-config.json');const locks=new Set();
  async function config(){const stored=await readJson(configFile,{});const result={};for(const kind of ['text','vision','image']){
    // A saved blank key stays blank after switching providers; never send an old vendor's key elsewhere.
    if(stored[kind]){result[kind]={...defaults[kind],...stored[kind]};continue;}
    if(kind==='text'&&env.TOKEN_DANCE_API_KEY){
      result.text={provider:'tokendance',baseUrl:env.TOKEN_DANCE_BASE_URL||'https://tokendance.space/gateway/v1',model:env.TOKEN_DANCE_MODEL||'deepseek-v4.1-flash',apiKey:env.TOKEN_DANCE_API_KEY};
      continue;
    }
    const prefix=kind==='text'?'JIXIANG_TEXT_':kind==='vision'?'JIXIANG_VISION_':'JIXIANG_IMAGE_';const provider=env[prefix+'PROVIDER']||defaults[kind].provider;
    result[kind]={...defaults[kind],provider,baseUrl:env[prefix+'BASE_URL']||defaults[kind].baseUrl,model:env[prefix+'MODEL']||defaults[kind].model,apiKey:env[prefix+'API_KEY']||(['qwen','wan'].includes(provider)?env.DASHSCOPE_API_KEY||'':'')};
  }return result;}
  // The status contract keeps connection metadata for local diagnostics. The UI intentionally does not render it.
  const publicStatus=c=>({text:{provider:c.text.provider,baseUrl:c.text.baseUrl,model:c.text.model,configured:Boolean(c.text.apiKey)},vision:{provider:c.vision.provider,baseUrl:c.vision.baseUrl,model:c.vision.model,configured:Boolean(c.vision.apiKey)},image:{provider:c.image.provider,baseUrl:c.image.baseUrl,model:c.image.model,configured:Boolean(c.image.apiKey)},bookmarks:{zhihu:'import',xiaohongshu:'import'}});
  async function exclusive(key,fn){if(locks.has(key))throw new ServiceError('这一项正在处理中，请等待当前请求完成。',409);locks.add(key);try{return await fn();}finally{locks.delete(key);}}
  const memoryStore = createMemoryStore(dataDir);
  let organizer;
  async function callText(stage,snapshot,c,signal,extra={}){
    return chat(validateConfig(c.text,'text'),[{role:'system',content:SYSTEM_PROMPT},{role:'user',content:JSON.stringify({stage,instructions:stage==='C1'?'只理解本地事实，externalMatches必须为空。需要经验帮助时needsExternal=true；没有必要不要强行建议。':'将授权收藏中有用的部分适配本地事实，说明条件和局限。无相关原文则保留本地回声，不制造引用。',schema:DAILY_SCHEMA,snapshot,...extra})}],{fetcher,signal});
  }
  const service = {
    status:async()=>publicStatus(await config()),
    memoryStatus: memoryStore.status,
    memory: async body => body?.forget ? memoryStore.forget(body) : memoryStore.update(body),
    'memory-clear': async () => { await memoryStore.clear(); await organizer.purge({ keepStamps: true }); return { cleared: true }; },
    'memory-settings': async body => { const result = await memoryStore.setEnabled(body?.enabled); if (result.enabled) organizer.resume(); else await organizer.pause(); return result; },
    organize: body => organizer.enqueue(body),
    'background-results': () => organizer.results(),
    'background-edit': body => organizer.edit(body),
    'background-delete': async body => { await memoryStore.forget(body); return organizer.purge(body); },
    'stamp-edit': async body => {
      const day = dateKey(body.dateKey), file = path.join(dataDir, 'stamps', `${day}.json`), current = await readJson(file, null);
      if (!current) return { saved: false };
      if (body.remove) { await organizer.hideStamp(day); await fs.unlink(file); if (/^\/api\/ai\/stamp-assets\/[\w.-]+$/.test(current.imageUrl || '')) await fs.unlink(path.join(dataDir, 'stamps', current.imageUrl.split('/').at(-1))).catch(() => {}); }
      else await writeJson(file, { ...current, ...(typeof body.hidden === 'boolean' ? { hidden: body.hidden } : {}), ...(text(body.meaning, 220) ? { meaning: text(body.meaning, 220), edited: true } : {}) });
      return { saved: true };
    },
    configure:async body=>exclusive('config',async()=>{const old=await config();const next={};for(const kind of ['text','vision','image']){const incoming=body?.[kind]||old[kind]||defaults[kind];next[kind]=validateConfig(incoming,kind);if(!body?.[kind]?.apiKey&&next[kind].provider===old[kind].provider&&next[kind].baseUrl===old[kind].baseUrl)next[kind].apiKey=old[kind].apiKey;}await writeJson(configFile,next);return publicStatus(await config());}),
    echo:async(body,signal)=>exclusive('text',async()=>{
      if(body?.consent!==true)throw new ServiceError('需要确认本次发送范围。',403);
      const snapshot=normalizeSnapshot(body.snapshot), c=await config();const local={...snapshot,bookmarks:[]};
      // A title plus timer duration is not a description of what happened. Keep
      // this useful and honest without spending a model call on invented prose.
      const authoredEvidence=snapshot.evidence.filter(item=>['diary','outcome','note'].includes(item.kind));
      if(!authoredEvidence.length) {
        const focus=snapshot.evidence.find(item=>item.kind==='focus');
        const minutes=focus ? [text(focus.text,200)].filter(Boolean) : [];
        return {draft:{status:'draft',quiet:false,facts:minutes.slice(0,1).map((item,i)=>({id:`fact-${snapshot.dateKey}-${i}`,text:item,evidenceRefs:[{id:snapshot.evidence.find(e=>e.kind==='focus').id,kind:'focus',dateKey:snapshot.dateKey}]})),signals:[],sparkle:null,externalMatches:[],tomorrowExperiments:[],sourceNote:'目前只有任务名称和投入时长，尚不足以推断具体内容。完成后写下一句成果或笔记，回声才会有依据。'}};
      }
      const draft=validateDraft(await callText('C1',local,c,signal),local);
      // Collection adaptation is a separate, optional action. A normal daily
      // reflection is always one short model call, even when bookmarks exist.
      if(body.collectionConsent===true&&snapshot.bookmarks.length&&(draft.quiet||draft.signals.some(item=>item.needsExternal))){
        // Only explicit authorizations with readable original excerpts can reach C2.
        const context=snapshot.tasks.map(task=>task.title+' '+task.subject).join(' ')+' '+draft.signals.map(item=>item.title+' '+item.detail).join(' ');
        const terms=[...new Set(context.toLowerCase().match(/[\u4e00-\u9fff]{2}|[a-z]{3,}/g)||[])];
        const score=bookmark=>terms.reduce((sum,term)=>sum+((bookmark.title+' '+bookmark.excerpt).toLowerCase().includes(term)?1:0),0);
        const chosen={...snapshot,bookmarks:[...snapshot.bookmarks].sort((a,b)=>score(b)-score(a)).slice(0,6)};
        try {
          const enriched=validateDraft(await callText('C2',chosen,c,signal,{localDraft:draft}),chosen,true);
          return {draft:{...enriched,facts:draft.facts,signals:draft.signals,sparkle:draft.sparkle}};
        } catch(error) {
          if(signal?.aborted)throw error;
          return {draft:{...draft,sourceNote:'收藏适配本次未完成，已保留基于本地记录的草稿。没有加入未经验证的引用。'}};
        }
      }
      return {draft};
    }),
    companion:async(body,signal)=>exclusive('text',async()=>{
      if(body?.consent!==true)throw new ServiceError('需要确认本次对话会发送任务信息。',403);
      const task=validateCompanionTask(body?.task);const messages=validateMessages(body?.messages);
      if(!messages.some(item=>item.role==='user')) return {reply:'刚才这段时间，你具体完成了哪一步？可以写下一句，或选择分享一份成果。'};
      const last = messages.filter(item => item.role === 'user').at(-1)?.content || '';
      if (/忘掉这件事|忘记这件事|记错了/.test(last)) {
        await memoryStore.forget({ taskId: task.id, allDates: true });
        await organizer.purge({ taskId: task.id });
        const correction = /记错了[，,。:：\s]*(.+)/.exec(last)?.[1];
        if (correction && (await memoryStore.settings()).enabled) await memoryStore.update({ eventKey: `correction:${Date.now()}`, taskId: task.id, dateKey: body.dateKey || new Date().toISOString().slice(0,10), userQuotes: [correction] });
        return { reply: correction ? '好，已经按你刚说的改好了。' : /记错了/.test(last) ? '我先把这件事的旧记忆清掉。你愿意的话，告诉我哪里记错了。' : '好，这件事的后台记忆已经清掉了。', forgotten: true };
      }
      const c=await config();
      const memory = body.remember !== false && (await memoryStore.settings()).enabled ? await memoryStore.context(task.id) : [];
      await organizer.reserve('text');
      const input={task:{id:task.id,title:task.title},messages,memory};
      const raw=await chat(validateConfig(c.text,'text'),[{role:'system',content:`${SYSTEM_PROMPT}\n你是记得用户的小狗伙伴，不是答疑导师或能力评估工具。结合这项任务和用户原话自然接话。默认一两句，不每次追问，不泛泛夸奖，不强行给建议。用户没说的内容不要猜。历史记忆中的 userQuotes 是用户原话，其他不是用户原话。输出 JSON {reply:简短回应}，不输出内部文档。`},{role:'user',content:JSON.stringify({input})}],{fetcher,signal});
      return validateCompanionResponse(raw,task,messages);
    }),
    analyze:async(body,signal)=>exclusive('text',async()=>{
      if(body?.consent!==true)throw new ServiceError('需要确认本次成果会发送给模型。',403);
      const task=validateCompanionTask({...body?.task,actualMinutes:Number(body?.task?.actualMinutes)||0});const file=validateAnalyzeFile(body?.file);const c=await config();
      const schema={summary:'可核对的简短摘要',observations:[{text:'直接看到或读到的内容',quote:'文本中的逐字片段'}],uncertainties:['无法从成果确认的部分'],nextStep:'可选的一步'};
      let raw;
      if(file.text) {
        raw=await chat(validateConfig(c.text,'text'),[{role:'system',content:`${SYSTEM_PROMPT}\n你是成果文档观察助手。只引用文档原文可核对的内容，不把任务标题或时长当成成果。每条 observation 必须带 quote，quote 必须逐字来自输入文本。若内容不足，写 uncertainties。输出 JSON。`},{role:'user',content:JSON.stringify({stage:'ANALYZE_TEXT',task,file:{name:file.name,mime:file.mime,text:file.text},schema})}],{fetcher,signal});
      } else {
        if(!/^data:image\//.test(file.dataUrl))throw new ServiceError('PDF 或其他文档请先提供可读取的文本内容。');
        raw=await vision(validateConfig(c.vision,'vision'),`任务标题仅用于上下文，不代表成果事实：${task.title}。只描述图片中直接可见或可读的内容。输出 JSON，summary、observations、uncertainties、nextStep；不要猜测图片外的信息。`,file.dataUrl,{fetcher,signal});
      }
      return validateAnalyzeResponse(raw,file);
    }),
    weekly:async(body,signal)=>exclusive('text',async()=>{
      if(body?.consent!==true)throw new ServiceError('需要确认本次发送范围。',403);
      const start=dateKey(body.rangeStart),end=dateKey(body.rangeEnd);
      if(end<start||(Date.parse(end)-Date.parse(start))/86400000>6)throw new ServiceError('周回声需要一个连续七天内的范围。');
      const days=list(body.snapshots,7).map(normalizeSnapshot).filter(day=>day.dateKey>=start&&day.dateKey<=end);
      if(new Set(days.filter(day=>day.evidence.some(e=>e.kind==='diary')).map(day=>day.dateKey)).size<3)throw new ServiceError('这个七天周期至少需要三个不同日期的日记，并授权它们参与分析。');
      const c=await config();const raw=await chat(validateConfig(c.text,'text'),[{role:'system',content:SYSTEM_PROMPT},{role:'user',content:JSON.stringify({stage:'CW',instruction:'总结可以验证的趋势。每条观察至少使用2个不同日期的具体证据。不能把缺席当成失败。',schema:{observations:[{text:'观察',evidenceIds:['证据ID'],evidenceDates:['YYYY-MM-DD','YYYY-MM-DD']}]},days:days.map(day=>({...day,bookmarks:[]}))})}],{fetcher,signal});
      const evidence=new Map(days.flatMap(day=>day.evidence).map(e=>[e.id,e]));
      const observations=list(raw?.observations,5).flatMap((item,i)=>{const ids=list(item?.evidenceIds,20);if(!ids.length||ids.some(id=>!evidence.has(id)))return[];const dates=[...new Set(ids.map(id=>evidence.get(id).dateKey))];return dates.length>=2&&text(item.text)?[{id:`weekly-${end}-${i}`,text:text(item.text),evidenceDates:dates}]:[];});
      if(!observations.length)throw new ServiceError('周回声没有满足跨日期证据要求的观察，未保存。',502);
      return {draft:{status:'draft',rangeStart:start,rangeEnd:end,observations}};
    }),
    stamps:async()=>{const files=await fs.readdir(path.join(dataDir,'stamps')).catch(()=>[]);const stamps=[];for(const name of files.filter(name=>/^\d{4}-\d{2}-\d{2}\.json$/.test(name))){const stamp=await readJson(path.join(dataDir,'stamps',name),null);if(stamp?.imageUrl){const {prompt,model,...safe}=stamp;void prompt;void model;stamps.push(safe);}}return {stamps};},
    stamp:async(body,signal)=>{
      const day=dateKey(body?.dateKey);
      return exclusive('image',async()=>{
        if(body.consent!==true&&body.automatic!==true)throw new ServiceError('请确认绘图说明后再生成。',403);
        const snapshot=normalizeSnapshot(body.snapshot);if(snapshot.dateKey!==day)throw new ServiceError('印章日期与证据日期不一致。');
        const evidenceIds=list(body.evidenceIds,30);if(!evidenceIds.length||evidenceIds.some(id=>!snapshot.evidence.some(item=>item.id===id&&item.kind!=='task')))throw new ServiceError('印章需要同一天的投入、成果、日记或便签作为依据。');
        if(body.automatic===true&&!evidenceIds.some(id=>snapshot.evidence.some(item=>item.id===id&&['outcome','note','diary'].includes(item.kind))))throw new ServiceError('没有具体作品或经历，暂不生成印章。');
        const brief=text(body.brief,500);if(brief.length<4)throw new ServiceError('请写下一句当天的绘图说明。');
        const eventKey=text(body.eventKey,220)||evidenceIds.slice().sort().join('|');
        const stampFile=path.join(dataDir,'stamps',`${day}.json`),jobFile=path.join(dataDir,'stamps',`${day}.job.json`);
        const existing=await readJson(stampFile,null);if(existing){const {prompt,model,...safe}=existing;void prompt;void model;return {stamp:safe};}
        await organizer.reserve('image');
        const c=await config(),imageConfig=validateConfig(c.image,'image');
        const oldJob=await readJson(jobFile,null);
        if(oldJob?.provider&&(oldJob.provider!==imageConfig.provider||oldJob.baseUrl!==imageConfig.baseUrl||oldJob.model!==imageConfig.model))throw new ServiceError('这一天已有绘图任务，请恢复原厂商、API 地址和模型后继续查询，避免重复计费。',409);
        const prompt=oldJob?.prompt||`为儿童学习手账「迹向」绘制一枚独立圆形纪念印章，温柔米白纸张背景，精细水粉和彩铅，少量印泥质感，清晰完整的圆形轮廓，低饱和草木绿、杏桃、雾蓝；可包含头顶嫩芽的奶油色垂耳小狗。请用画面表现下列经历，不输出文字、日期、姓名，不包含暴力、成人、恐怖元素或等级排名：${brief}。这是个人纪念，不是奖惩。`;
        const result=await imageGeneration(imageConfig,prompt,{fetcher,signal,pollDelay,jobId:oldJob?.jobId,onJob:jobId=>writeJson(jobFile,{jobId,prompt,provider:imageConfig.provider,model:imageConfig.model,baseUrl:imageConfig.baseUrl,evidenceIds,brief,createdAt:Date.now()})});
        const {bytes,extension}=await imageBytes(result,{fetcher,signal});
        const id=createHash('sha256').update(bytes).digest('hex').slice(0,24);const fileName=`${day}-${id}.${extension}`;
        await fs.mkdir(path.dirname(stampFile),{recursive:true});await fs.writeFile(path.join(dataDir,'stamps',fileName),bytes);
        const sourceTaskId=text(body.sourceTaskId,180);
        const stamp={id:`day-${day}-${id}`,dateKey:day,...(sourceTaskId?{sourceTaskId}:{}),imageUrl:`/api/ai/stamp-assets/${fileName}`,title:'记住这一步',meaning:oldJob?.brief||brief,createdAt:Date.now(),evidenceIds:oldJob?.evidenceIds||evidenceIds,eventKey};
        await writeJson(stampFile,stamp);return {stamp};
      });
    },
    asset:async name=>{if(!/^\d{4}-\d{2}-\d{2}-[a-f0-9]{24}\.(png|jpg|webp)$/.test(name))throw new ServiceError('图片不存在。',404);try{return {bytes:await fs.readFile(path.join(dataDir,'stamps',name)),mime:name.endsWith('.png')?'image/png':name.endsWith('.jpg')?'image/jpeg':'image/webp'};}catch{throw new ServiceError('图片不存在。',404);}}
  };
  organizer = createOrganizer({ dataDir, memory: memoryStore, env,
    review: async snapshot => { const c = await config(); return chat(validateConfig(c.text,'text'), [{role:'system',content:`${SYSTEM_PROMPT}\n把这些用户亲自留下的具体内容整理成一两句简短回看。没有值得补充的就输出空 text。不要评价能力或情绪，不要固定日报格式。只在相关时引用授权收藏的原文，引用必须逐字匹配。输出 JSON {text,evidenceIds,references:[{bookmarkId,quote}]}。`}, {role:'user',content:JSON.stringify(snapshot)}], {fetcher}); },
    draw: async body => { if (body.remove) { const f=path.join(dataDir,'stamps',`${dateKey(body.dateKey)}.json`);const saved=await readJson(f,null);if(saved){await fs.unlink(f);if(/^\/api\/ai\/stamp-assets\/[\w.-]+$/.test(saved.imageUrl||''))await fs.unlink(path.join(dataDir,'stamps',saved.imageUrl.split('/').at(-1))).catch(()=>{});}return; } return service.stamp(body); }
  });
  organizer.resume();
  return service;
}
