import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './gettingStarted.css';

export type TourDestination = 'today' | 'calendar' | 'works' | 'collection' | 'my' | 'chat';
type Step = {id:string;title:string;copy:string;anchor:string;action?:string;event?:'click'|'change';enter?:TourDestination};
const steps:Step[] = [
  {id:'welcome',title:'从一件小事开始',copy:'跟着亮起来的地方点一遍，就能把知途用起来。都是实际操作，留下的记录也会保存。',anchor:'.journal-hero, .focus-card',enter:'today'},
  {id:'add',title:'安排今天想做的事',copy:'点这里添加任务。演示时可以写“画一只小狗”，时长先填 1 分钟。',anchor:'.add-task-button',action:'.add-task-button'},
  {id:'form',title:'名字、类别和时间',copy:'写下想做的事，选好类别和分钟数，再点“加入路线”。想留下什么可以不填。',anchor:'.task-composer',action:'.task-composer .primary-button'},
  {id:'start',title:'准备好了，就开始',copy:'点“开始投入”。这一小段时间，只做眼前这件事。',anchor:'.next-step-card .primary-button',action:'.next-step-card .primary-button'},
  {id:'timer',title:'时间在这里慢慢走',copy:'圆圈里是倒计时，下面是本次时长。小芽会安静地陪你看书。',anchor:'.focus-timer-dial'},
  {id:'pause',title:'想歇一会儿也可以',copy:'点“先停一下”，计时暂停，小芽也陪你休息。',anchor:'.focus-actions .primary-button',action:'.focus-actions .primary-button'},
  {id:'resume',title:'休息好了，接着来',copy:'点“继续投入”，从刚才停下的地方继续计时。',anchor:'.focus-actions .primary-button',action:'.focus-actions .primary-button'},
  {id:'end',title:'这一段可以先收工',copy:'点“结束”回到今日。时间到时会响一声，还能选择做完、继续、放下或再加 10 分钟。',anchor:'.focus-actions .outline-button',action:'.focus-actions .outline-button'},
  {id:'done',title:'做完以后，自己记一笔',copy:'如果这件事已经做完，点这里。日历会一起记下 ✓；还要继续就跳过这步。',anchor:'.task-close-actions button:last-child',action:'.task-close-actions button:last-child'},
  {id:'chat',title:'和小芽说两句',copy:'点这里聊聊做到哪儿了。下次打开同一件事，小芽就能接着聊。',anchor:'.companion-invite',action:'.companion-invite'},
  {id:'memory',title:'愿意的话，让小芽记着',copy:'第一次聊天，选“好呀”就能收到回复并记住进度。也可以先只把记录留在这里。',anchor:'.memory-intro, .chat-memory-off, .chat-timeline'},
  {id:'message',title:'说得具体一点就好',copy:'比如“耳朵画好了，尾巴下次画”。写好后点“留下”，等小芽回复。',anchor:'.chat-composer',action:'.chat-compose-actions .primary-button',enter:'chat'},
  {id:'upload',title:'把自己的作品也收好',copy:'点“留作品”，选择照片或文档。文件不超过 10 MB；不想上传也可以跳过。',anchor:'.chat-compose-actions label',action:'.chat-compose-actions input[type=file]',event:'change'},
  {id:'reading',title:'想听小芽聊聊作品吗？',copy:'开启“让小芽读作品”，它会看照片或读文档后回应。这个开关随时能关。',anchor:'.chat-composer .settings-row, .chat-composer'},
  {id:'save-work',title:'点一下，就留下来了',copy:'点“留下”保存作品。小芽的回复和纪念章会在准备好后补进来，不用反复点击。',anchor:'.chat-compose-actions .primary-button',action:'.chat-compose-actions .primary-button'},
  {id:'close-chat',title:'聊完了，先收起来',copy:'点这里关掉聊天。今日里的“和小芽聊聊”一直能带你回来。',anchor:'.companion-close',action:'.companion-close'},
  {id:'footprints',title:'做过的事都在足迹里',copy:'点“足迹”，翻翻今天留下的时间、作品和印章。',anchor:'.bottom-nav button:nth-child(2)',action:'.bottom-nav button:nth-child(2)'},
  {id:'time',title:'看看时间花在哪里',copy:'圆环按任务类别分颜色。可以切换今天、近 7 天、本月或全部；只统计真的专注过的时间。',anchor:'.task-time-stats',enter:'calendar'},
  {id:'calendar',title:'翻到想回看的那一天',copy:'卡片可以左右滑动。点今天的日期，打开当天做过的事。',anchor:'.stampbook-mobile-day-card.is-today .stampbook-mobile-day-date, .stampbook-mobile-day-date',action:'.stampbook-mobile-day-date'},
  {id:'day',title:'这一天，可以细细看',copy:'这里收着任务、时长、作品和小芽整理的小结。✓ 做完了，○ 还要继续，× 先放下。',anchor:'[data-testid=calendar-day-detail]'},
  {id:'back',title:'看完，回到日历',copy:'点这里返回。当天的章只出现一次，后续次数会记到印章册。',anchor:'.day-toolbar button:first-child',action:'.day-toolbar button:first-child'},
  {id:'works',title:'作品有自己的一页',copy:'点“作品”。这里只放作品，聊天不会挤在作品里。',anchor:'[data-tour=view-works]',action:'[data-tour=view-works]'},
  {id:'work-gallery',title:'留住从草稿到完成的过程',copy:'照片和文档都能重新打开、编辑或删除。同一个任务留下多张照片后，还能看看前后变化。',anchor:'.works-gallery'},
  {id:'collection',title:'翻开你的印章册',copy:'点“我的印章册”，看看每一枚章为什么出现。',anchor:'[data-tour=view-collection]',action:'[data-tour=view-collection]'},
  {id:'stamps',title:'每一枚章都有来历',copy:'按类别翻看，点章看含义和获得条件。浅色的是还没获得的，已有的章会记下日期和次数。',anchor:'.stamp-collection-category-tabs, .stamp-collection'},
  {id:'my',title:'按自己的习惯来',copy:'点“我的”，把陪伴方式调成你喜欢的样子。',anchor:'.bottom-nav button:nth-child(3)',action:'.bottom-nav button:nth-child(3)'},
  {id:'preferences',title:'想记什么，由你决定',copy:'记住进度、主动聊天、读作品可以分别开关。说“忘掉这件事”也能让小芽忘掉；设置里还能清除全部记忆。',anchor:'[data-tour=companion-settings]'},
  {id:'export',title:'把这些经历带走',copy:'点这里导出作品和聊天，得到可以直接打开阅读的小册子。暂时不需要就跳过。',anchor:'[data-tour=export-works]',action:'[data-tour=export-works]'},
  {id:'finish',title:'以后还可以跟着再走一遍',copy:'“重看新手教程”就在这里。准备好了，开始留下你自己的故事吧。',anchor:'[data-tour=replay-tutorial]'},
];
type Box={x:number;y:number;width:number;height:number};
type Layout={scope:HTMLElement;width:number;height:number;box:Box|null};

