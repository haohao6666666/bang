export function BrandMark({className=''}:{className?:string}){
  return <img className={`brand-wordmark ${className}`} src="/assets/ui-polish/wordmark.webp" width="288" height="152" alt="知途" draggable={false} decoding="async" loading="eager" fetchPriority="high"/>;
}
export function NavigationArt({kind}:{kind:'today'|'footprints'|'my'}){
  return <img className="navigation-art" src={`/assets/ui-polish/nav-${kind}.webp`} width="36" height="36" alt="" aria-hidden="true" draggable={false} decoding="async" loading="eager"/>;
}
export function NotebookBinding(){
  const binding=useRef<HTMLDivElement>(null);
  const [count,setCount]=useState(0);
  const start=80,spacing=112,size=26,bottom=40;
  useLayoutEffect(()=>{
    const page=binding.current?.parentElement;
    if(!page)return;
    // Measure the actual sheet, including late-loading works and responsive text.
    // Decorative absolute rings never contribute to the sheet's own height.
    const update=()=>setCount(Math.max(0,Math.floor((page.clientHeight-start-bottom-size)/spacing)+1));
    update();
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(update):null;
    observer?.observe(page);window.addEventListener('resize',update);
    return()=>{observer?.disconnect();window.removeEventListener('resize',update);};
  },[]);
  return <div ref={binding} className="notebook-binding" aria-hidden="true">{Array.from({length:count},(_,i)=><span className="notebook-binding-loop" key={i} style={{top:start+i*spacing}}><img src="/assets/ui-polish/binder-ring-v3.webp" width="40" height="26" alt="" draggable={false} loading="lazy" decoding="async"/></span>)}</div>;
}
import {useLayoutEffect,useRef,useState} from 'react';

