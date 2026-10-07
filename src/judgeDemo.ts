import {saveJournal,type Entry,type Journal,type Item} from './companionStore';
export const DEMO_STATE_KEY='zhitu-judge-state-v1';
export const DEMO_AI_KEY='zhitu-judge-ai-v1';
export const DEMO_DATABASE='zhitu-judge-companion-v1';
export const DEMO_DAYS=['2026-10-02','2026-10-03','2026-10-04'];
export const DEMO_SESSION_KEY='zhitu-judge-active';
export const DEMO_RELEASE_KEY='zhitu-judge-release';
export const DEMO_RELEASE='2';
export const DEMO_DAY_STORIES=[
  '读到狐狸的那一章，小狗画了耳朵，模型的代码也跑起来了。散步时看到一朵鲸鱼云，没做完的事就留个继续点。',
  '昨天的曲线进了笔记，负号也检查好了。小狗试了焦糖色，纸桥和那四小节留着明天接。画累了，就站起来动一动。',
  '草稿里的小狗有了颜色，纸桥试了两种样子，故事也有了结尾。小车还待继续，今晚云多没看到星星，没关系，下次再来。',
];
export const DEMO_TASKS=[
  {id:'demo-model',title:'比较 MLP 和 CNN 的识别效果',subject:'编程',kind:'coding',color:'sage',planMinutes:25},
  {id:'demo-robot',title:'把小车的装配再理顺一点',subject:'物理',kind:'custom',color:'peach',planMinutes:25},
  {id:'demo-design',title:'做一张长城主题的画面',subject:'绘画',kind:'custom',color:'yellow',planMinutes:25},
  {id:'demo-puppy',title:'给小狗画一条弯弯的尾巴',subject:'绘画',kind:'custom',color:'yellow',planMinutes:20},
  {id:'demo-reading',title:'读完《小王子》这一章',subject:'阅读',kind:'reading',color:'sage',planMinutes:20},
  {id:'demo-math',title:'整理三道容易出错的数学题',subject:'数学',kind:'exercise',color:'peach',planMinutes:20},
  {id:'demo-english',title:'练一段英文自我介绍',subject:'英语',kind:'exercise',color:'sage',planMinutes:15},
  {id:'demo-bean',title:'看看豆芽今天长到哪',subject:'自然观察',kind:'offline',color:'sage',planMinutes:10},
  {id:'demo-bridge',title:'试试纸桥能撑住几枚硬币',subject:'科学实验',kind:'offline',color:'peach',planMinutes:20},
  {id:'demo-writing',title:'写一段窗边的小故事',subject:'写作',kind:'custom',color:'yellow',planMinutes:15},
  {id:'demo-piano',title:'把那四小节弹顺',subject:'音乐',kind:'offline',color:'peach',planMinutes:15},
  {id:'demo-walk',title:'出门走走，看看云',subject:'运动',kind:'offline',color:'sage',planMinutes:15},
  {id:'demo-stretch',title:'放松一下肩膀和手腕',subject:'运动',kind:'offline',color:'sage',planMinutes:10},
  {id:'demo-cook',title:'和家人一起做早餐',subject:'生活',kind:'offline',color:'yellow',planMinutes:20},
  {id:'demo-desk',title:'给书桌腾一小块地方',subject:'生活',kind:'offline',color:'yellow',planMinutes:10},
  {id:'demo-origami',title:'折一只纸鹤',subject:'手工',kind:'offline',color:'peach',planMinutes:15},
  {id:'demo-map',title:'画一张校园小地图',subject:'地理',kind:'custom',color:'sage',planMinutes:20},
  {id:'demo-constellation',title:'找找今晚的北斗七星',subject:'自然观察',kind:'offline',color:'sage',planMinutes:10},
] as const;
type Run={day:number;task:number;minutes:number;status:'continued'|'completed'|'abandoned';text:string;reply:string;progress:string};
// These are fictional, deliberately varied scenes. The demo never calls a model.
export const DEMO_RUNS:Run[]=[
  {day:0,task:0,minutes:25,status:'continued',text:'模型对比的代码跑起来了，明天想整理 CNN 的曲线。',reply:'汪，跑起来啦！下次从整理曲线这里接着走。',progress:'模型对比代码跑通了，曲线留着明天整理。'},
  {day:0,task:1,minutes:20,status:'continued',text:'轮子和支架摆好了，配合还没弄明白。',reply:'这一步留着就好。我记着，下次先看配合，不用重新找。',progress:'轮子和支架摆好了，小车的配合还待检查。'},
  {day:0,task:2,minutes:15,status:'continued',text:'长城画面想用红色纸张，今天先找感觉，还没排版。',reply:'红色纸张配长城，想法收好啦。下一步从排版开始，汪～',progress:'长城画面定了红色纸张的方向，下次开始排版。'},
  {day:0,task:3,minutes:20,status:'continued',text:'小狗耳朵画好了，尾巴还只有一条淡淡的线。',reply:'耳朵先留在这儿，尾巴明天接着画。小狗不会跑掉的，汪～',progress:'小狗画了耳朵和眼睛，尾巴还是淡淡的草稿。'},
  {day:0,task:4,minutes:20,status:'continued',text:'读到小王子和狐狸见面了，想记一下什么叫建立联系。',reply:'这一句你想留住呀。下次从狐狸这里接着读。',progress:'《小王子》读到狐狸出场，想写写自己的理解。'},
  {day:0,task:5,minutes:15,status:'continued',text:'前两道错题改好了，第三道总忘记检查负号。',reply:'那就给负号留个小提醒。下次先看第三道，汪。',progress:'改了两道数学题，第三道要再检查负号。'},
  {day:0,task:6,minutes:15,status:'continued',text:'英文介绍写好了，读到喜欢画画那一句会卡住。',reply:'不用一下子说得飞快。明天先把那一句慢慢读顺。',progress:'英文介绍写好了，喜欢画画那一句还要练。'},
  {day:0,task:7,minutes:10,status:'completed',text:'豆子裂开了，白白的小根探出来了，我画在本子里了。',reply:'小根先来报到啦。今天这一格收好，明天再看看它。',progress:'观察了豆子冒出的白根，记在观察本里。'},
  {day:0,task:9,minutes:15,status:'continued',text:'小故事写了开头，主角是一只住在窗边的小狗。',reply:'窗边的小狗已经登场啦。后面发生什么，我们下次再接着想。',progress:'窗边小狗的故事写了开头，后面留着继续。'},
  {day:0,task:11,minutes:15,status:'completed',text:'出去走了一小圈，看到一朵云像鲸鱼。',reply:'鲸鱼云，今天的小发现收好啦，汪～',progress:'散步时看到一朵像鲸鱼的云。'},
  {day:0,task:14,minutes:10,status:'completed',text:'把桌上的旧纸收好了，现在有地方画画了。',reply:'空出的一小块桌面，刚好留给下一张画。',progress:'收好旧纸，给画画腾出了桌面。'},
  {day:1,task:0,minutes:35,status:'continued',text:'CNN 曲线整理好了，混淆矩阵也放进笔记了。',reply:'昨天说要整理的图，今天真的在笔记里啦。下次做对比就好找了，汪。',progress:'CNN 曲线和混淆矩阵放进了实验笔记。'},
  {day:1,task:1,minutes:25,status:'continued',text:'配合还在报错，可能是平面没对齐，先把截图留下。',reply:'那就从平面对齐这里留个继续点。还没解决也可以先歇歇。',progress:'小车配合仍报错，下次检查平面对齐。'},
  {day:1,task:2,minutes:20,status:'continued',text:'长城和白鸽摆进去了，右边有点挤，还想再挪一下。',reply:'想改的位置记下啦：右边再松一点。',progress:'长城和白鸽已排版，右侧留白还想调整。'},
  {day:1,task:3,minutes:25,status:'continued',text:'尾巴补好了，耳朵想涂成焦糖色，今天先试颜色。',reply:'汪，昨天那条淡淡的尾巴有样子啦。焦糖耳朵留着下一版看看。',progress:'小狗尾巴补好了，试了焦糖色耳朵。'},
  {day:1,task:5,minutes:20,status:'completed',text:'第三道负号检查好了，三道题的提醒都写在一起了。',reply:'那张负号提醒也留着，下次遇到类似的题就能翻回来。',progress:'三道数学题整理好了，留下了负号检查提醒。'},
  {day:1,task:6,minutes:15,status:'completed',text:'喜欢画画那句读顺了，整段介绍也读完了一遍。',reply:'昨天卡住的那一句，今天顺过去啦。把这一版收好，汪～',progress:'英文自我介绍完整练了一遍，昨天卡住的句子读顺了。'},
  {day:1,task:7,minutes:10,status:'completed',text:'豆芽的根更长了，今天先画根，叶子还没展开。',reply:'今天先记根的样子。叶子这一步，我们明天再看看。',progress:'豆芽的根比昨天长，叶子还没展开。'},
  {day:1,task:8,minutes:20,status:'continued',text:'平纸放两个硬币就弯了，明天想试试折起来的纸。',reply:'这个差别先记下。明天用折纸再试一次，汪。',progress:'平纸承重会弯，下次试试折成手风琴的纸。'},
  {day:1,task:10,minutes:15,status:'continued',text:'右手那四小节能弹了，左手一加入就会慢下来。',reply:'右手已经走到这里啦。下次先把左手单独慢慢接上。',progress:'练了四小节右手，左手还要慢慢接。'},
  {day:1,task:12,minutes:10,status:'completed',text:'画画以后肩膀有点累，站起来活动了一会儿。',reply:'休息也算今天的一小件事。手腕和肩膀都缓一缓，汪。',progress:'画画后活动了肩膀和手腕。'},
  {day:1,task:15,minutes:15,status:'continued',text:'纸鹤折到翅膀那一步了，两边还没一样高。',reply:'先留在翅膀这一步吧。下次把两边慢慢对齐。',progress:'纸鹤折到翅膀，下一步调整两边高度。'},
  {day:1,task:16,minutes:20,status:'completed',text:'画了从教室到图书馆的路线，操场也标上了。',reply:'这条熟悉的路也能变成作品呀，汪～',progress:'校园小地图画好了，标了图书馆和操场。'},
  {day:2,task:0,minutes:15,status:'completed',text:'这轮实验笔记写完了，下次想试试别的网络。',reply:'这次的图和笔记都收好啦。下次试新网络时，就从这一版往前走。',progress:'本轮实验笔记完成，下次想试试别的网络。'},
  {day:2,task:1,minutes:30,status:'continued',text:'重新看了装配，固定零件之间的配合还要检查，先不说完成。',reply:'记下啦：固定零件之间的配合。下次回来，我先陪你从这里看，汪。',progress:'小车固定零件间的配合待检查，装配还没完成。'},
  {day:2,task:2,minutes:30,status:'completed',text:'长城画面这一版好了，红色纸张、白鸽和长城都在里面。',reply:'前两天的小想法有了这一版。喜欢的画面，收好啦，汪～',progress:'长城画面完成了这一版，红色纸张和白鸽都留下了。'},
  {day:2,task:3,minutes:25,status:'completed',text:'小狗涂好颜色了，耳朵是焦糖色，尾巴也终于画好了。',reply:'从一条淡淡的尾巴，到这只焦糖耳朵的小狗，两张都留下吧，汪！',progress:'小狗画好了颜色，尾巴也完成了，草稿和成稿都留着。'},
  {day:2,task:4,minutes:20,status:'completed',text:'这一章读完了。我觉得建立联系就是开始惦记一件小事。',reply:'你自己的这句话也收好。下次翻回来，还能记起当时怎么想的。',progress:'读完这一章，写下自己对建立联系的理解。'},
  {day:2,task:7,minutes:10,status:'completed',text:'今天画了展开的两片小叶子，想再看看明天会不会更大。',reply:'从白根到小叶子，观察本里多了一页。明天再来看看它，汪。',progress:'画了豆芽的两片叶子，想继续观察大小的变化。'},
  {day:2,task:8,minutes:15,status:'completed',text:'折起来的纸桥放了一小叠硬币还没倒，平纸更容易弯。',reply:'这次试出来的不同，和照片一起留下。以后还可以换个折法再试。',progress:'折纸桥放住了一小叠硬币，留下了和弯曲平纸的对比。'},
  {day:2,task:9,minutes:20,status:'completed',text:'故事写完了，小狗最后把窗边的位置留给了新朋友。',reply:'原来结尾留了一小块位置给朋友呀。和第一天的开头一起收好。',progress:'窗边小狗的故事写完了，结尾留了位置给新朋友。'},
  {day:2,task:10,minutes:15,status:'completed',text:'左右手终于接上这四小节了，还弹得慢，但不总停了。',reply:'慢慢弹，也能把这一段连起来。今天这一步留住，汪。',progress:'四小节左右手接上了，速度慢一些但能连着弹。'},
  {day:2,task:13,minutes:20,status:'completed',text:'和家人做了鸡蛋吐司，我负责打蛋和摆盘。',reply:'你负责的这两步，也放进今天的小事里。',progress:'一起做鸡蛋吐司，负责打蛋和摆盘。'},
  {day:2,task:15,minutes:15,status:'completed',text:'纸鹤翅膀终于一样高了，放在窗边了。',reply:'昨天没对齐的翅膀，今天调整好啦。让它在窗边待着吧，汪～',progress:'纸鹤调整好翅膀，放在了窗边。'},
  {day:2,task:17,minutes:8,status:'abandoned',text:'云太多了，没看到北斗七星，今晚不找了。',reply:'那今晚就先放下吧。等天晴了，再抬头看看。',progress:'今晚云多没看到北斗七星，先放下，等天晴再试。'},
];
const at=(day:number,minutes:number)=>new Date(`${DEMO_DAYS[day]}T09:00:00+08:00`).getTime()+minutes*60000;
export function demoState(){
  const offsets=[0,0,0];
  const logs=DEMO_RUNS.map((run,index)=>{const startedAt=at(run.day,offsets[run.day]);offsets[run.day]+=run.minutes+8;return {id:`demo-log-${index}`,dateKey:DEMO_DAYS[run.day],taskId:DEMO_TASKS[run.task].id,startedAt,endedAt:startedAt+run.minutes*60000,durationMs:run.minutes*60000};});
  const ledger=Object.fromEntries(DEMO_TASKS.map(task=>[task.id,logs.filter(log=>log.taskId===task.id).reduce((sum,log)=>sum+log.durationMs,0)]));
  return {version:5,tasks:DEMO_TASKS.map((task,index)=>({...task,duration:`${task.planMinutes} 分钟`,actualMs:ledger[task.id],status:DEMO_RUNS.filter(run=>run.task===index).at(-1)?.status??'ready',expectedArtifact:'留下今天这一小步',revisionCount:0})),focusSession:{activeTaskId:'demo-robot',status:'idle',startedAt:null,elapsedMs:0},focusLedger:ledger,focusLogs:logs,outcomes:DEMO_RUNS.map((run,index)=>({id:`demo-outcome-${index}`,dateKey:DEMO_DAYS[run.day],taskId:DEMO_TASKS[run.task].id,classification:run.status,evidenceType:'self-report',body:run.text,createdAt:logs[index].endedAt,version:1})),diaries:DEMO_DAYS.map((day,index)=>({id:`demo-diary-${index}`,dateKey:day,text:['小狗还只有草稿，小车也卡了一下。出去散步看到一朵鲸鱼云，今天的小事就这样收好了。','曲线放进笔记了，负号也检查好了。画累了就站起来动动，明天接着尾巴、纸桥和那四小节。','小狗有了颜色，纸桥也试了两种样子。小车还没做完，星星也没看到，留给下次再慢慢来。'][index],createdAt:at(index,700),updatedAt:at(index,700)})),notes:[],dailyEchoes:{},weeklyEchoes:[],milestones:[],blockers:[],experiments:[],sourceRef:null,methodNote:'',stampStyles:{},stampBook:{version:5,styleAssignments:{}},preferences:{focusMode:'short',reminderEnabled:true,echoTime:'21:30',includeDiaryInAI:false,zhihuMatching:false,zhihuConnected:false,reduceMotion:false,theme:'paper'}};
}
const pictureWorks=[
  {asset:'model-experiment.webp',name:'模型实验结果.webp',day:1,task:0,text:'CNN 实验曲线与混淆矩阵。',reply:'曲线和混淆矩阵收在这一页啦。下次对比时可以翻回来。',generated:false},
  {asset:'robot-assembly.webp',name:'小车装配记录.webp',day:2,task:1,text:'装配还有配合错误，留着下次检查。',reply:'图里还有配合错误。下次先看平面对齐和固定零件之间的配合，汪。',generated:false},
  {asset:'great-wall.webp',name:'长城主题作品.webp',day:2,task:2,text:'长城主题画面这一版做好了。',reply:'红色纸张、白鸽和长城，都留在这一版里啦。',generated:false},
  {asset:'puppy-sketch.webp',name:'小狗画作·第一天草稿.webp',day:0,task:3,text:'耳朵和眼睛先画好了，尾巴还是轻轻的一条线。',reply:'先把这一版留下。等尾巴画好，我们还能回来看看最初的样子。',generated:true},
  {asset:'puppy-finished.webp',name:'小狗画作·第三天上色.webp',day:2,task:3,text:'补好了尾巴，给耳朵涂了焦糖色。',reply:'尾巴和焦糖耳朵都有啦，汪～两张画放一起，就是这三天的小变化。',generated:true},
  {asset:'bean-observation.webp',name:'豆芽观察页.webp',day:2,task:7,text:'把白根和两片小叶子的样子画在观察本里。',reply:'根和小叶子都记下了。下次看看叶子有没有再展开一点。',generated:true},
  {asset:'paper-bridge.webp',name:'纸桥承重小实验.webp',day:2,task:8,text:'折成手风琴的纸桥放住了一小叠硬币，旁边的平纸弯了。',reply:'这两种样子就留在一起。以后还可以换一种折法再试，汪。',generated:true},
];
const documentWorks=[
  {id:'notebook',name:'三天实验手记.txt',day:2,task:0,text:'把三天的步骤写在一份小手记里。',body:'三天实验手记（演示）\n10月2日：跑通模型对比代码，等待整理曲线。\n10月3日：整理 CNN 曲线和混淆矩阵，保存截图。\n10月4日：整理完本轮实验笔记。\n下次想试试其他网络。'},
  {id:'english',name:'我的英文介绍.txt',day:1,task:6,text:'留下这一版读顺了的英文介绍。',body:'英文自我介绍（演示）\nHi, I am Lin. I like drawing little animals.\nMy favourite place is the window seat.\nI am learning to make a paper bridge with my friends.\n\n我的小提醒：画画那一句慢慢读，句子中间停一下。'},
  {id:'reading',name:'读到狐狸那一章.txt',day:2,task:4,text:'把读完这一章时自己的想法留下。',body:'阅读小便签（演示）\n我觉得建立联系，就是开始惦记一件小事。\n比如明天看看豆芽的新叶子，或者记得朋友还没讲完的故事。\n下次想读读后面的告别。'},
  {id:'story',name:'窗边的小狗·故事.txt',day:2,task:9,text:'故事从第一天的开头，接到了今天的结尾。',body:'窗边的小狗（演示原创故事）\n小狗每天都坐在窗边，等一朵像鲸鱼的云。\n今天来了一个新朋友，窗边的位置有一点小。\n小狗把自己的尾巴收了收，往旁边挪了一点。\n它们一起等那朵云。'}
];
export const DEMO_WORK_COUNT=pictureWorks.length+documentWorks.length;
export async function seedJudgeDemo(){
  const entries:Entry[]=DEMO_RUNS.map((run,index)=>({id:`demo-chat-${index}`,taskId:DEMO_TASKS[run.task].id,title:DEMO_TASKS[run.task].title,dateKey:DEMO_DAYS[run.day],kind:'chat',text:run.text}));
  const items:Item[]=DEMO_RUNS.map((run,index)=>({id:`demo-chat-${index}`,taskId:DEMO_TASKS[run.task].id,dateKey:DEMO_DAYS[run.day],reply:run.reply,progress:run.progress,recap:run.progress}));
  const pictures=await Promise.all(pictureWorks.map(async(work,index)=>{
    const response=await fetch(`/assets/judge-demo/${work.asset}`);if(!response.ok)throw new Error('演示作品还没加载好，请再试一次。');
    const blob=await response.blob();
    return {work,index,file:new File([blob],work.name,{type:'image/webp'})};
  }));
  for(const {work,index,file} of pictures){
    const entry:Entry={id:`demo-work-${index}`,taskId:DEMO_TASKS[work.task].id,title:DEMO_TASKS[work.task].title,dateKey:DEMO_DAYS[work.day],kind:'work',text:`${work.text}\n演示作品 · ${work.generated?'生成素材':'你提供的图片'}`,file};
    entries.push(entry);items.push({id:entry.id,taskId:entry.taskId,dateKey:entry.dateKey,reply:work.reply,progress:work.text,recap:work.text});
  }
  for(const work of documentWorks)entries.push({id:`demo-work-${work.id}`,taskId:DEMO_TASKS[work.task].id,title:DEMO_TASKS[work.task].title,dateKey:DEMO_DAYS[work.day],kind:'work',text:`${work.text}\n演示作品 · 预置文档`,file:new File([work.body],work.name,{type:'text/plain'})});
  const journal:Journal={entries,items,enabled:true,introduced:true,proactive:false,attachmentsEnabled:false};
  await saveJournal(journal,DEMO_DATABASE);
  localStorage.setItem(DEMO_STATE_KEY,JSON.stringify(demoState()));localStorage.removeItem(DEMO_AI_KEY);localStorage.setItem(DEMO_RELEASE_KEY,DEMO_RELEASE);
}
export function demoReply(taskId:string,text:string,progress?:string,dateKey=DEMO_DAYS[2]){
  const task=DEMO_TASKS.find(row=>row.id===taskId);
  const mentioned=DEMO_TASKS.find(row=>row.id==='demo-robot'&&/小车|装配/.test(text)||row.id==='demo-puppy'&&/尾巴|小狗.*画|画.*小狗/.test(text)||row.id==='demo-bridge'&&/纸桥|硬币/.test(text)||row.id==='demo-bean'&&/豆芽|叶子/.test(text)||row.id==='demo-math'&&/负号|错题/.test(text));
  if(/上次|之前|哪里|哪了|接着|记得/.test(text)){
    const id=mentioned?.id??task?.id;
    const previous=mentioned?DEMO_RUNS.filter(run=>DEMO_TASKS[run.task].id===id&&DEMO_DAYS[run.day]<=dateKey).at(-1)?.progress:progress;
    return `汪，我记着呢：${previous||'上次留下的那一步，接着慢慢做就好。'}`;
  }
  if(/忘掉|记错/.test(text))return '好呀，这一句我先放下了，汪～';
  return '汪，收好这一句啦。下次回来，我们接着这里聊。';
}

