import {test,expect,type Page} from '@playwright/test';
import {buildStampBookPage} from '../src/stampBook';
import {buildStampCollection,stampAsset} from '../src/stampDefinitions';
import {collectDailyStamps} from '../src/dailyStamps';
import {demoState,DEMO_DAYS} from '../src/judgeDemo';

test.use({timezoneId:'Asia/Shanghai'});

test('daily stamps retain repeated time types, complete quantities and dated growth evidence',()=>{
  const state=demoState(),before=JSON.stringify(state),collection=buildStampCollection(state);
  for(const dateKey of DEMO_DAYS){
    const page=buildStampBookPage({...state,dateKey,styleAssignments:state.stampBook.styleAssignments}),stamps=collectDailyStamps(page,collection);
    expect(stamps.filter(item=>item.definition.category==='time').length).toBeGreaterThan(3);
    expect(stamps.filter(item=>item.definition.category==='time').reduce((sum,item)=>sum+item.count,0)).toBe(page.totalActualStampCount);
    expect(new Set(stamps.map(item=>stampAsset(item.definition))).size).toBe(stamps.length);
    for(const stamp of stamps.filter(item=>item.definition.category!=='time'))for(const definition of stamp.definitions)expect(collection.find(item=>item.definition.key===definition.key)?.firstEarnedDate).toBe(dateKey);
  }
  expect(JSON.stringify(state)).toBe(before);
});

test('plans, subthreshold focus and another date cannot paint a stamp',()=>{
  const tasks=[{id:'reading',title:'读一页书',subject:'科研阅读',actualMs:6000000,planMinutes:30}];
  const focusLogs=[{id:'earlier',taskId:'reading',dateKey:'2026-10-02',durationMs:600000},{id:'short',taskId:'reading',dateKey:'2026-10-03',durationMs:540000}];
  const collection=buildStampCollection({tasks,focusLogs});
  for(const dateKey of ['2026-10-03','2026-10-04']){
    const page=buildStampBookPage({tasks,focusLogs,dateKey,actualMsByTask:{reading:dateKey==='2026-10-03'?540000:0},styleAssignments:{}});
    expect(collectDailyStamps(page,collection)).toEqual([]);
  }
});

async function open(page:Page,width:number){
  await page.setViewportSize({width,height:900});await page.clock.setFixedTime(new Date('2026-10-04T12:00:00+08:00'));
  await page.addInitScript(()=>{sessionStorage.setItem('jixiang-welcome-seen-v1','yes');localStorage.setItem('jixiang-getting-started-v1','yes');});
  await page.goto('/');await page.getByRole('button',{name:'进入评委演示'}).click();await expect(page.getByRole('region',{name:'三天体验演示'})).toBeVisible();
  await page.getByRole('navigation',{name:'主要导航'}).getByRole('button',{name:'足迹',exact:true}).click();
}

for(const width of [320,393,412,1366])test(`all three demo days show six stamps on paper and full quantities in detail at ${width}px`,async({page})=>{
  await open(page,width);
  const logsBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhitu-judge-state-v1')!).focusLogs);
  for(const dateKey of DEMO_DAYS){
    const card=page.locator(`.stampbook-mobile-day-card[data-date="${dateKey}"]`);await card.scrollIntoViewIfNeeded();
    const stamps=card.getByTestId('calendar-stamp');await expect(stamps).toHaveCount(6);
    const pictures=await stamps.locator('img').evaluateAll(nodes=>nodes.map(n=>(n as HTMLImageElement).src));expect(new Set(pictures).size).toBe(6);
    const bounds=(await card.boundingBox())!;
    for(const stamp of await stamps.all()){
      await expect(stamp).toHaveAttribute('data-stamp-date',dateKey);
      await expect.poll(()=>stamp.locator('img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
      const box=(await stamp.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(bounds.x);expect(box.x+box.width).toBeLessThanOrEqual(bounds.x+bounds.width);expect(box.y+box.height).toBeLessThanOrEqual(bounds.y+bounds.height);
    }
    const tasks=(await card.locator('.day-card-tasks').boundingBox())!;
    for(const stamp of await stamps.all())expect((await stamp.boundingBox())!.y).toBeGreaterThan(tasks.y+tasks.height);
    await stamps.first().hover();
    const tooltip=page.getByRole('tooltip');await expect(tooltip).toBeVisible();
    const glass=await tooltip.evaluate(element=>{
      const style=getComputedStyle(element);
      return {background:style.backgroundColor,blur:style.getPropertyValue('backdrop-filter')||style.getPropertyValue('-webkit-backdrop-filter'),pointerEvents:style.pointerEvents};
    });
    expect(glass.background).toMatch(/^rgba\(.+, 0\.74\)$/);expect(glass.blur).toContain('blur(10px)');expect(glass.pointerEvents).toBe('none');
    await stamps.first().click();
    const detail=page.getByTestId('calendar-day-detail');await expect(detail.locator('.day-heading')).toContainText(`10/${Number(dateKey.slice(-2))}`);
    const full=detail.locator('.day-stamp-item');expect(await full.count()).toBeGreaterThanOrEqual(6);
    // Only October 2 has more than six distinct illustrations; later days still
    // retain every acquisition through the quantity beside each illustration.
    if(dateKey==='2026-10-02')expect(await full.count()).toBeGreaterThan(6);
    const images=await full.locator('img').evaluateAll(nodes=>nodes.map(n=>(n as HTMLImageElement).src));expect(new Set(images).size).toBe(images.length);
    const totals=new Map<string,number>();
    for(const log of logsBefore.filter((log:any)=>log.dateKey===dateKey))totals.set(log.taskId,(totals.get(log.taskId)??0)+log.durationMs);
    const expected=[...totals.values()].reduce((sum,ms)=>sum+Math.floor(ms/600000),0);
    expect(await full.evaluateAll(nodes=>nodes.filter(n=>(n as HTMLElement).dataset.stampCategory==='time').reduce((sum,n)=>sum+Number((n as HTMLElement).dataset.stampCount),0))).toBe(expected);
    await page.getByRole('button',{name:'‹ 返回日历',exact:true}).click();
  }
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('zhitu-judge-state-v1')!).focusLogs)).toEqual(logsBefore);
});
