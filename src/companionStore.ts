import type {Reading} from './reading';
import {normaliseWorkFile} from './workFile';
export type Entry={id:string;taskId:string;title:string;dateKey:string;kind:'chat'|'work';text:string;file?:File;reading?:Reading;readingError?:string;readingAttempts?:number;readingNext?:number};
export type Item={id:string;taskId:string;dateKey:string;reply:string;progress:string;recap:string;imageUrl?:string;updatedAt?:number;acknowledgement?:boolean;sources?:{title:string;url:string;excerpt:string}[]};
export type Journal={entries:Entry[];items:Item[];enabled:boolean;introduced:boolean;proactive:boolean;attachmentsEnabled?:boolean;excluded?:string[];lastInvite?:string;unanswered?:number;syncedAt?:number};
export const emptyJournal:Journal={entries:[],items:[],enabled:false,introduced:false,proactive:true};
type StoredAttachment={bytes:ArrayBuffer;name:string;type:string;lastModified:number};
type StoredEntry=Omit<Entry,'file'>&{file?:File;attachment?:{name:string;type:string}};
const storedFiles=new Map<string,Map<string,File>>();
async function database(name:string){return new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open(name,2);
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('journal'))db.createObjectStore('journal');if(!db.objectStoreNames.contains('attachments'))db.createObjectStore('attachments');};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});}
export async function readJournal(name='jixiang-companion'):Promise<Journal>{
  const db=await database(name);
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction(['journal','attachments']);let value:Journal=emptyJournal;
    const req=tx.objectStore('journal').get('current');
    req.onsuccess=()=>{
      const raw=req.result??emptyJournal;value={...emptyJournal,...raw,entries:[]};
      value.entries=(raw.entries??[]).map((stored:StoredEntry)=>{
        const {attachment,...entry}=stored;
        if(attachment){const binary=tx.objectStore('attachments').get(entry.id);binary.onsuccess=()=>{const saved:StoredAttachment|undefined=binary.result;if(saved?.bytes)entry.file=normaliseWorkFile(new File([saved.bytes],saved.name,{type:saved.type,lastModified:saved.lastModified}));};}
        else if(entry.file instanceof File)entry.file=normaliseWorkFile(entry.file);
        return entry;
      });
    };
    tx.oncomplete=()=>{
      // Legacy File records must be converted on their next save.
      const files=new Map<string,File>();
      for(const entry of value.entries)if(entry.file&&!(req.result?.entries??[]).find((e:StoredEntry)=>e.id===entry.id)?.file)files.set(entry.id,entry.file);
      storedFiles.set(name,files);resolve(value);
    };tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
  });}finally{db.close();}
}
export async function saveJournal(value:Journal,name='jixiang-companion'){
  // Store actual bytes, never an object URL or a browser-specific File reference.
  const previous=storedFiles.get(name);
  const files=new Map(value.entries.filter(e=>e.file).map(e=>[e.id,e.file!]));
  const prepared=await Promise.all(value.entries.map(async({file,...entry})=>({entry,file,binary:file&&previous?.get(entry.id)!==file?{bytes:await file.arrayBuffer(),name:file.name,type:file.type,lastModified:file.lastModified}:undefined})));
  const db=await database(name);
  try{await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(['journal','attachments'],'readwrite');const attachments=tx.objectStore('attachments');
    // Both metadata and originals commit together. Removed works leave no orphan files.
    const keys=attachments.getAllKeys();
    keys.onsuccess=()=>{for(const id of keys.result)if(!files.has(String(id)))attachments.delete(id);};
    for(const row of prepared)if(row.binary)attachments.put(row.binary,row.entry.id);
    tx.objectStore('journal').put({...value,entries:prepared.map(({entry,file})=>({...entry,...(file?{attachment:{name:file.name,type:file.type}}:{})}))},'current');
    tx.oncomplete=()=>{storedFiles.set(name,files);resolve();};tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
  });}finally{db.close();}
}
