import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {startProduction} from '../server/production.mjs';
// Node fetch rewrites Host; use HTTP directly to exercise reverse-proxy headers.
const fetch=(url,options={})=>new Promise((resolve,reject)=>{const request=http.request(url,options,reply=>{const chunks=[];reply.on('data',chunk=>chunks.push(chunk));reply.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:reply.statusCode,headers:reply.headers})));});request.on('error',reject);request.end(options.body);});

test('production serves the built app and isolates private endpoints behind the published origin',async()=>{
  const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'zhitu-production-'));
  let calls=0;
  const companion=async body=>{calls++;return {items:[{id:body.id,reply:'耳朵画好啦，汪～'}]};};
  const service={status:async()=>({text:{configured:true},image:{configured:true}})};
  const server=await startProduction({port:0,host:'127.0.0.1',publicOrigin:'https://zhitu.example',dataDir,service,companion});
  const base=`http://127.0.0.1:${server.address().port}`;
  const headers={Host:'zhitu.example',Origin:'https://zhitu.example','Content-Type':'application/json','X-Jixiang-Request':'1'};
  try{
    const page=await fetch(base,{headers:{accept:'text/html'}});assert.equal(page.status,200);assert.match(await page.text(),/知途/);
    const route=await fetch(base+'/footprints/day',{headers:{accept:'text/html'}});assert.equal(route.status,200);
    assert.equal((await fetch(base+'/assets/missing.js')).status,404);
    for(const location of ['/.local/model-config.json','/server/companion.mjs','/.env','/.git/config'])assert.equal((await fetch(base+location)).status,404);
    assert.equal((await fetch(base+'/healthz')).status,200);
    assert.equal((await fetch(base+'/api/ai/status',{headers})).status,200);
    assert.equal((await (await fetch(base+'/api/ai/status',{headers})).json()).managed,true);
    assert.equal((await fetch(base+'/api/ai/status',{headers:{...headers,Host:'wrong.example'}})).status,403);
    assert.equal((await fetch(base+'/api/ai/status',{headers:{...headers,Origin:'https://wrong.example'}})).status,403);
    assert.equal((await fetch(base+'/api/ai/config',{method:'POST',headers,body:'{}'})).status,404);
    assert.equal((await fetch(base+'/api/ai/companion',{method:'POST',headers:{...headers,'X-Jixiang-Request':''},body:'{}'})).status,403);
    const reply=await fetch(base+'/api/ai/companion',{method:'POST',headers,body:JSON.stringify({id:'test'})});assert.equal(reply.status,200);assert.equal((await reply.json()).items[0].reply,'耳朵画好啦，汪～');assert.equal(calls,1);
  }finally{await new Promise(resolve=>server.close(resolve));await fs.rm(dataDir,{recursive:true,force:true});}
});
