import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createCompanion} from '../server/companion.mjs';
import {chat} from '../server/providers.mjs';

const textConfig={provider:'deepseek',baseUrl:'https://api.deepseek.com',model:'test',apiKey:'fixture'};
const reply=value=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(value)}}]}));
const event=(id,text)=>({id,taskId:'task',dateKey:'2026-10-03',kind:'chat',text});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('image reading requires consent, uses vision model, caches and clears the private result',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'jixiang-reading-'));let calls=0;
 const service=createCompanion({dataDir:dir,fetcher:async(_url,options)=>{calls++;const body=JSON.parse(options.body);assert.equal(body.model,'vision-test');assert.equal(body.messages[1].content[1].type,'image_url');return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({description:'一朵黄色的小花。'})}}]}));}});
 try{
  await fs.writeFile(path.join(dir,'model-config.json'),JSON.stringify({vision:{model:'vision-test'},image:{provider:'doubao',apiKey:'fixture'}}));
  const body={token:'e'.repeat(64),action:'readImage',id:'work',data:'data:image/jpeg;base64,/9j/'};
  await assert.rejects(()=>service(body));assert.equal(calls,0);
  let result=await service({...body,consent:true});assert.equal(result.reading.source,'image');
  await service({...body,consent:true});assert.equal(calls,1);
  await service({token:body.token,action:'clear'});assert.deepEqual(await fs.readdir(path.join(dir,'companions')),[]);
 }finally{service.close();await fs.rm(dir,{recursive:true,force:true});}
});

test('attachment-only work is read, source type stays distinct and unchanged content is not regenerated',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'jixiang-doc-'));let calls=0;
 const service=createCompanion({dataDir:dir,fetcher:async(_url,options)=>{calls++;const input=JSON.parse(JSON.parse(options.body).messages[1].content);assert.equal(input.event.reading.text,'种子发芽需要水和合适的温度。');assert.equal(input.event.text,'');return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({reply:'这份记录写到了种子发芽。',progress:'留下种子观察记录',recap:''})}}]}));}});
 try{
  await fs.writeFile(path.join(dir,'model-config.json'),JSON.stringify({text:{provider:'deepseek',baseUrl:'https://api.deepseek.com',model:'test',apiKey:'fixture'}}));
  const body={token:'f'.repeat(64),action:'sync',enabled:true,events:[{id:'document',taskId:'t',kind:'work',dateKey:'2026-10-03',text:'',reading:{source:'document',text:'种子发芽需要水和合适的温度。'}}]};
  const result=await service(body);assert.match(result.items[0].reply,/种子/);await service(body);assert.equal(calls,1);
 }finally{service.close();await fs.rm(dir,{recursive:true,force:true});}
});

