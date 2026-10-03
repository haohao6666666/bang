import fs from 'node:fs/promises';
import path from 'node:path';
import {defaults} from './providers.mjs';

export async function loadModelConfig(dataDir, env=process.env) {
  let stored={};
  try { stored=JSON.parse(await fs.readFile(path.join(dataDir,'model-config.json'),'utf8')); }
  catch(error) { if(error.code!=='ENOENT')throw error; }
  const config={};
  for(const kind of ['text','image']) {
    if(stored[kind]) { config[kind]={...defaults[kind],...stored[kind]}; continue; }
    const prefix=`JIXIANG_${kind.toUpperCase()}_`;
    const provider=env[prefix+'PROVIDER']||defaults[kind].provider;
    config[kind]={...defaults[kind],provider,baseUrl:env[prefix+'BASE_URL']||defaults[kind].baseUrl,
      model:env[prefix+'MODEL']||defaults[kind].model,
      apiKey:env[prefix+'API_KEY']||(['qwen','wan'].includes(provider)?env.DASHSCOPE_API_KEY||'':'')};
  }
  config.vision={provider:'doubao',baseUrl:'https://ark.cn-beijing.volces.com/api/v3',
    ...stored.vision,model:stored.vision?.model||env.JIXIANG_VISION_MODEL||'',
    apiKey:stored.vision?.apiKey||env.JIXIANG_VISION_API_KEY||(config.image.provider==='doubao'?config.image.apiKey:'')};
  return config;
}
