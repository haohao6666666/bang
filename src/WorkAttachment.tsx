import {useEffect,useState} from 'react';
import {BottomSheet} from './ProductSheet';
import {readDocument} from './reading';
export function WorkAttachment({file}:{file:File}){
  const [url,setUrl]=useState(''),[open,setOpen]=useState(false),[text,setText]=useState(''),[error,setError]=useState('');
  useEffect(()=>{const next=URL.createObjectURL(file);setUrl(next);return()=>URL.revokeObjectURL(next);},[file]);
  useEffect(()=>{if(!open||file.type.startsWith('image/'))return;let live=true;readDocument(file).then(result=>{if(live)setText(result.text);}).catch(()=>{if(live)setError('可以保存原文件，用你熟悉的软件打开。');});return()=>{live=false;};},[open,file]);
  if(!url)return null;
  return <>
    <button className="work-attachment" aria-label={`查看作品：${file.name}`} onClick={()=>setOpen(true)}>{file.type.startsWith('image/')?<img className="work-image" src={url} alt={file.name}/>:<span className="document-file">▤ {file.name}<small>点开阅读</small></span>}</button>
    <BottomSheet open={open} onOpenChange={setOpen} title={file.name} snap={.9}>
      <div className="work-file-preview" data-testid="work-file-preview">
        {file.type.startsWith('image/')?<img src={url} alt={file.name}/>:<pre>{text||error||'正在打开文档…'}</pre>}
        <a className="outline-button" href={url} download={file.name}>保存原文件</a>
      </div>
    </BottomSheet>
  </>;
}