test('private memory: opt-in, deduplication, correction, deletion, forgetting and isolation',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'jixiang-memory-'));let calls=0;
 try{
  await fs.writeFile(path.join(dir,'model-config.json'),JSON.stringify({text:{provider:'deepseek',baseUrl:'https://api.deepseek.com',model:'test',apiKey:'fixture'}}));
  const service=createCompanion({dataDir:dir,fetcher:async()=>{calls++;return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({reply:'耳朵下次接着画。',progress:'画到耳朵',recap:'画了小狗。'})}}]}));}});
  const token='a'.repeat(64);const event={id:'e1',taskId:'t1',kind:'chat',dateKey:'2026-10-03',text:'画了小狗，耳朵没有画完',title:'画画'};
  await service({token,action:'sync',enabled:false,events:[event]});assert.equal(calls,0);
  let result=await service({token,action:'sync',enabled:true,events:[event]});assert.equal(calls,1);assert.equal(result.items.length,1);assert.equal(result.events,undefined);assert.equal(result.items[0].digest,undefined);
  await service({token,action:'sync',enabled:true,events:[event]});assert.equal(calls,1);
  const corrected={...event,text:'记错了，我画的是猫'};await service({token,action:'sync',enabled:true,events:[corrected]});assert.equal(calls,2);
  result=await service({token:'b'.repeat(64),action:'sync',enabled:false,events:[]});assert.deepEqual(result.items,[]);
  result=await service({token,action:'sync',enabled:true,events:[corrected,{...event,id:'e2',text:'忘掉这件事'}]});assert.equal(result.items.length,1);assert.equal(result.items[0].acknowledgement,true);assert.equal(result.items[0].progress,'');assert.equal(calls,2);
  result=await service({token,action:'sync',enabled:true,events:[corrected]});assert.equal(calls,2);assert.equal(result.items.filter(i=>!i.acknowledgement).length,0);
  await service({token,action:'clear'});assert.deepEqual(await fs.readdir(path.join(dir,'companions')).then(x=>x.length),1);
  await assert.rejects(()=>service({token:'../bad',action:'clear'}));
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('a drawing in flight never locks chatting or disables the companion when deleting a work',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'jixiang-independent-jobs-'));
 let release;const imageGate=new Promise(resolve=>release=resolve);let started=false;
 const service=createCompanion({dataDir:dir,fetcher:async(url)=>{if(url.endsWith('/images/generations')){started=true;await imageGate;return new Response(JSON.stringify({data:[{b64_json:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jIxoAAAAASUVORK5CYII='}]}));}return reply({reply:'汪，尾巴留给下次吧。',progress:'尾巴待画',recap:''});}});
 try {
  await fs.writeFile(path.join(dir,'model-config.json'),JSON.stringify({text:textConfig,image:{provider:'doubao',baseUrl:'https://ark.cn-beijing.volces.com/api/v3',model:'test',apiKey:'fixture'}}));
  const token='1'.repeat(64),work={...event('work','给小狗画了两只耳朵，尾巴还没画'),kind:'work'};
  await service({token,action:'sync',enabled:true,partial:true,events:[work]});
  for(let i=0;i<30&&!started;i++)await delay(5);assert.equal(started,true);
  const chatResult=await service({token,action:'sync',enabled:true,partial:true,events:[event('chat','尾巴下次再画吧')]});
  assert.match(chatResult.items.find(i=>i.id==='chat').reply,/尾巴/);
  await service({token,action:'remove',ids:['work']});
  const next=await service({token,action:'sync',enabled:true,partial:true,events:[event('next','现在可以接着聊吗')]});assert.ok(next.items.find(i=>i.id==='next').reply);
 } finally {release();service.close();await delay(20);await fs.rm(dir,{recursive:true,force:true});}
});

test('overlapping sync calls preserve both messages and deliver the next reply',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'jixiang-overlap-'));let release;const gate=new Promise(resolve=>release=resolve);let calls=0;
 const service=createCompanion({dataDir:dir,fetcher:async()=>{if(++calls===1)await gate;return reply({reply:'汪，听到啦。',progress:'',recap:''});}});
 try {
  await fs.writeFile(path.join(dir,'model-config.json'),JSON.stringify({text:textConfig}));const token='2'.repeat(64);
  const first=service({token,action:'sync',enabled:true,partial:true,events:[event('one','你好')]});
  for(let i=0;i<30&&!calls;i++)await delay(5);
  const second=await service({token,action:'sync',enabled:true,partial:true,events:[event('two','小芽你在吗')]});assert.ok(second.pendingIds.includes('two'));
  release();await first;
  const result=await service({token,action:'sync',enabled:true,partial:true,events:[]});assert.equal(result.items.filter(i=>i.reply).length,2);
  const folder=(await fs.readdir(path.join(dir,'companions')))[0];const doc=JSON.parse(await fs.readFile(path.join(dir,'companions',folder,'memory.json')));assert.equal(doc.events.length,2);
 } finally {release();service.close();await fs.rm(dir,{recursive:true,force:true});}
});

test('empty and quota-like replies remain pending instead of being accepted as completed chats',async()=>{
 for(const text of ['', '小芽今天聊得有点多，明天再聊吧。']){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'jixiang-useful-reply-'));const service=createCompanion({dataDir:dir,fetcher:async()=>reply({reply:text,progress:'',recap:''})});
  try{await fs.writeFile(path.join(dir,'model-config.json'),JSON.stringify({text:textConfig}));const result=await service({token:'3'.repeat(64),action:'sync',enabled:true,partial:true,events:[event('one','你好')]});assert.equal(result.items.length,0);assert.deepEqual(result.pendingIds,['one']);}
  finally{service.close();await fs.rm(dir,{recursive:true,force:true});}
 }
});

test('chat recovers from a provider rate limit and accepts a natural-language reply',async()=>{
 let calls=0;
 const result=await chat(textConfig,[{role:'user',content:'你好'}],{replyMode:true,retries:2,retryBaseMs:1,fetcher:async()=>{if(++calls===1)return new Response('{}',{status:429});return new Response(JSON.stringify({choices:[{message:{content:'汪，我在呢！'}}]}));}});
 assert.equal(calls,2);assert.equal(result.reply,'汪，我在呢！');
});

test('failed model calls preserve sources and back off instead of looping',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'jixiang-retry-'));let calls=0;
 try{
  await fs.writeFile(path.join(dir,'model-config.json'),JSON.stringify({text:{provider:'deepseek',baseUrl:'https://api.deepseek.com',model:'test',apiKey:'fixture'}}));
  const service=createCompanion({dataDir:dir,providerRetries:0,fetcher:async()=>{calls++;throw Error('offline');}});
  const body={token:'c'.repeat(64),action:'sync',enabled:true,events:[{id:'e',taskId:'t',dateKey:'2026-10-03',kind:'chat',text:'今天读到第三页'}]};
  await service(body);await service(body);assert.equal(calls,1);
  const folders=await fs.readdir(path.join(dir,'companions'));const doc=JSON.parse(await fs.readFile(path.join(dir,'companions',folders[0],'memory.json')));assert.equal(doc.events[0].text,'今天读到第三页');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('legacy daily counters do not stop chatting or reading a photo',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'jixiang-no-daily-cap-'));let calls=0;
 const service=createCompanion({dataDir:dir,fetcher:async(_url,options)=>{calls++;const body=JSON.parse(options.body);const content=body.model==='vision-test'?{description:'一只小狗坐在书旁。'}:{reply:'小芽听见啦，汪。',progress:'',recap:''};return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(content)}}]}));}});
 try{
  await fs.writeFile(path.join(dir,'model-config.json'),JSON.stringify({text:{provider:'deepseek',baseUrl:'https://api.deepseek.com',model:'text-test',apiKey:'fixture'},vision:{model:'vision-test'},image:{provider:'doubao',apiKey:'fixture'}}));
  const token='f'.repeat(64);const first={id:'first',taskId:'task',dateKey:'2026-10-03',kind:'chat',text:'先说一句'};
  await service({token,action:'sync',enabled:true,events:[first]});
  const folder=(await fs.readdir(path.join(dir,'companions')))[0];const file=path.join(dir,'companions',folder,'memory.json');const doc=JSON.parse(await fs.readFile(file,'utf8'));
  doc.usage={'2026-10-03':{text:999,image:999,vision:999}};await fs.writeFile(file,JSON.stringify(doc));
  await fs.writeFile(path.join(dir,'companion-budget.json'),JSON.stringify({'2026-10-03':{text:999,image:999,vision:999}}));
  const second={id:'second',taskId:'task',dateKey:'2026-10-03',kind:'chat',text:'再说一句'};
  const result=await service({token,action:'sync',enabled:true,events:[first,second]});
  assert.equal(result.items.find(item=>item.id==='second')?.reply,'小芽听见啦，汪。');
  const photo=await service({token,action:'readImage',consent:true,id:'photo',data:'data:image/jpeg;base64,/9j/'});
  assert.equal(photo.reading.text,'一只小狗坐在书旁。');assert.equal(calls,3);
 }finally{service.close();await fs.rm(dir,{recursive:true,force:true});}
});

