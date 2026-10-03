import {useLayoutEffect,useRef,type ComponentProps} from 'react';
import {BottomSheet as RuntimeSheet,useKeyboard} from './mobile';

/** All product sheets dismiss native and preview keyboards before they leave. */
export function BottomSheet(props:ComponentProps<typeof RuntimeSheet>){
  const keyboard=useKeyboard();
  const content=useRef<HTMLDivElement>(null);
  const wasOpen=useRef(false);
  const dismissInput=()=>{
    const input=document.activeElement;
    if(input instanceof HTMLElement&&content.current?.contains(input))input.blur();
    keyboard.hide();
  };
  useLayoutEffect(()=>{
    if(wasOpen.current&&!props.open)dismissInput();
    wasOpen.current=props.open;
  },[props.open]);
  return <RuntimeSheet {...props} onOpenChange={open=>{if(!open)dismissInput();props.onOpenChange(open);}}>
    <div ref={content} style={{display:'contents'}}>{props.children}</div>
  </RuntimeSheet>;
}
