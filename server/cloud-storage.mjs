import {Buffer} from 'node:buffer';
import {randomUUID} from 'node:crypto';
import {ServiceError} from './validation.mjs';

// All objects are private. No object-listing or raw-memory HTTP route is exposed.
export function cloudStorage(env){
  const key=filename=>filename.replaceAll('\\','/').replace(/^\/+/, '');
  const missing=()=>Object.assign(new Error('Not found'),{code:'ENOENT'});
  const store={
    async mkdir(){},
    async readFile(filename,encoding){
      const object=await env.BUCKET.get(key(filename));if(!object)throw missing();
      return encoding?object.text():Buffer.from(await object.arrayBuffer());
    },
    async writeFile(filename,content){
      const name=key(filename);
      await env.BUCKET.put(name,content);
      await env.DB.prepare('INSERT INTO private_files (key, updated_at) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET updated_at=excluded.updated_at').bind(name,Date.now()).run();
    },
    async rename(from,to){
      const object=await env.BUCKET.get(key(from));if(!object)throw missing();
      await store.writeFile(to,await object.arrayBuffer());await store.rm(from,{force:true});
    },
    async readdir(directory){
      const prefix=key(directory).replace(/\/$/,'')+'/';
      const {results}=await env.DB.prepare('SELECT key FROM private_files WHERE substr(key, 1, ?) = ?').bind(prefix.length,prefix).all();
      return [...new Set(results.map(row=>row.key.slice(prefix.length).split('/')[0]))];
    },
    async rm(filename,{recursive=false,force=false}={}){
      const name=key(filename),prefix=name.replace(/\/$/,'')+'/';
      const {results}=await env.DB.prepare(recursive?'SELECT key FROM private_files WHERE key = ? OR substr(key, 1, ?) = ?':'SELECT key FROM private_files WHERE key = ?').bind(...(recursive?[name,prefix.length,prefix]:[name])).all();
      if(!results.length&&!force)throw missing();
      for(const row of results){await env.BUCKET.delete(row.key);await env.DB.prepare('DELETE FROM private_files WHERE key = ?').bind(row.key).run();}
    },
  };
  const withLock=async(directory,fn)=>{
    const name=key(directory),owner=randomUUID(),deadline=Date.now()+8000;
    while(true){
      const now=Date.now();
      const result=await env.DB.prepare('INSERT INTO memory_locks (key, owner, expires_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET owner=excluded.owner, expires_at=excluded.expires_at WHERE memory_locks.expires_at < ?').bind(name,owner,now+30000,now).run();
      if(result.meta.changes)break;
      if(Date.now()>deadline)throw new ServiceError('正在保存，稍后会接着试。',409);
      await new Promise(resolve=>setTimeout(resolve,80));
    }
    try{return await fn();}finally{await env.DB.prepare('DELETE FROM memory_locks WHERE key = ? AND owner = ?').bind(name,owner).run();}
  };
  return {storage:store,withLock};
}