test('a new chat reply is not delayed behind older unprocessed messages',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'jixiang-chat-backlog-'));
 const service=createCompanion({dataDir:dir,fetcher:async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({reply:'接住你刚说的话啦，汪。',progress:'',recap:''})}}]}))});
 try{
  await fs.writeFile(path.join(dir,'model-config.json'),JSON.stringify({text:{provider:'deepseek',baseUrl:'https://api.deepseek.com',model:'test',apiKey:'fixture'}}));
  const token='a'.repeat(64);const old=Array.from({length:12},(_,index)=>({id:`old-${index}`,taskId:'old-task',dateKey:'2026-10-01',kind:'chat',text:`旧消息 ${index}`}));
  await service({token,action:'sync',enabled:false,events:old});
  const latest={id:'latest',taskId:'current-task',dateKey:'2026-10-03',kind:'chat',text:'刚刚发的消息'};
  const result=await service({token,action:'sync',enabled:true,events:[...old,latest]});
  assert.equal(result.items.find(item=>item.id==='latest')?.reply,'接住你刚说的话啦，汪。');
 }finally{service.close();await fs.rm(dir,{recursive:true,force:true});}
});

test('a work creates one automatic stamp, survives reload, hides and never changes source text',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'jixiang-stamp-'));let images=0;
 try{
  await fs.writeFile(path.join(dir,'model-config.json'),JSON.stringify({text:{provider:'deepseek',baseUrl:'https://api.deepseek.com',model:'test',apiKey:'fixture'},image:{provider:'doubao',baseUrl:'https://ark.cn-beijing.volces.com/api/v3',model:'test',apiKey:'fixture'}}));
  const fetcher=async url=>{if(url.endsWith('/images/generations')){images++;return new Response(JSON.stringify({data:[{b64_json:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jIxoAAAAASUVORK5CYII='}]}));}return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({reply:'收好了。',progress:'画了耳朵',recap:'今天的小狗。'})}}]}));};
  let service=createCompanion({dataDir:dir,fetcher});const body={token:'d'.repeat(64),action:'sync',enabled:true,events:[{id:'work',taskId:'drawing',kind:'work',dateKey:'2026-10-03',title:'画画',text:'今天给小狗画上了两只耳朵'}]};
  await service(body);assert.equal(images,0);let result=await service(body);assert.equal(images,1);assert.match(result.items[0].imageUrl,/^data:image\/png/);
  service=createCompanion({dataDir:dir,fetcher});await service(body);assert.equal(images,1);
  await service({token:body.token,action:'edit',id:'work',hideStamp:true});result=await service(body);assert.equal(result.items[0].imageUrl,undefined);assert.equal(images,1);
  result=await service({...body,events:[]});assert.deepEqual(result.items,[]);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
