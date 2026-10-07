import {test,expect,type Page,type Locator} from '@playwright/test';

const huawei='Mozilla/5.0 (Linux; Android 12; HarmonyOS; HUAWEI NOH-AN00) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.196 Mobile Safari/537.36 MicroMessenger/8.0.56 NetType/WIFI Language/zh_CN';
const android='Mozilla/5.0 (Linux; Android 14; SM-S9180) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36';
const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const longTitle='给小狗慢慢画好耳朵尾巴和背景，再写下今天最想保留的发现';
const longEnglish='ExploreTheStoryOfTheLittlePuppyAndKeepTheNextStepInMyNotebook';
test.use({timezoneId:'Asia/Shanghai'});
async function open(page:Page){
 await page.clock.install({time:new Date('2026-10-04T12:00:00+08:00')});
 await page.addInitScript(()=>{sessionStorage.setItem('jixiang-welcome-seen-v1','yes');localStorage.setItem('jixiang-getting-started-v1','yes');});
 await page.goto('/');await expect(page.getByRole('navigation',{name:'主要导航'})).toBeVisible();
}
async function add(page:Page,title:string){
 await page.getByRole('button',{name:'＋ 添加一个想做的事'}).click();await page.getByLabel('添加今日任务').fill(title);await page.getByRole('button',{name:'加入路线',exact:true}).click();
}
async function fits(page:Page,locator:Locator){
 const scope=(await page.locator('.app-screen').boundingBox())!;
 for(const item of await locator.all()){
  const box=(await item.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(scope.x-1);expect(box.x+box.width).toBeLessThanOrEqual(scope.x+scope.width+1);
 }
}

for(const profile of [
 {name:'Huawei WeChat narrow',width:320,ua:huawei,touch:true},
 {name:'Huawei HarmonyOS WeChat',width:393,ua:huawei,touch:true},
 {name:'Android Chrome',width:412,ua:android,touch:true},
 {name:'iPhone layout regression',width:390,ua:iphone,touch:true},
 {name:'compact computer',width:1000,ua:undefined,touch:false},
 {name:'wide computer',width:1440,ua:undefined,touch:false},
])test(`${profile.name}: task controls, long content, calendar and sheets stay within their own surface`,async({browser})=>{
 const context=await browser.newContext({viewport:{width:profile.width,height:900},userAgent:profile.ua,hasTouch:profile.touch,timezoneId:'Asia/Shanghai'});
 const page=await context.newPage();
 try{
  await open(page);await add(page,longTitle);await add(page,longEnglish);
  await fits(page,page.locator('.task-row,.task-copy strong,.task-more-button'));
  const row=page.locator('.task-row').filter({hasText:longTitle}),button=row.getByRole('button',{name:'更多操作：'+longTitle});
  // Different Android system fonts/text scaling must not resize the dots.
  await button.evaluate(el=>{el.style.fontFamily='serif';el.style.fontSize='32px';});
  const graphic=(await button.locator('svg').boundingBox())!,control=(await button.boundingBox())!;
  expect(control.width).toBeGreaterThanOrEqual(40);expect(graphic.width).toBe(20);
  expect(graphic.x).toBeGreaterThan(control.x);expect(graphic.x+graphic.width).toBeLessThan(control.x+control.width);
  await button.click();await fits(page,row.locator('.task-actions-menu'));
  await page.locator('.route-card h2').click();await expect(row.locator('.task-actions-menu')).toHaveCount(0);
  await row.locator('.task-copy strong').click();await page.getByRole('button',{name:'开始投入',exact:true}).click();
  await page.clock.runFor(3000);await fits(page,page.locator('.focus-card,.focus-timer-ring'));
  await page.getByRole('button',{name:'先停一下',exact:true}).click();await page.getByRole('button',{name:'换一件事',exact:true}).click();
  if(!profile.touch){
   const taskBox=(await page.locator('.route-card').boundingBox())!,side=(await page.locator('.today-sidebar').boundingBox())!;
   expect(Math.abs(taskBox.y-side.y)).toBeLessThan(2);expect(side.x).toBeGreaterThan(taskBox.x+taskBox.width);
  }
  await page.getByRole('button',{name:'留下作品',exact:true}).click();await page.getByRole('button',{name:'先只记在这里'}).click();
  await page.locator('input[type=file]').setInputFiles({name:longEnglish+'.txt',mimeType:'text/plain',buffer:Buffer.from('耳朵画好了，下次接着画尾巴。')});
  await page.getByRole('button',{name:'留下',exact:true}).click();await expect(page.locator('.chat-user')).toHaveCount(1);
  await page.keyboard.press('Escape');await page.clock.runFor(450);
  await page.getByRole('navigation',{name:'主要导航'}).getByRole('button',{name:'足迹',exact:true}).click();
  const day=page.getByRole('button',{name:'查看 2026-10-04 的记录'});await day.scrollIntoViewIfNeeded();await day.click();await page.clock.runFor(450);
  await fits(page,page.locator('.day-overview-task,.activity-distribution,.activity-distribution-overview,.activity-ring,.activity-distribution-story'));
  await page.getByRole('button',{name:'‹ 返回日历',exact:true}).click();
  await page.getByRole('tab',{name:'作品',exact:true}).click();await fits(page,page.locator('.work-card,.work-card header strong,.document-file'));
  await page.getByRole('button',{name:'查看作品：'+longEnglish+'.txt',exact:true}).click();await page.clock.runFor(600);
  await expect(page.getByTestId('work-file-preview')).toContainText('耳朵画好了');
  await expect(page.locator('.product-sheet')).toBeVisible();
  await page.getByRole('button',{name:'关闭'+longEnglish+'.txt',exact:true}).click();await page.clock.runFor(450);await expect(page.getByTestId('bottom-sheet')).toHaveCount(0);
  await page.getByRole('tab',{name:'我的印章册',exact:true}).click();await fits(page,page.locator('.stamp-collection-card,.stamp-collection-category-tabs'));
  await page.getByRole('navigation',{name:'主要导航'}).getByRole('button',{name:'我的',exact:true}).click();await page.clock.runFor(600);
  await page.getByRole('button',{name:'关闭设置'}).click();await page.clock.runFor(850);await expect(page.getByTestId('bottom-sheet')).toHaveCount(0);
 }finally{await context.close();}
});

for(const [name,ua] of [['Android Chrome',android],['HarmonyOS WeChat',huawei]])test(`${name}: keyboard resizing and rotating preserve chat and the underlying page`,async({browser})=>{
 const context=await browser.newContext({viewport:{width:393,height:850},userAgent:ua,hasTouch:true,timezoneId:'Asia/Shanghai'});
 const page=await context.newPage();
 try{
  await page.addInitScript(()=>{
   sessionStorage.setItem('jixiang-welcome-seen-v1','yes');localStorage.setItem('jixiang-getting-started-v1','yes');
   const viewport=Object.assign(new EventTarget(),{height:850,width:393,offsetTop:0,scale:1});
   Object.defineProperty(window,'visualViewport',{configurable:true,value:viewport});
   (window as any).changeViewport=(height:number,width=393)=>{viewport.height=height;viewport.width=width;viewport.dispatchEvent(new Event('resize'));};
  });
  await page.goto('/');await page.getByRole('button',{name:'和小芽聊聊',exact:true}).click();await page.getByRole('button',{name:'先只记在这里'}).click();
  await expect(page.locator('.bottom-sheet.is-chat-sheet')).toBeVisible();
  const input=page.getByLabel('和小芽说话');await input.fill('尾巴留到下次慢慢画。');
  await page.setViewportSize({width:393,height:500});await page.evaluate(()=>(window as any).changeViewport(500));
  await expect.poll(()=>page.locator('.phone-stage').evaluate(e=>Math.round(e.getBoundingClientRect().height))).toBe(850);
  await expect.poll(async()=>{const r=(await input.boundingBox())!;return r.y>=0&&r.y+r.height<=500;}).toBe(true);
  await page.getByRole('button',{name:'收起小芽聊天'}).click();await page.setViewportSize({width:393,height:850});await page.evaluate(()=>(window as any).changeViewport(850));
  await expect(page.getByTestId('bottom-sheet')).toHaveCount(0);
  await expect.poll(()=>page.locator('.phone-stage').evaluate(e=>Math.round(e.getBoundingClientRect().top))).toBe(0);
  await page.getByRole('button',{name:'和小芽聊聊',exact:true}).click();await input.fill('旋转之后也能接着聊。');
  await page.setViewportSize({width:850,height:393});await page.evaluate(()=>(window as any).changeViewport(393,850));
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.nativeKeyboard)).toBe('closed');
  await expect.poll(async()=>{const box=(await page.getByTestId('bottom-sheet').boundingBox())!;return box.y>=0&&box.y+box.height<=394;}).toBe(true);
  await page.keyboard.press('Escape');await expect(page.getByTestId('bottom-sheet')).toHaveCount(0);
  expect(await page.evaluate(()=>window.scrollY)).toBe(0);
 }finally{await context.close();}
});
