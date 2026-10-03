import { useEffect, useRef, useState } from 'react';
import { BottomSheet, KeyboardTextarea } from './mobile';
import { ReferenceArt } from './ReferenceArt';
import { readDocument, imageForReading, type Reading } from './reading';
import { readableJournal } from './journalExport';
import type { SavedBookmark } from './aiContracts';
import {companionRequest as request} from './companionApi';
import {usefulReply} from '../shared/companion-replies.mjs';

type Task = {id:string;title:string};
type Entry = {id:string;taskId:string;title:string;dateKey:string;kind:'chat'|'work';text:string;file?:File;reading?:Reading;readingError?:string;readingAttempts?:number;readingNext?:number};
type Item = {id:string;taskId:string;dateKey:string;reply:string;progress:string;recap:string;imageUrl?:string;updatedAt?:number;acknowledgement?:boolean;sources?:{title:string;url:string;excerpt:string}[]};
type Journal = {entries:Entry[];items:Item[];enabled:boolean;introduced:boolean;proactive:boolean;attachmentsEnabled?:boolean;excluded?:string[];lastInvite?:string;unanswered?:number;syncedAt?:number};
const empty:Journal={entries:[],items:[],enabled:false,introduced:false,proactive:true};
const date=()=>new Date().toLocaleDateString('sv-SE');
async function database(){return new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('jixiang-companion',1);request.onupgradeneeded=()=>request.result.createObjectStore('journal');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function readJournal(){const db=await database();return new Promise<Journal>((resolve,reject)=>{const tx=db.transaction('journal');const req=tx.objectStore('journal').get('current');req.onsuccess=()=>resolve(req.result??empty);req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();});}
async function saveJournal(value:Journal){const db=await database();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('journal','readwrite');tx.objectStore('journal').put(value,'current');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);});}
function Attachment({file}:{file:File}){const [url,setUrl]=useState('');useEffect(()=>{const u=URL.createObjectURL(file);setUrl(u);return()=>URL.revokeObjectURL(u);},[file]);if(!url)return null;return <a href={url} target="_blank" rel="noreferrer">{file.type.startsWith('image/')?<img className="work-image" src={url} alt={file.name}/>:<span className="document-file">↗ {file.name}</span>}</a>;}

