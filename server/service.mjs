import fs from 'node:fs/promises';
import path from 'node:path';
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
  const memoryDir=path.join(dataDir,'memory');
  const safeMemoryPart=value=>String(value||'local').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,120)||'local';
  async function memoryFiles(){const files=await fs.readdir(memoryDir,{withFileTypes:true}).catch(()=>[]);const result=[];for(const entry of files){if(!entry.isDirectory())continue;const nested=await fs.readdir(path.join(memoryDir,entry.name)).catch(()=>[]);result.push(...nested.filter(name=>/^\d{4}-\d{2}-\d{2}\.json$/.test(name)).map(name=>path.join(memoryDir,entry.name,name)));}return result;}
  async function memoryStatus(){return {enabled:true,count:(await memoryFiles()).length};}
  async function updateMemory(body){
    const date=dateKey(body?.dateKey), taskId=text(body?.taskId,180)||'unlinked', eventKey=text(body?.eventKey,220);
    if(!eventKey)throw new ServiceError('记忆事件缺少标识。');
    const quotes=list(body?.userQuotes,8).map(item=>text(item,500)).filter(Boolean);
    const nextStep=text(body?.nextStep,500);
    if(!quotes.length&&!nextStep)return {stored:false};
    const file=path.join(memoryDir,safeMemoryPart(taskId),`${date}.json`);const current=await readJson(file,{version:1,taskId,dateKey:date,quotes:[],nextSteps:[],sources:[],inferences:[],events:[]});
    if(current.events?.some(item=>item.eventKey===eventKey))return {stored:false,duplicate:true};
    const quoteIds=quotes.map((_,index)=>`${eventKey}:quote:${index}`);
    const nextStepId=nextStep?`${eventKey}:next`:undefined;
    const sourceIds=list(body?.sourceIds,12).map(item=>text(item,180)).filter(Boolean);
    const event={eventKey,createdAt:Date.now(),quoteIds,nextStepId,sourceIds};
    const next={version:1,taskId,dateKey:date,quotes:[...(Array.isArray(current.quotes)?current.quotes:[]),...quotes.map((quote,index)=>({id:quoteIds[index],text:quote,source:'user'}))].slice(-80),nextSteps:nextStep?[...(Array.isArray(current.nextSteps)?current.nextSteps:[]),{id:nextStepId,text:nextStep,source:'user',createdAt:Date.now()}].slice(-40):current.nextSteps||[],sources:[...(Array.isArray(current.sources)?current.sources:[]),...sourceIds].slice(-120),inferences:Array.isArray(current.inferences)?current.inferences:[],events:[...(Array.isArray(current.events)?current.events:[]),event].slice(-120)};
    await writeJson(file,next);return {stored:true};
  }
  async function clearMemory(){await fs.rm(memoryDir,{recursive:true,force:true});return {cleared:true};}
  async function forgetMemory(body){const task=text(body?.taskId,180);const day=body?.allDates===true?'':body?.dateKey?dateKey(body.dateKey):'';const eventKey=text(body?.eventKey,220);let removed=0;for(const file of await memoryFiles()){const doc=await readJson(file,null);if(!doc)continue;if(task&&doc.taskId!==task)continue;if(day&&doc.dateKey!==day)continue;if(eventKey&&body?.allDates!==true){const events=Array.isArray(doc.events)?doc.events:[];const target=events.find(item=>item.eventKey===eventKey);if(!target)continue;const quoteIds=new Set(Array.isArray(target.quoteIds)?target.quoteIds:[]);const nextStepId=target.nextStepId;const sourceIds=new Set(Array.isArray(target.sourceIds)?target.sourceIds:[]);const remainingEvents=events.filter(item=>item.eventKey!==eventKey);const remainingQuotes=(Array.isArray(doc.quotes)?doc.quotes:[]).filter(item=>!quoteIds.has(item.id));const remainingNextSteps=(Array.isArray(doc.nextSteps)?doc.nextSteps:[]).filter(item=>nextStepId?item.id!==nextStepId:remainingEvents.length>0);const remainingSources=(Array.isArray(doc.sources)?doc.sources:[]).filter(item=>!sourceIds.has(item));if(!remainingEvents.length&&!remainingQuotes.length&&!remainingNextSteps.length&&!remainingSources.length){await fs.unlink(file).catch(()=>{});}else{await writeJson(file,{...doc,quotes:remainingQuotes,nextSteps:remainingNextSteps,sources:remainingSources,events:remainingEvents});}removed++;}else{await fs.unlink(file).catch(()=>{});removed++;}}return {cleared:removed>0,removed};}
  async function callText(stage,snapshot,c,signal,extra={}){
    return chat(validateConfig(c.text,'text'),[{role:'system',content:SYSTEM_PROMPT},{role:'user',content:JSON.stringify({stage,instructions:stage==='C1'?'只理解本地事实，externalMatches必须为空。需要经验帮助时needsExternal=true；没有必要不要强行建议。':'将授权收藏中有用的部分适配本地事实，说明条件和局限。无相关原文则保留本地回声，不制造引用。',schema:DAILY_SCHEMA,snapshot,...extra})}],{fetcher,signal});
  }
  return {
    status:async()=>publicStatus(await config()),
    memoryStatus,
    memory:async body=>body?.forget===true?forgetMemory(body):updateMemory(body),
    'memory-clear':async()=>clearMemory(),
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
      const c=await config();
      const input={task,messages};
      const raw=await chat(validateConfig(c.text,'text'),[{role:'system',content:`${SYSTEM_PROMPT}\n你是任务结束后的短对话伙伴。先问一个具体问题帮助用户补充刚才做了什么，再根据用户已经说过的话给一句反馈。不要复述任务名和时长，不要猜测未说出的内容。最多两句、${'180'}字。memoryDraft 只是待确认建议，summary 必须来自用户原话，evidenceQuotes 必须逐字摘录用户消息。`},{role:'user',content:JSON.stringify({stage:'COMPANION',instruction:'只使用任务元数据和对话原文，回复简短自然，不输出 Markdown。',input})}],{fetcher,signal});
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
        const c=await config(),imageConfig=validateConfig(c.image,'image');
        const oldJob=await readJson(jobFile,null);
        if(oldJob?.provider&&(oldJob.provider!==imageConfig.provider||oldJob.baseUrl!==imageConfig.baseUrl||oldJob.model!==imageConfig.model))throw new ServiceError('这一天已有绘图任务，请恢复原厂商、API 地址和模型后继续查询，避免重复计费。',409);
        const prompt=oldJob?.prompt||`为儿童学习手账「迹向」绘制一枚独立圆形纪念印章，温柔米白纸张背景，精细水粉和彩铅，少量印泥质感，清晰完整的圆形轮廓，低饱和草木绿、杏桃、雾蓝；可包含头顶嫩芽的奶油色垂耳小狗。请用画面表现下列经历，不输出文字、日期、姓名，不包含暴力、成人、恐怖元素或等级排名：${brief}。这是个人纪念，不是奖惩。`;
        const result=await imageGeneration(imageConfig,prompt,{fetcher,signal,pollDelay,jobId:oldJob?.jobId,onJob:jobId=>writeJson(jobFile,{jobId,prompt,provider:imageConfig.provider,model:imageConfig.model,baseUrl:imageConfig.baseUrl,evidenceIds,brief,createdAt:Date.now()})});
        const {bytes,extension}=await imageBytes(result,{fetcher,signal});
        const id=createHash('sha256').update(bytes).digest('hex').slice(0,24);const fileName=`${day}-${id}.${extension}`;
        await fs.mkdir(path.dirname(stampFile),{recursive:true});await fs.writeFile(path.join(dataDir,'stamps',fileName),bytes);
        const stamp={id:`day-${day}-${id}`,dateKey:day,imageUrl:`/api/ai/stamp-assets/${fileName}`,title:'这一日的独特印记',meaning:oldJob?.brief||brief,createdAt:Date.now(),evidenceIds:oldJob?.evidenceIds||evidenceIds,eventKey};
        await writeJson(stampFile,stamp);return {stamp};
      });
    },
    asset:async name=>{if(!/^\d{4}-\d{2}-\d{2}-[a-f0-9]{24}\.(png|jpg|webp)$/.test(name))throw new ServiceError('图片不存在。',404);try{return {bytes:await fs.readFile(path.join(dataDir,'stamps',name)),mime:name.endsWith('.png')?'image/png':name.endsWith('.jpg')?'image/jpeg':'image/webp'};}catch{throw new ServiceError('图片不存在。',404);}}
  };
}
