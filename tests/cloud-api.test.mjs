import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../worker/index.js';
function fixture(){
 const db=new DatabaseSync(':memory:');db.exec(readFileSync('drizzle/0000_cooing_runaways.sql','utf8'));
 const files=new Map();const jobs=[];
 const env={DB:{prepare(sql){const query=db.prepare(sql);let args=[];return {bind(...v){args=v;return this;},async run(){const result=query.run(...args);return {meta:{changes:Number(result.changes)}}},async all(){return {results:query.all(...args)}}};}},BUCKET:{async put(key,value){files.set(key,typeof value==='string'?Buffer.from(value):Buffer.from(value));},async get(key){const value=files.get(key);return value?{text:async()=>value.toString(),arrayBuffer:async()=>Uint8Array.from(value).buffer}:null},async delete(key){files.delete(key);}},JIXIANG_TEXT_PROVIDER:'deepseek',JIXIANG_TEXT_BASE_URL:'https://api.deepseek.com',JIXIANG_TEXT_MODEL:'fixture',JIXIANG_TEXT_API_KEY:'private-fixture-secret',PROVIDER_FETCH:async(_url,options)=>{const input=JSON.parse(JSON.parse(options.body).messages[1].content);return Response.json({choices:[{message:{content:JSON.stringify({reply:'记着啦，汪。',progress:input.event.text,recap:input.event.text})}}]});}};
 const ctx={waitUntil(job){jobs.push(job)}};
 const request=body=>worker.fetch(new Request('https://zhitu.example/api/ai/companion',{method:'POST',headers:{Origin:'https://zhitu.example','Content-Type':'application/json','X-Jixiang-Request':'1'},body:JSON.stringify(body)}),env,ctx);
 return {env,ctx,request,files,jobs,db};
}
test('cloud routes keep configuration private, reject foreign origins and raw storage access',async()=>{
 const f=fixture();const status=await worker.fetch(new Request('https://zhitu.example/api/ai/status'),f.env,f.ctx);const body=await status.json();assert.equal(body.managed,true);assert.equal(body.text.configured,true);assert.ok(!JSON.stringify(body).includes('private-fixture-secret'));
 assert.equal((await worker.fetch(new Request('https://zhitu.example/api/ai/status',{headers:{Origin:'https://other.example'}}),f.env,f.ctx)).status,403);
 assert.equal((await worker.fetch(new Request('https://zhitu.example/api/ai/config',{method:'POST'}),f.env,f.ctx)).status,404);
 f.db.close();
});
test('cloud memory survives new service instances, isolates visitors, forgets and clears',async()=>{
 const f=fixture(),token='a'.repeat(64),event={id:'first',taskId:'drawing',dateKey:'2026-10-03',kind:'chat',text:'耳朵画好了，下次画尾巴。'};
 let response=await f.request({token,action:'sync',enabled:true,partial:true,events:[event]});assert.equal(response.status,200);let body=await response.json();assert.equal(body.items[0].progress,event.text);
 response=await f.request({token,action:'sync',partial:true,events:[]});body=await response.json();assert.equal(body.items.length,1);
 response=await f.request({token:'b'.repeat(64),action:'sync',enabled:true,partial:true,events:[]});assert.equal((await response.json()).items.length,0);
 response=await f.request({token,action:'sync',partial:true,events:[{...event,id:'forget',text:'忘掉这件事'}]});assert.ok((await response.json()).forgotten.includes('first'));
 await f.request({token,action:'clear'});await Promise.all(f.jobs);assert.ok(![...f.files.keys()].some(key=>key.includes('undefined')));
 response=await f.request({token,action:'sync',enabled:true,partial:true,events:[]});assert.equal((await response.json()).items.length,0);await Promise.all(f.jobs);f.db.close();
});
test('cloud drawing uses an independent long request and persists its lease across requests',async()=>{
 const f=fixture();Object.assign(f.env,{JIXIANG_IMAGE_PROVIDER:'doubao',JIXIANG_IMAGE_BASE_URL:'https://ark.cn-beijing.volces.com/api/v3',JIXIANG_IMAGE_MODEL:'doubao-seedream-5-0-pro-260628',JIXIANG_IMAGE_API_KEY:'fixture'});
 const original=f.env.PROVIDER_FETCH;let release,started,draws=0;const began=new Promise(r=>started=r);const wait=new Promise(r=>release=r);
 f.env.PROVIDER_FETCH=async(url,options)=>{if(url.endsWith('/images/generations')){draws++;started();await wait;return Response.json({data:[{b64_json:Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64')}]});}return original(url,options);};
 const token='c'.repeat(64),event={id:'work',taskId:'drawing',dateKey:'2026-10-03',kind:'work',text:'这次画完了小狗的两只圆耳朵。'};
 const saved=await f.request({token,action:'sync',enabled:true,partial:true,events:[event]});assert.equal((await saved.json()).drawingPending,true);assert.equal(draws,0);
 const drawing=f.request({token,action:'drawPending'});await began;
 const live=await f.request({token,action:'sync',partial:true,events:[{...event,id:'chat',kind:'chat',text:'下一次画尾巴吧。'}]});assert.equal(live.status,200);assert.ok((await live.json()).items.some(i=>i.id==='chat'&&i.reply));
 await f.request({token,action:'drawPending'});assert.equal(draws,1);release();await drawing;
 const restored=await f.request({token,action:'sync',partial:true,events:[]});assert.match((await restored.json()).items.find(i=>i.id==='work').imageUrl,/^data:image\/png;base64,/);await f.request({token,action:'drawPending'});assert.equal(draws,1);f.db.close();
});