export function GettingStarted({onClose,onNavigate}:{onClose:()=>void;onNavigate:(to:TourDestination)=>void}) {
  const [index,setIndex]=useState(0),[layout,setLayout]=useState<Layout|null>(null);
  const tip=useRef<HTMLElement>(null),navigate=useRef(onNavigate),close=useRef(onClose),advancing=useRef(false);
  navigate.current=onNavigate;close.current=onClose;
  const step=steps[index];
  const next=()=>{if(index===steps.length-1)close.current();else setIndex(index+1);};
  const nextRef=useRef(next);nextRef.current=next;
  useEffect(()=>{
    advancing.current=false;
    if(step.enter)navigate.current(step.enter);
    let scrollOnce=false,advanceTimer=0;
    const measure=()=>{
      const selectors=step.anchor.split(',').map(s=>s.trim());
      let target:HTMLElement|undefined;
      for(const selector of selectors){target=[...document.querySelectorAll<HTMLElement>(selector)].find(el=>el.offsetWidth>0&&el.offsetHeight>0&&!el.closest('[inert]'));if(target)break;}
      const scope=target?.closest<HTMLElement>('.bottom-sheet')??document.querySelector<HTMLElement>('.jixiang-shell');
      if(!scope)return;
      if(target&&!scrollOnce){target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});scrollOnce=true;}
      const bounds=scope.getBoundingClientRect(),scale=bounds.width/scope.offsetWidth||1;
      const rect=target?.getBoundingClientRect();
      const x=rect?Math.max(0,(rect.left-bounds.left)/scale-6):0,y=rect?Math.max(0,(rect.top-bounds.top)/scale-6):0;
      const box=rect?{x,y,width:Math.max(0,Math.min(scope.clientWidth-x,(rect.right-bounds.left)/scale+6-x)),height:Math.max(0,Math.min(scope.clientHeight-y,(rect.bottom-bounds.top)/scale+6-y))}:null;
      setLayout({scope,width:scope.clientWidth,height:scope.clientHeight,box});
    };
    measure();const timer=window.setInterval(measure,120);
    const interact=(event:Event)=>{
      if(!step.action||advancing.current||!(event.target instanceof Element)||event.target.closest('.tour-root'))return;
      const action=event.target.closest(step.action);if(!action)return;
      if(step.id==='form'&&!document.querySelector<HTMLInputElement>('[aria-label="添加今日任务"]')?.value.trim())return;
      if(['message','save-work'].includes(step.id)&&(action as HTMLButtonElement).disabled)return;
      if(step.id==='upload'&&!(action as HTMLInputElement).files?.length)return;
      advancing.current=true;advanceTimer=window.setTimeout(()=>nextRef.current(),250);
    };
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current();}};
    document.addEventListener(step.event??'click',interact,true);document.addEventListener('keydown',escape,true);
    return()=>{clearInterval(timer);clearTimeout(advanceTimer);document.removeEventListener(step.event??'click',interact,true);document.removeEventListener('keydown',escape,true);};
  },[index]);
  if(!layout)return null;
  const {scope,width,height,box}=layout,tipWidth=Math.min(310,width-24),tipHeight=tip.current?.offsetHeight??200;
  const top=box?(box.y+box.height+12+tipHeight<height?box.y+box.height+12:box.y-tipHeight-12>8?box.y-tipHeight-12:height-tipHeight-12):24;
  const tipStyle={left:Math.max(12,Math.min(width-tipWidth-12,box?box.x+box.width/2-tipWidth/2:(width-tipWidth)/2)),top:Math.max(12,Math.min(height-tipHeight-12,top)),width:tipWidth};
  const panels=box?[
    {left:0,top:0,width,height:box.y},{left:0,top:box.y,width:box.x,height:box.height},
    {left:box.x+box.width,top:box.y,width:Math.max(0,width-box.x-box.width),height:box.height},
    {left:0,top:box.y+box.height,width,height:Math.max(0,height-box.y-box.height)},
  ]:[{left:0,top:0,width,height}];
  return createPortal(<div className="tour-root" data-testid="getting-started" data-step={step.id}>
    {panels.map((style,i)=><div className="tour-shade" style={style} key={i} aria-hidden="true"/>)}
    {box&&box.width>0&&box.height>0&&<div className="tour-spotlight" data-testid="tour-spotlight" style={{left:box.x,top:box.y,width:box.width,height:box.height}} aria-hidden="true"/>}
    <aside ref={tip} className="tour-tip" style={tipStyle} aria-label="新手引导" aria-live="polite">
      <header><span>小芽带你走一遍 · {index+1}/{steps.length}</span><button type="button" onClick={()=>close.current()} aria-label="结束新手引导">×</button></header>
      <h2>{step.title}</h2><p>{step.copy}</p>
      <footer>{step.action&&box?<><small>点亮起来的地方继续</small><button type="button" onClick={next}>跳过这步</button></>:<button type="button" className="tour-next" onClick={next}>{index===steps.length-1?'开始用知途':'下一步'}</button>}</footer>
    </aside>
  </div>,scope);
}