export function useCompanion(tasks:Task[],bookmarks:SavedBookmark[]){
  const [journal,setJournal]=useState<Journal>(empty),[ready,setReady]=useState(false),[taskId,setTaskId]=useState<string|null>(null),[draft,setDraft]=useState(''),[file,setFile]=useState<File>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[hint,setHint]=useState(false);
  const current=useRef(journal),commits=useRef<Promise<void>>(Promise.resolve()),bookmarksRef=useRef(bookmarks),wake=useRef<(delay?:number)=>void>(()=>{});
  bookmarksRef.current=bookmarks;
  const commit=(update:Journal|((value:Journal)=>Journal))=>{
    const operation=commits.current.catch(()=>{}).then(async()=>{const next=typeof update==='function'?update(current.current):update;await saveJournal(next);current.current=next;setJournal(next);});
    commits.current=operation;return operation;
  };
  useEffect(()=>{let active=true;readJournal().then(value=>{if(!active)return;const next={...empty,...value,items:value.items.filter(item=>!item.reply||usefulReply(item.reply)),entries:value.entries.map(entry=>entry.readingError?{...entry,readingError:undefined,readingAttempts:0,readingNext:0}:entry)};current.current=next;setJournal(next);setReady(true);}).catch(()=>setError('记录空间暂时打不开，请不要清除浏览器数据。'));return()=>{active=false;};},[]);
  useEffect(()=>{
    if(!ready)return;
    let stopped=false,inFlight=false,again=false,timer:ReturnType<typeof setTimeout>|undefined,due=Infinity;
    const readings=new Set<string>();
    const pendingEntries=()=>current.current.entries.filter(e=>!current.current.excluded?.includes(e.id)&&!current.current.items.some(item=>item.id===e.id)&&(e.text.trim()||e.reading?.text||e.file&&current.current.attachmentsEnabled&&!e.reading));
    const schedule=(delay=0)=>{
      if(stopped)return;
      if(inFlight){again=true;return;}
      const target=Date.now()+delay;if(target>=due)return;
      clearTimeout(timer);due=target;timer=setTimeout(()=>{due=Infinity;void sync();},delay);
    };
    const readWork=(candidate:Entry)=>{
      readings.add(candidate.id);
      void (async()=>{
        try{
          const reading=candidate.file!.type.startsWith('image/')?(await request({action:'readImage',consent:true,id:candidate.id,data:await imageForReading(candidate.file!)})).reading:await readDocument(candidate.file!);
          if(!reading)throw new Error('这次没有读到内容，作品已经收好了。');
          if(!stopped&&current.current.enabled&&current.current.attachmentsEnabled)await commit(j=>({...j,entries:j.entries.map(e=>e.id===candidate.id?{...e,reading,readingError:undefined,readingNext:undefined}:e),items:j.items.filter(i=>i.id!==candidate.id)}));
        }catch(cause){if(!stopped)await commit(j=>({...j,entries:j.entries.map(e=>{if(e.id!==candidate.id)return e;const attempts=(e.readingAttempts??0)+1;return {...e,readingAttempts:attempts,readingNext:Date.now()+Math.min(300000,5000*2**Math.min(attempts-1,6)),readingError:cause instanceof Error?cause.message:'这次没有读到内容，作品已经收好了。'};})}));}
        finally{readings.delete(candidate.id);schedule(0);}
      })();
    };
    const sync=async()=>{
      if(stopped||inFlight||!current.current.enabled||document.visibilityState==='hidden')return;
      inFlight=true;again=false;
      let nextDelay=30000;
      const pending=pendingEntries();setBusy(pending.length>0);
      try{
        const snapshot=current.current;
        const events=snapshot.entries.filter(e=>!snapshot.excluded?.includes(e.id)&&(!snapshot.items.some(i=>i.id===e.id)||e.file&&snapshot.attachmentsEnabled&&!e.reading)).slice(-40).map(({file,readingError,readingAttempts,readingNext,...e})=>({...e,attachmentPending:!!file&&snapshot.attachmentsEnabled&&!e.reading}));
        const result=await request({action:'sync',enabled:true,partial:true,since:snapshot.syncedAt,events,bookmarks:bookmarksRef.current.filter(b=>b.authorized)});
        if(stopped||!current.current.enabled)return;
        await commit(j=>{
          const forgotten=[...new Set([...(j.excluded??[]),...(result.forgotten??[])])];
          const ids=new Set(j.entries.map(e=>e.id));
          const items=new Map(j.items.filter(i=>!forgotten.includes(i.id)||i.acknowledgement).map(i=>[i.id,i]));
          for(const item of result.items)if(ids.has(item.id)&&(!forgotten.includes(item.id)||item.acknowledgement)&&(item.updatedAt??Infinity)>=(items.get(item.id)?.updatedAt??0))items.set(item.id,item);
          return {...j,items:[...items.values()],excluded:forgotten,syncedAt:result.syncedAt??j.syncedAt};
        });
        setError(result.replyError||'');
        if(result.pendingIds?.length)nextDelay=Math.min(15000,Math.max(1500,(result.retryAt??Date.now())-Date.now()));
        const candidate=current.current.attachmentsEnabled?[...current.current.entries].reverse().find(e=>e.file&&!e.reading&&!readings.has(e.id)&&!current.current.excluded?.includes(e.id)&&(e.readingNext??0)<=Date.now()):undefined;
        if(candidate)readWork(candidate);
      }catch(cause){if(!stopped){setError(cause instanceof Error?cause.message:'刚才没连上，你的话已收好，我会接着试。');nextDelay=5000;}}
      finally{
        inFlight=false;
        if(!stopped){setBusy(current.current.enabled&&pendingEntries().length>0);schedule(again?0:nextDelay);}
      }
    };
    wake.current=schedule;
    const resume=()=>{if(document.visibilityState!=='hidden')schedule(0);};
    window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);
    schedule(0);
    return()=>{stopped=true;clearTimeout(timer);wake.current=()=>{};window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume);};
  },[ready]);
  useEffect(()=>{if(ready&&journal.enabled)wake.current(0);if(!journal.enabled)setBusy(false);},[ready,journal.entries,journal.enabled,journal.attachmentsEnabled,bookmarks]);
  const open=(id:string)=>{if(hint)void commit(j=>({...j,unanswered:0}));setTaskId(id);setDraft('');setFile(undefined);setError('');setHint(false);wake.current(0);};
  const send=async()=>{
    if(!ready||!taskId||(!draft.trim()&&!file))return;
    const task=tasks.find(t=>t.id===taskId);if(!task)return;
    const entry:Entry={id:'entry-'+crypto.randomUUID(),taskId,title:task.title,dateKey:date(),kind:file?'work':'chat',text:draft.trim(),file};
    try{await commit(j=>({...j,entries:[...j.entries,entry]}));setDraft('');setFile(undefined);setError('');if(!current.current.enabled){setError('已留在本机。开启小芽聊天后，她才能接着回复。');return;}setBusy(true);wake.current(0);}
    catch{setError('没有保存成功，可能是存储空间不足。');}
  };
  const setEnabled=async(enabled:boolean)=>{try{await commit(j=>({...j,enabled,introduced:true}));if(!enabled)await request({action:'disable'});else wake.current(0);}catch{setError('设置没有保存，请稍后再试。');}};
  const remove=async(id:string)=>{try{await request({action:'remove',ids:[id]});await commit(j=>({...j,entries:j.entries.filter(e=>e.id!==id),items:j.items.filter(e=>e.id!==id)}));}catch{setError('还没删除成功，请稍后再试。');}};
  const clearMemory=async()=>{try{await request({action:'clear'});await commit(j=>({...j,enabled:false,items:[],syncedAt:undefined,excluded:j.entries.map(e=>e.id)}));setError('');}catch{setError('暂时没有清除成功，请稍后再试。');}};
  const removeTask=async(id:string)=>{if(current.current.introduced)await request({action:'removeTask',taskId:id});await commit(j=>({...j,entries:j.entries.filter(e=>e.taskId!==id),items:j.items.filter(i=>i.taskId!==id)}));};
  const editItem=async(id:string,recap?:string,hideStamp=false)=>{try{await request({action:'edit',id,recap,hideStamp});await commit(j=>({...j,items:j.items.map(i=>i.id===id?{...i,updatedAt:Date.now(),...(recap!==undefined?{recap}:{}),...(hideStamp?{imageUrl:undefined}:{})}:i)}));}catch{setError('修改没有保存，请稍后再试。');}};
  const exportWorks=async()=>{try{const html=await readableJournal(current.current.entries,current.current.items);const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='知途-作品与聊天.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch{setError('这次没有导出成功，请再试一次。');}};
  const attachmentSetting=<label className="settings-row"><span>让小芽读作品<small>开启后，文档文字和照片会交给模型阅读。</small></span><input type="checkbox" checked={journal.attachmentsEnabled??false} onChange={e=>void commit(j=>({...j,attachmentsEnabled:e.target.checked}))}/></label>;
  const readingStatus=(e:Entry)=>(e.reading?.text?<div className="work-reading"><small>{e.reading.source==='image'?'图片里有':'文档里写着'}</small><p>{e.reading.text}</p>{e.reading.source!=='image'&&e.reading.feedback&&<p className="work-reading-feedback">{e.reading.feedback}</p>}</div>:e.readingError||e.reading?.note?<small className="work-reading">{e.readingError||e.reading?.note}</small>:null);
  const progress=(id:string)=>journal.items.filter(i=>i.taskId===id&&i.progress).at(-1)?.progress??journal.entries.filter(e=>e.taskId===id&&e.text&&!journal.excluded?.includes(e.id)).at(-1)?.text;
  const settings=<section className="settings-group"><h3>小芽的陪伴</h3><p>开启后，会把你分享的内容交给模型整理，记住进度，下次接着聊。作品原件保存在这台设备，是否交给小芽阅读由你决定。</p><label className="settings-row"><span>记住进度与自动整理</span><input type="checkbox" checked={journal.enabled} onChange={e=>void setEnabled(e.target.checked)}/></label><label className="settings-row"><span>偶尔主动聊一句</span><input type="checkbox" checked={journal.proactive} onChange={e=>void commit(j=>({...j,proactive:e.target.checked}))}/></label>{attachmentSetting}<button className="text-button" onClick={()=>void exportWorks()}>导出作品与聊天</button><button className="text-button" onClick={()=>void clearMemory()}>清除记忆并关闭</button>{error&&<p role="status">{error}</p>}</section>;
  const invitation=(id:string,running:boolean)=>!running&&<button className="companion-invite" onClick={()=>open(id)}><ReferenceArt kind="thinking"/><span><strong>{hint&&journal.proactive?'刚才做到哪儿了？':'和小芽聊聊'}</strong><small>{progress(id)||'说两句，或者留下今天的作品。'}</small></span><span>↗</span></button>;
  const compare=()=>{const ids=[...new Set(journal.entries.filter(e=>e.file?.type.startsWith('image/')).map(e=>e.taskId))];return ids.map(id=>{const rows=journal.entries.filter(e=>e.taskId===id&&e.file?.type.startsWith('image/'));if(rows.length<2)return null;return <details className="work-comparison" key={id}><summary>{rows[0].title} · 从开始到现在</summary><div>{[rows[0],rows.at(-1)!].map((row,index)=><figure key={row.id}><figcaption>{index===0?'最初留下的':'最近一次'} · {row.dateKey}</figcaption><Attachment file={row.file!}/><p>{row.text}</p></figure>)}</div></details>;});};
  const works=(filterDate?:string)=><div className="works-gallery">{!filterDate&&compare()}{journal.entries.filter(e=>e.kind==='work'&&(!filterDate||e.dateKey===filterDate)).slice().reverse().map(e=><article className="work-card" key={e.id}><header><strong>{e.title}</strong><small>{e.dateKey}</small></header>{e.file&&<Attachment file={e.file}/>}<p>{e.text}</p>{readingStatus(e)}{journal.items.find(i=>i.id===e.id)?.reply&&<p className="chat-puppy work-companion-reply">{journal.items.find(i=>i.id===e.id)?.reply}</p>}{journal.items.find(i=>i.id===e.id)?.recap&&<div className="work-recap"><p>{journal.items.find(i=>i.id===e.id)?.recap}</p><button className="text-button" onClick={()=>{const value=window.prompt("改一改",journal.items.find(i=>i.id===e.id)?.recap);if(value!==null)void editItem(e.id,value);}}>编辑这句话</button><button className="text-button" onClick={()=>void editItem(e.id,"")}>收起</button></div>}<footer><button className="text-button" onClick={()=>open(e.taskId)}>接着聊</button><button className="text-button" onClick={()=>{const text=window.prompt('改一改',e.text);if(text!==null)void commit(j=>({...j,entries:j.entries.map(x=>x.id===e.id?{...x,text}:x),items:j.items.filter(i=>i.id!==e.id)}));}}>编辑</button><button className="text-button" onClick={()=>void remove(e.id)}>删除</button></footer></article>)}{!journal.entries.some(e=>e.kind==='work'&&(!filterDate||e.dateKey===filterDate))&&<div className="stampbook-empty"><ReferenceArt kind="journaling"/><p>画作、照片、文档，喜欢的作品收在这里。</p></div>}</div>;
  const stamps=(filterDate?:string)=><div className="keepsake-grid">{journal.items.filter(i=>i.imageUrl&&(!filterDate||i.dateKey===filterDate)).map(i=><article className="work-card" key={i.id}><button onClick={()=>open(i.taskId)}><img src={i.imageUrl} alt="这一次的纪念印章"/><strong>{journal.entries.find(e=>e.id===i.id)?.title}</strong><p>{i.dateKey}</p></button><p>{journal.entries.find(e=>e.id===i.id)?.text}</p><button className="text-button" onClick={()=>void editItem(i.id,undefined,true)}>收起这枚章</button></article>)}</div>;
  const sheet=<BottomSheet open={!!taskId} onOpenChange={open=>{if(!open){setTaskId(null);setHint(false);}}} title="小芽" description={tasks.find(t=>t.id===taskId)?.title} snap={0.9}><div className="companion-chat">{!journal.introduced&&<div className="memory-intro"><ReferenceArt kind="welcome"/><p>我会记住我们聊过的进度，下次接着聊。内容会交给模型整理，有合适的经历时还会画一枚纪念印章。你也可以随时让我忘掉。</p><button className="primary-button" onClick={()=>void setEnabled(true)}>好呀</button><button className="text-button" onClick={()=>void commit(j=>({...j,introduced:true}))}>先只记在这里</button></div>}{!journal.enabled&&<div className="chat-memory-off"><span>开启聊天整理后，小芽就能读到并回复你的消息。</span><button className="outline-button compact" onClick={()=>void setEnabled(true)}>开启小芽聊天</button></div>}<div className="chat-history">{journal.entries.filter(e=>e.taskId===taskId).map(e=><div key={e.id}><div className="chat-user">{e.file&&<Attachment file={e.file}/>}<p>{e.text}</p>{readingStatus(e)}</div>{journal.items.find(i=>i.id===e.id)?.reply&&<p className="chat-puppy">{journal.items.find(i=>i.id===e.id)?.reply}</p>}{journal.items.find(i=>i.id===e.id)?.sources?.map(source=><a className="source-link" key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}<small>{source.excerpt}</small></a>)}</div>)}</div><KeyboardTextarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="说两句，或留下今天的作品" aria-label="和小芽说话"/>{journal.enabled&&attachmentSetting}<div className="chat-compose-actions"><label className="outline-button">留作品<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,.docx" onChange={e=>{const f=e.target.files?.[0];if(f&&f.size>10*1024*1024){setError('文件太大了，换一个 10 MB 以内的吧。');return;}setFile(f);}}/></label><button className="primary-button" onClick={()=>void send()} disabled={!ready||(!draft.trim()&&!file)}>留下</button></div>{file&&<small>{file.name} <button onClick={()=>setFile(undefined)}>移除</button></small>}{error&&<p role="status">{error}</p>}{busy&&<div className="puppy-wait" role="status" aria-label="小芽正在想"><ReferenceArt kind="thinking"/><span>小芽想一下…</span></div>}</div></BottomSheet>;
  const memories=(dateKey:string)=>journal.items.filter(item=>item.dateKey===dateKey&&Boolean(item.progress||item.recap||item.reply)).map(item=>({taskId:item.taskId,progress:item.progress,recap:item.recap,reply:item.reply,sources:item.sources??[]}));
  return {dates:journal.entries.map(e=>e.dateKey),open,settings,invitation,works,stamps,sheet,progress,memories,removeTask,clearMemory,onFinish:()=>{const j=current.current;if(j.proactive&&j.lastInvite!==date()&&(j.unanswered??0)<2){setHint(true);void commit(current=>({...current,lastInvite:date(),unanswered:(current.unanswered??0)+1}));}}};
}

