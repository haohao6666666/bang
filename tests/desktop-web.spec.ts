import {test,expect,type Page} from '@playwright/test';
const key='jixiang-prototype-state-v5';
test.use({timezoneId:'Asia/Shanghai'});
async function open(page:Page,width=1440) {
  await page.setViewportSize({width,height:900});
  await page.clock.install({time:new Date('2026-10-03T12:00:00+08:00')});
  await page.clock.pauseAt(new Date('2026-10-03T12:00:01+08:00'));
  await page.addInitScript(()=>{sessionStorage.setItem('jixiang-welcome-seen-v1','yes');localStorage.setItem('jixiang-getting-started-v1','yes');});
  await page.goto('/');
}
async function add(page:Page,title:string) {
  await page.getByRole('button',{name:'＋ 添加一个想做的事'}).click();
  await page.getByLabel('添加今日任务').fill(title);
  await page.getByRole('button',{name:'加入路线',exact:true}).click();
}
async function saved(page:Page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key);}
test('desktop is frameless, readable and keeps a normal keyboard',async({page})=>{
  await open(page);
  await expect(page.locator('.phone-bezel,.device-menu-bar,.status-bar,.keyboard-dock')).toHaveCount(0);
  const surface=await page.getByTestId('device-screen').boundingBox();
  expect(surface!.width).toBe(1440);expect(surface!.x).toBe(0);
  await expect(page.getByRole('button',{name:'和小芽聊聊',exact:true})).toBeVisible();
  await add(page,'画小狗的尾巴');
  const route=await page.locator('.route-card').boundingBox();
  expect(route!.width).toBeGreaterThan(500);
  await page.getByRole('button',{name:'和小芽聊聊',exact:true}).click();
  await page.getByRole('button',{name:'先只记在这里'}).click();
  await page.getByLabel('和小芽说话').fill('今天画好了耳朵');
  await expect(page.locator('.keyboard-open')).toHaveCount(0);
  const input=await page.getByLabel('和小芽说话').boundingBox();
  expect(input!.y+input!.height).toBeLessThan(900);
  await page.keyboard.press('Escape');
  await page.clock.runFor(400);
  await expect(page.getByTestId('bottom-sheet')).toHaveCount(0);
  await page.screenshot({path:'.local/desktop-today.png'});
});
test('paused tasks retain independent countdowns through switches and reload',async({page})=>{
  await open(page);await add(page,'读书');await add(page,'画画');
  await page.locator('.task-row').filter({hasText:'读书'}).locator('.task-copy strong').click();
  await page.getByRole('button',{name:'开始投入',exact:true}).click();
  await page.clock.runFor(65_000);await page.getByRole('button',{name:'先停一下',exact:true}).click();
  await page.getByRole('button',{name:'换一件事',exact:true}).click();
  await page.locator('.task-row').filter({hasText:'画画'}).locator('.task-copy strong').click();
  await page.getByRole('button',{name:'开始投入',exact:true}).click();
  await expect(page.getByLabel('本次剩余时间')).toHaveText('25:00');
  await page.clock.runFor(30_000);await page.getByRole('button',{name:'先停一下',exact:true}).click();
  await page.reload();
  await page.locator('.task-row').filter({hasText:'读书'}).locator('.task-copy strong').click();
  await page.getByRole('button',{name:'继续投入',exact:true}).click();
  await expect(page.getByLabel('本次剩余时间')).toHaveText('23:55');
  const data=await saved(page);
  const first=data.tasks.find((t:any)=>t.title==='读书'),second=data.tasks.find((t:any)=>t.title==='画画');
  expect(data.focusLogs.filter((l:any)=>l.taskId===first.id)).toHaveLength(1);
  expect(data.focusLogs.filter((l:any)=>l.taskId===second.id)).toHaveLength(1);
  expect(data.focusLedger[first.id]).toBe(65_000);expect(data.focusLedger[second.id]).toBe(30_000);
  expect(data.pausedFocus[second.id].elapsedMs).toBe(30_000);
  expect(first.status).not.toBe('completed');expect(second.status).not.toBe('completed');
});
test('calendar loads local handwriting and small artwork on desktop and phone',async({page})=>{
  await open(page);await add(page,'画小狗的尾巴');
  await page.getByRole('button',{name:'开始投入',exact:true}).click();
  await page.clock.runFor(61_000);await page.getByRole('button',{name:'先停一下',exact:true}).click();
  await page.getByRole('navigation',{name:'主要导航'}).getByRole('button',{name:'足迹',exact:true}).click();
  const card=page.locator('[data-date="2026-10-03"]');await card.scrollIntoViewIfNeeded();
  await expect(card).toContainText('画小狗的尾巴');
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:900});
    expect(await card.locator('.day-card-tasks').evaluate(el=>getComputedStyle(el).fontFamily)).toContain('Zhitu Hand');
    expect(await page.evaluate(async()=>{await document.fonts.load('20px "Zhitu Hand"','画小狗的尾巴');return document.fonts.check('20px "Zhitu Hand"','画小狗的尾巴');})).toBe(true);
    const box=await card.boundingBox();expect(box!.width).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({width:1440,height:900});
  await page.screenshot({path:'.local/desktop-calendar.png'});
  const puppy=page.getByRole('img',{name:'小芽',exact:true});
  await expect.poll(()=>puppy.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
  expect(await puppy.getAttribute('src')).toContain('/companions-web/');
  expect(await puppy.evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBeLessThanOrEqual(640);
});
