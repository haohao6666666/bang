export type CompanionResult = {
  managed?:boolean;drawingPending?:boolean;
  items: {id:string;taskId:string;dateKey:string;reply:string;progress:string;recap:string;imageUrl?:string;updatedAt?:number;acknowledgement?:boolean;sources?:{title:string;url:string;excerpt:string}[]}[];
  partial?:boolean;forgotten?:string[];reading?:import('./reading').Reading;replyError?:string;pendingIds?:string[];retryAt?:number;syncedAt?:number;
};

function token() {
  let key=localStorage.getItem('jixiang-companion-token');
  if(!key) {const bytes=crypto.getRandomValues(new Uint8Array(32));key=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');localStorage.setItem('jixiang-companion-token',key);}
  return key;
}

export async function companionRequest(body:object):Promise<CompanionResult> {
  const encoded=JSON.stringify({...body,token:token()});
  for(let attempt=0;attempt<3;attempt++) {
    let response:Response;
    try {response=await fetch('/api/ai/companion',{method:'POST',headers:{'Content-Type':'application/json','X-Jixiang-Request':'1'},body:encoded,signal:AbortSignal.timeout(160000)});}
    catch {if(attempt<2){await new Promise(resolve=>setTimeout(resolve,1000*2**attempt));continue;}throw new Error('刚才没连上，你的话已收好，我会接着试。');}
    const data=await response.json().catch(()=>null);
    if(response.ok&&data&&(Array.isArray(data.items)||data.reading))return data;
    if(attempt<2&&(!data||[409,429,502,503,504].includes(response.status))){await new Promise(resolve=>setTimeout(resolve,1000*2**attempt));continue;}
    throw new Error(data?.error||'刚才没连上，你的话已收好，我会接着试。');
  }
  throw new Error('刚才没连上，你的话已收好，我会接着试。');
}
