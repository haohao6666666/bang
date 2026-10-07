import {test,expect,type Page} from '@playwright/test';
const key='jixiang-prototype-state-v5';
async function open(page:Page,width=393){
 await page.setViewportSize({width,height:900});
 await page.addInitScript(()=>{sessionStorage.setItem('jixiang-welcome-seen-v1','yes');localStorage.setItem('jixiang-getting-started-v1','yes');});
 await page.goto('/');
}
async function add(page:Page,title:string,minutes=20){
 await page.getByRole('button',{name:'＋ 添加一个想做的事'}).click();await page.getByLabel('添加今日任务').fill(title);
 await page.getByRole('button',{name:`专注 ${minutes} 分钟`,exact:true}).click();await page.getByRole('button',{name:'加入路线',exact:true}).click();
}
async function saved(page:Page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key);}

test('common focus times and compact custom time both persist the chosen length',async({page})=>{
 await open(page,320);await page.getByRole('button',{name:'＋ 添加一个想做的事'}).click();
 for(const minutes of [5,10,20,30,60]){const choice=page.getByRole('button',{name:`专注 ${minutes} 分钟`,exact:true});await choice.click();await expect(choice).toHaveAttribute('aria-pressed','true');await expect(page.getByLabel('专注时长（分钟）')).toHaveValue(String(minutes));}
 const input=(await page.getByLabel('专注时长（分钟）').boundingBox())!;expect(input.width).toBeLessThan(80);
 await page.getByLabel('专注时长（分钟）').fill('17');await page.getByLabel('添加今日任务').fill('画小狗的耳朵');await page.getByRole('button',{name:'加入路线',exact:true}).click();
 expect((await saved(page)).tasks[0].planMinutes).toBe(17);await page.reload();await expect(page.locator('.task-row')).toContainText('17 分钟');
});

test('dragged card follows the pointer, settles in order and preserves completion and time',async({page})=>{
 await open(page,1366);for(const name of ['画耳朵','画尾巴','画小爪子'])await add(page,name);
 const before=await saved(page),first=page.getByRole('button',{name:'拖动排序：画耳朵',exact:true}),target=page.locator('.task-row').filter({hasText:'画小爪子'});
 const start=(await first.boundingBox())!,end=(await target.boundingBox())!;
 await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down();
 await page.mouse.move(start.x+start.width/2+24,start.y+start.height/2+40,{steps:6});
 await expect(page.locator('.task-drag-preview')).toBeVisible();
 const source=(await page.locator('.task-row.is-dragging').boundingBox())!;
 await expect.poll(async()=>Math.round((await page.locator('.task-drag-preview').boundingBox())!.y-source.y)).toBe(40);
 expect((await saved(page)).tasks.map((t:any)=>t.id)).toEqual(before.tasks.map((t:any)=>t.id));
 await page.mouse.move(end.x+end.width/2,end.y+end.height/2,{steps:12});await page.mouse.up();await expect(page.locator('.task-drag-layer')).toHaveCount(0);
 const after=await saved(page);expect(after.tasks.map((t:any)=>t.title)).toEqual(['画尾巴','画小爪子','画耳朵']);
 expect(after.focusLogs).toEqual(before.focusLogs);for(const t of before.tasks){const item=after.tasks.find((row:any)=>row.id===t.id);expect(item.status).toBe(t.status);expect(item.actualMs).toBe(t.actualMs);}
 await page.reload();expect((await saved(page)).tasks.map((t:any)=>t.title)).toEqual(['画尾巴','画小爪子','画耳朵']);
});

test('touch dragging and cancellation do not turn a task into a click',async({page,browserName})=>{
 test.skip(browserName!=='chromium','Native touch dispatch is verified through Chromium CDP.');
 await open(page);for(const name of ['读一页','画一笔'])await add(page,name);
 const before=await saved(page),handle=(await page.getByRole('button',{name:'拖动排序：读一页',exact:true}).boundingBox())!;
 const cdp=await page.context().newCDPSession(page);const x=handle.x+handle.width/2,y=handle.y+handle.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+18,y:y+36}]});
 await expect(page.locator('.task-drag-preview')).toBeVisible();
 await expect.poll(async()=>Math.round((await page.locator('.task-drag-preview').boundingBox())!.y-(await page.locator('.task-row.is-dragging').boundingBox())!.y)).toBe(36);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await expect(page.locator('.task-drag-layer')).toHaveCount(0);
 expect((await saved(page)).tasks).toEqual(before.tasks);await expect(page.locator('.focus-card')).toHaveCount(0);
});

