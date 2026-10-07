import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';

type Drag = {id:string;pointerId:number;x:number;y:number;lastX:number;lastY:number;target:string;row:HTMLElement;layer:HTMLElement;ghost:HTMLElement;scroll:HTMLElement|null;moved:boolean;frame:number};

/** A visual copy follows the pointer; only the final drop changes saved order. */
export function useTaskDrag(onReorder:(source:string,target:string)=>void,reduceMotion:boolean){
  const [draggingTaskId,setDraggingTaskId]=useState<string|null>(null);
  const [dragOverTaskId,setDragOverTaskId]=useState<string|null>(null);
  const dragRef=useRef<Drag|null>(null),suppressTaskClickRef=useRef(false);
  const settling=useRef<HTMLElement|null>(null),settleTimer=useRef(0),clickTimer=useRef(0);
  const reorder=useRef(onReorder);reorder.current=onReorder;
  const quiet=reduceMotion||window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  useEffect(()=>()=>{if(dragRef.current){cancelAnimationFrame(dragRef.current.frame);dragRef.current.layer.remove();}settling.current?.remove();clearTimeout(settleTimer.current);clearTimeout(clickTimer.current);},[]);
  const clear=()=>{setDraggingTaskId(null);setDragOverTaskId(null);settling.current?.remove();settling.current=null;};
  const beginTaskDrag=(event:ReactPointerEvent<HTMLButtonElement>,id:string)=>{
    if((event.button!==0&&event.pointerType!=='touch')||dragRef.current)return;
    event.preventDefault();event.stopPropagation();
    clearTimeout(settleTimer.current);clear();
    const row=event.currentTarget.closest<HTMLElement>('[data-task-drop]');if(!row)return;
    const bounds=row.getBoundingClientRect(),layer=document.createElement('div'),ghost=row.cloneNode(true) as HTMLElement;
    layer.className='task-drag-layer web-screen';layer.setAttribute('aria-hidden','true');layer.inert=true;
    const style=getComputedStyle(row.closest('.jixiang-shell')??row);
    for(const name of style)if(name.startsWith('--'))layer.style.setProperty(name,style.getPropertyValue(name));
    layer.style.fontFamily=style.fontFamily;layer.style.color=style.color;
    ghost.classList.remove('is-menu-open','is-dragging','is-drag-over');ghost.classList.add('task-drag-preview');
    for(const node of [ghost,...ghost.querySelectorAll<HTMLElement>('*')]){node.removeAttribute('id');node.removeAttribute('data-testid');node.removeAttribute('data-task-drop');node.removeAttribute('tabindex');}
    ghost.querySelector('.task-actions-menu')?.remove();
    ghost.style.left=bounds.left+'px';ghost.style.top=bounds.top+'px';ghost.style.width=bounds.width+'px';ghost.style.height=bounds.height+'px';
    layer.append(ghost);document.body.append(layer);
    const drag:Drag={id,pointerId:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,target:id,row,layer,ghost,scroll:row.closest<HTMLElement>('.mobile-scroll'),moved:false,frame:0};
    dragRef.current=drag;setDraggingTaskId(id);setDragOverTaskId(id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const follow=()=>{
      if(dragRef.current!==drag)return;
      ghost.style.transform=`translate3d(${drag.lastX-drag.x}px,${drag.lastY-drag.y}px,0)`;
      if(drag.moved&&drag.scroll){const area=drag.scroll.getBoundingClientRect();const edge=50;const dy=drag.lastY<area.top+edge?-8:drag.lastY>area.bottom-edge?8:0;if(dy)drag.scroll.scrollTop+=dy;}
      const target=document.elementFromPoint(drag.lastX,drag.lastY)?.closest<HTMLElement>('[data-task-drop]')?.dataset.taskDrop;
      if(target&&target!==drag.target){drag.target=target;setDragOverTaskId(target);}
      drag.frame=requestAnimationFrame(follow);
    };drag.frame=requestAnimationFrame(follow);
  };
  const moveTaskDrag=(event:ReactPointerEvent<HTMLButtonElement>)=>{const drag=dragRef.current;if(!drag||drag.pointerId!==event.pointerId)return;drag.lastX=event.clientX;drag.lastY=event.clientY;if(Math.hypot(drag.lastX-drag.x,drag.lastY-drag.y)>4)drag.moved=true;};
  const finish=(event:ReactPointerEvent<HTMLButtonElement>,cancelled:boolean)=>{
    const drag=dragRef.current;if(!drag||drag.pointerId!==event.pointerId)return;
    const finalTarget=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-task-drop]')?.dataset.taskDrop;
    if(finalTarget)drag.target=finalTarget;
    dragRef.current=null;cancelAnimationFrame(drag.frame);
    if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    if(drag.moved){suppressTaskClickRef.current=true;clearTimeout(clickTimer.current);clickTimer.current=window.setTimeout(()=>{suppressTaskClickRef.current=false;},280);}
    if(cancelled||!drag.moved){drag.layer.remove();clear();return;}
    const positions=new Map([...document.querySelectorAll<HTMLElement>('[data-task-drop]')].map(row=>[row.dataset.taskDrop!,row.getBoundingClientRect().top]));
    if(drag.target!==drag.id)reorder.current(drag.id,drag.target);
    settling.current=drag.layer;
    requestAnimationFrame(()=>{
      const rows=[...document.querySelectorAll<HTMLElement>('[data-task-drop]')];
      const destination=rows.find(row=>row.dataset.taskDrop===drag.id)?.getBoundingClientRect();
      if(!quiet)for(const row of rows){if(row.dataset.taskDrop===drag.id)continue;const delta=(positions.get(row.dataset.taskDrop!)??row.getBoundingClientRect().top)-row.getBoundingClientRect().top;if(Math.abs(delta)>1)row.animate([{transform:`translateY(${delta}px)`},{transform:'translateY(0)'}],{duration:220,easing:'cubic-bezier(.2,.7,.2,1)'});}
      if(destination&&!quiet){drag.ghost.animate([{transform:drag.ghost.style.transform,opacity:1},{transform:`translate3d(${destination.left-parseFloat(drag.ghost.style.left)}px,${destination.top-parseFloat(drag.ghost.style.top)}px,0)`,opacity:.85}],{duration:180,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});}
      settleTimer.current=window.setTimeout(clear,quiet?0:180);
    });
  };
  return {draggingTaskId,dragOverTaskId,suppressTaskClickRef,beginTaskDrag,moveTaskDrag,endTaskDrag:(e:ReactPointerEvent<HTMLButtonElement>)=>finish(e,false),cancelTaskDrag:(e:ReactPointerEvent<HTMLButtonElement>)=>finish(e,true)};
}
