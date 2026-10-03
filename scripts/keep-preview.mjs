import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';

let child;
let restartTimer;
let stopping = false;
let failures = 0;
let healthFailures = 0;
let healthTimer;
const args=process.argv.slice(2);
const portIndex=args.indexOf('--port');
const port=portIndex>=0?Number(args[portIndex+1]):4173;

function start() {
  const startedAt = Date.now();
  child = spawn(process.execPath, ['server/dev.mjs', ...args], {
    cwd: process.cwd(),
    stdio: 'inherit',
    windowsHide: true,
  });
  healthFailures=0;
  void fs.mkdir('.local',{recursive:true}).then(()=>fs.writeFile(`.local/preview-process-${port}.json`,JSON.stringify({supervisor:process.pid,child:child.pid,port}))).catch(()=>{});
  clearInterval(healthTimer);
  healthTimer=setInterval(async()=>{
    if(stopping||!child||Date.now()-startedAt<15000)return;
    try{
      const response=await fetch(`http://127.0.0.1:${port}/api/ai/status`,{signal:AbortSignal.timeout(4000)});
      if(!response.ok)throw new Error('health');
      healthFailures=0;
    }catch{
      if(++healthFailures>=3){console.error('本机接口连续未响应，正在重新启动。');healthFailures=0;child?.kill();}
    }
  },10000);
  child.on('error', error => console.error('本机预览启动失败：', error.message));
  child.on('exit', (code, signal) => {
    child = undefined;
    clearInterval(healthTimer);
    if (stopping) return;
    failures = Date.now() - startedAt > 30_000 ? 0 : failures + 1;
    const delay = Math.min(10_000, 1_000 * 2 ** Math.min(Math.max(failures - 1, 0), 3));
    console.error(`本机预览已退出（${signal ?? code}），${delay / 1_000} 秒后重启。`);
    restartTimer = setTimeout(start, delay);
  });
}

function stop() {
  stopping = true;
  clearTimeout(restartTimer);
  clearInterval(healthTimer);
  child?.kill();
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
start();
