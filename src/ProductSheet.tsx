import {useLayoutEffect,useRef,useState,type ComponentProps} from 'react';
import {BottomSheet as RuntimeSheet,useKeyboard} from './mobile';
import {Cross2Icon} from '@radix-ui/react-icons';

/** All product sheets dismiss native and preview keyboards before they leave. */
export function BottomSheet(props:ComponentProps<typeof RuntimeSheet>){
  const keyboard=useKeyboard();
  const content=useRef<HTMLDivElement>(null);
  const wasOpen=useRef(false);
  const [present,setPresent]=useState(props.open);
  useLayoutEffect(()=>{
    if(props.open){setPresent(true);return;}
    if(!present)return;
    // Nested portal dialogs can hold AnimatePresence's exit open forever.
    // Remove the product layer once its short dismissal has cleared the screen.
    const timer=window.setTimeout(()=>setPresent(false),380);
    return()=>window.clearTimeout(timer);
  },[props.open,present]);
  const dismissInput=()=>{
    const input=document.activeElement;
    if(input instanceof HTMLElement&&content.current?.contains(input))input.blur();
    keyboard.hide();
  };
  useLayoutEffect(()=>{
    if(wasOpen.current&&!props.open)dismissInput();
    wasOpen.current=props.open;
  },[props.open]);
  useLayoutEffect(()=>{
    if(!props.open)return;
    // Safari may scroll the page behind a focused portal input. Only the
    // conversation itself should move; keep the underlying page where it was.
    const pages=Array.from(document.querySelectorAll<HTMLElement>('.app-screen .mobile-scroll'));
    const positions=pages.map(page=>({page,top:page.scrollTop,left:page.scrollLeft}));
    const restore=()=>{for(const {page,top,left} of positions){if(page.scrollTop!==top)page.scrollTop=top;if(page.scrollLeft!==left)page.scrollLeft=left;}};
    for(const page of pages)page.addEventListener('scroll',restore);
    return ()=>{
      restore();
      // Keep the lock through the native keyboard's closing animation.
      window.setTimeout(()=>{restore();for(const page of pages)page.removeEventListener('scroll',restore);},350);
    };
  },[props.open]);
  if(!present&&!props.open)return null;
  return <RuntimeSheet {...props} onOpenAutoFocus={event=>{
    // Do not summon Safari's keyboard or scroll a background control on open.
    event.preventDefault();
    content.current?.closest<HTMLElement>('.bottom-sheet')?.focus({preventScroll:true});
    props.onOpenAutoFocus?.(event);
  }} onOpenChange={open=>{if(!open)dismissInput();props.onOpenChange(open);}}>
    <div ref={node=>{
      content.current=node;
      const sheet=node?.closest('.bottom-sheet');
      sheet?.classList.add('product-sheet');
      sheet?.classList.toggle('is-chat-sheet',Boolean(node?.querySelector('.companion-chat')));
      sheet?.classList.toggle('is-reduced-motion',Boolean(document.querySelector('.jixiang-shell.reduce-motion')));
    }} style={{display:'contents'}}>
      {props.title!=='小芽'&&<button type="button" className="product-sheet-close" aria-label={`关闭${props.title}`} onClick={()=>{dismissInput();props.onOpenChange(false);}}><Cross2Icon aria-hidden="true"/></button>}
      {props.children}
    </div>
  </RuntimeSheet>;
}


