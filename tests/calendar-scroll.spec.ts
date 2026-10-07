import {test, expect, type Page} from '@playwright/test';

test.use({timezoneId:'Asia/Shanghai',hasTouch:true});

async function openCalendar(page:Page,width:number,demo:boolean) {
  await page.setViewportSize({width,height:844});
  await page.clock.setFixedTime(new Date('2026-10-04T12:00:00+08:00'));
  await page.addInitScript(({demo})=>{
    sessionStorage.setItem('jixiang-welcome-seen-v1','yes');
    localStorage.setItem('jixiang-getting-started-v1','yes');
    if(demo)return;
    const tasks=Array.from({length:15},(_,i)=>({id:`scroll-task-${i}`,title:`画小狗的第 ${i+1} 个细节`,subject:'绘画',duration:'20 分钟',planMinutes:20,actualMs:600000,status:'completed',kind:'drawing',color:'sage',expectedArtifact:'',revisionCount:0}));
    const focusLogs=tasks.map((task,i)=>{const dateKey=i<12?'2026-10-04':'2026-10-03',startedAt=new Date(`${dateKey}T10:00:00+08:00`).getTime();return {id:`scroll-log-${i}`,taskId:task.id,dateKey,startedAt,endedAt:startedAt+600000,durationMs:600000};});
    localStorage.setItem('jixiang-prototype-state-v5',JSON.stringify({version:5,tasks,focusLogs,focusSession:{activeTaskId:null,status:'idle',startedAt:null},focusLedger:Object.fromEntries(tasks.map(t=>[t.id,t.actualMs])),preferences:{reduceMotion:true},stampStyles:{},stampBook:{version:5,styleAssignments:{}}}));
  },{demo});
  await page.goto('/');
  if(demo){await page.getByRole('button',{name:'进入评委演示'}).click();await expect(page.getByRole('region',{name:'三天体验演示'})).toBeVisible();}
  await page.getByRole('navigation',{name:'主要导航'}).getByRole('button',{name:'足迹',exact:true}).click();
  await expect(page.getByRole('heading',{name:'每一天，都算数',exact:true})).toBeVisible();
}

async function bottomCardPoint(page:Page) {
  const scroll=page.locator('.app-screen .mobile-scroll');
  await scroll.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  const viewport=(await scroll.boundingBox())!,card=(await page.locator('.calendar-day-carousel').boundingBox())!;
  const x=card.x+card.width/2,y=Math.max(viewport.y+30,Math.min(viewport.y+viewport.height-200,card.y+card.height/2));
  expect(await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('.calendar-day-carousel'),{x,y})).toBe(true);
  return {scroll,x,y};
}

for(const demo of [true,false])for(const width of [360,393,1366])test(`${demo?'three-day demo':'personal'} calendar can scroll back up from a day card at ${width}px`,async({page})=>{
  await openCalendar(page,width,demo);
  const {scroll,x,y}=await bottomCardPoint(page),carousel=page.locator('.calendar-day-carousel');
  const before=await page.evaluate(()=>Object.entries(localStorage).filter(([key])=>/prototype-state/.test(key)));
  const top=await scroll.evaluate(el=>el.scrollTop),left=await carousel.evaluate(el=>el.scrollLeft);
  expect(top).toBeGreaterThan(500);
  await page.mouse.move(x,y);await page.mouse.wheel(0,-240);
  await expect.poll(()=>scroll.evaluate(el=>el.scrollTop)).toBeLessThan(top-100);
  expect(await carousel.evaluate(el=>el.scrollLeft)).toBe(left);
  await expect(page.getByTestId('calendar-day-detail')).toHaveCount(0);
  for(let i=0;i<6;i++){await page.mouse.wheel(0,-650);await page.waitForTimeout(70);}
  await expect.poll(()=>scroll.evaluate(el=>el.scrollTop)).toBe(0);
  expect(await page.evaluate(()=>Object.entries(localStorage).filter(([key])=>/prototype-state/.test(key)))).toEqual(before);
});

test('vertical touch and horizontal date swipes stay independent at the bottom of the demo',async({page,browserName})=>{
  test.skip(browserName!=='chromium','Real touch dispatch is exercised through Chromium CDP; WebKit covers wheel and pointer scrolling.');
  await openCalendar(page,393,true);
  const {scroll,x,y}=await bottomCardPoint(page),carousel=page.locator('.calendar-day-carousel');
  const top=await scroll.evaluate(el=>el.scrollTop),cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+Math.sin(i)*2,y:y+i*14}]});await page.waitForTimeout(12);}
  await expect.poll(()=>scroll.evaluate(el=>el.scrollTop)).toBeLessThan(top-100);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(page.getByTestId('calendar-day-detail')).toHaveCount(0);
  const next=await bottomCardPoint(page),start=await scroll.evaluate(el=>el.scrollTop);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:next.x+80,y:next.y}]});
  for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:next.x+80-i*16,y:next.y+Math.sin(i)*2}]});await page.waitForTimeout(12);}
  await expect.poll(()=>carousel.evaluate(el=>el.scrollLeft)).toBeGreaterThan(100);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  expect(await scroll.evaluate(el=>el.scrollTop)).toBe(start);
  await expect(page.getByTestId('calendar-day-detail')).toHaveCount(0);
});