for(const width of [320,393,412,1366])test(`artwork, date format, notebook loops and glass sheets at ${width}px`,async({page})=>{
 await open(page,width);await expect(page.locator('.app-header button[aria-label="设置"]')).toHaveCount(0);await expect(page.locator('.brand-subtitle')).toHaveText('陪伴并记录成长的AI应用');
 await expect.poll(()=>page.locator('.brand-wordmark').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
 expect(await page.locator('.bottom-nav .navigation-art').count()).toBe(3);for(const img of await page.locator('.bottom-nav .navigation-art').all())expect(await img.evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth>0)).toBe(true);
 await page.getByRole('button',{name:'进入评委演示'}).click();await expect(page.getByRole('region',{name:'三天体验演示'})).toBeVisible();await page.getByRole('navigation',{name:'主要导航'}).getByRole('button',{name:'足迹',exact:true}).click();
 const hero=(await page.locator('.stampbook-hero').boundingBox())!,art=(await page.locator('.stampbook-hero .reference-books').boundingBox())!;
 expect(art.x).toBeGreaterThan(hero.x);expect(art.x+art.width).toBeLessThan(hero.x+hero.width-5);
 const day=page.locator('[data-date="2026-10-04"]');await day.scrollIntoViewIfNeeded();await expect(day.locator('.stampbook-mobile-day-date')).toContainText('10/4');await expect(day.locator('.stampbook-mobile-day-date')).toContainText('星期日');await day.click();
 const detail=page.getByTestId('calendar-day-detail');await expect(detail).toBeVisible();
 await expect.poll(()=>detail.evaluate(el=>el.querySelectorAll('.notebook-binding-loop').length===Math.max(0,Math.floor(((el as HTMLElement).clientHeight-80-40-26)/112)+1))).toBe(true);
 const loops=detail.locator('.notebook-binding-loop');expect(await loops.count()).toBeGreaterThan(6);
 const ring=(await loops.first().boundingBox())!,paper=(await detail.boundingBox())!;expect(ring.width).toBe(width<360?34:40);expect(ring.height).toBe(26);expect(ring.x).toBeGreaterThanOrEqual(0);expect(ring.x).toBeLessThan(paper.x);expect(ring.x+ring.width).toBeGreaterThan(paper.x+15);
 const positions=await loops.evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().top));for(let i=1;i<positions.length;i++)expect(positions[i]-positions[i-1]).toBeCloseTo(112,0);
 const sections=await detail.locator(':scope > section').evaluateAll(nodes=>nodes.map(n=>n.className));expect(sections.slice(0,3)).toEqual(['day-recap','day-overview-tasks','day-earned-stamps']);
 await page.getByRole('navigation',{name:'主要导航'}).getByRole('button',{name:'我的',exact:true}).click();const sheet=page.locator('.product-sheet');await expect(sheet).toBeVisible();
 const glass=await sheet.evaluate(el=>{const s=getComputedStyle(el);return {filter:s.backdropFilter||(s as any).webkitBackdropFilter,radius:parseFloat(s.borderTopLeftRadius),color:s.color};});expect(glass.filter).toContain('blur');expect(glass.radius).toBeGreaterThanOrEqual(28);
 await page.getByRole('button',{name:'关闭设置'}).click();await expect(sheet).toHaveCount(0);await page.getByRole('button',{name:'和小芽聊聊',exact:true}).click();await expect(page.locator('.product-sheet.is-chat-sheet')).toBeVisible();await page.getByRole('button',{name:'收起小芽聊天'}).click();await expect(sheet).toHaveCount(0);
});
