import {test,expect} from '@playwright/test';

test('phone: custom focus, pause without form, native input, saved work and three tabs',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>sessionStorage.setItem('jixiang-welcome-seen-v1','yes'));
 await page.goto('/');
 await expect(page.getByRole('navigation',{name:'主要导航'}).getByRole('button')).toHaveCount(3);
 await page.getByRole('button',{name:'＋ 添加一个想做的事'}).click();
 await page.getByLabel('添加今日任务').fill('画一只小狗');
 await expect(page.getByTestId('keyboard-dock')).toHaveCount(0);
 await page.getByLabel('专注时长（分钟）').fill('17');
 await page.getByRole('button',{name:'加入路线',exact:true}).click();
 await expect(page.locator('.task-copy')).toContainText('17 分钟');
 await page.getByRole('button',{name:'开始投入',exact:true}).click();
 await page.getByRole('button',{name:'先停一下'}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'结束',exact:true}).click();
 await expect(page.locator('.quiet-badge').first()).toContainText('0 / 1');
 await page.getByRole('button',{name:'留下作品',exact:true}).click();
 await page.getByRole('button',{name:'先只记在这里'}).click();
 await page.getByLabel('和小芽说话').fill('今天画到耳朵，下次继续。');
 await page.locator('input[type=file]').setInputFiles({name:'作品.txt',mimeType:'text/plain',buffer:Buffer.from('我的小狗草稿')});
 await page.getByRole('button',{name:'留下',exact:true}).click();
 await expect(page.locator('.chat-user')).toContainText('今天画到耳朵');
 await page.reload();
 await expect(page.locator('.task-copy')).not.toContainText('今天画到耳朵');
 await expect(page.locator('.companion-invite')).toContainText('今天画到耳朵');
 await page.getByRole('navigation',{name:'主要导航'}).getByRole('button',{name:'足迹'}).click();
 await page.getByRole('tab',{name:'作品',exact:true}).click();
 await expect(page.locator('.work-card')).toContainText('作品.txt');
 await expect(page.locator('.work-card')).toContainText('今天画到耳朵');
 await page.screenshot({path:'test-results/companion-phone.png',fullPage:true});
});

test('background chat arrives without a generate button and leaves plans unchanged',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>sessionStorage.setItem('jixiang-welcome-seen-v1','yes'));
 await page.route('**/api/ai/companion',async route=>{const body=route.request().postDataJSON();const e=body.events?.at(-1);await route.fulfill({json:{items:e?[{id:e.id,taskId:e.taskId,dateKey:e.dateKey,reply:'那就把耳朵留给下次。',progress:'耳朵还没画完',recap:''}]:[]}});});
 await page.goto('/');await page.getByRole('button',{name:'＋ 添加一个想做的事'}).click();await page.getByLabel('添加今日任务').fill('画画');await page.getByRole('button',{name:'加入路线',exact:true}).click();
 await page.getByRole('button',{name:'留下作品',exact:true}).click();await page.getByRole('button',{name:'好呀',exact:true}).click();await page.getByLabel('和小芽说话').fill('画了小狗，耳朵没画完');await page.getByRole('button',{name:'留下',exact:true}).click();
 await expect(page.locator('.chat-puppy')).toHaveText('那就把耳朵留给下次。');
 const tasks=await page.evaluate(()=>JSON.parse(localStorage.getItem('jixiang-prototype-state-v5')!).tasks);expect(tasks).toHaveLength(1);expect(tasks[0].status).toBe('ready');
});

test('a second message sent while waiting does not discard the first reply',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>sessionStorage.setItem('jixiang-welcome-seen-v1','yes'));
 let release:()=>void=()=>{};const held=new Promise<void>(resolve=>release=resolve);let firstStarted=false;let firstDone=false;
 const items:any[]=[];
 await page.route('**/api/ai/companion',async route=>{
  const body=route.request().postDataJSON();const e=body.events?.at(-1);
  if(e?.text==='第一句话'&&!firstDone){firstStarted=true;await held;firstDone=true;items.push({id:e.id,taskId:e.taskId,dateKey:e.dateKey,reply:'第一句接住啦，汪。',progress:'',recap:''});}
  if(e?.text==='第二句话'&&!items.some(i=>i.id===e.id))items.push({id:e.id,taskId:e.taskId,dateKey:e.dateKey,reply:'第二句也听到啦，汪～',progress:'',recap:''});
  await route.fulfill({json:{items}});
 });
 await page.goto('/');await page.getByRole('button',{name:'＋ 添加一个想做的事'}).click();await page.getByLabel('添加今日任务').fill('画画');await page.getByRole('button',{name:'加入路线',exact:true}).click();
 await page.getByRole('button',{name:'留下作品',exact:true}).click();await page.getByRole('button',{name:'好呀',exact:true}).click();
 await page.getByLabel('和小芽说话').fill('第一句话');await page.getByRole('button',{name:'留下',exact:true}).click();await expect.poll(()=>firstStarted).toBe(true);
 await page.getByLabel('和小芽说话').fill('第二句话');await page.getByRole('button',{name:'留下',exact:true}).click();release();
 await expect(page.locator('.chat-puppy')).toHaveCount(2);await expect(page.locator('.chat-puppy')).toContainText(['第一句接住啦','第二句也听到啦']);
 await page.reload();await page.getByRole('button',{name:'留下作品',exact:true}).click();await expect(page.locator('.chat-puppy')).toHaveCount(2);
});

test('a failed fetch retries automatically without losing the saved message',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.addInitScript(()=>sessionStorage.setItem('jixiang-welcome-seen-v1','yes'));
 let failed=false;
 await page.route('**/api/ai/companion',async route=>{const body=route.request().postDataJSON();const e=body.events?.at(-1);if(e&&!failed){failed=true;await route.abort('failed');return;}await route.fulfill({json:{items:e?[{id:e.id,taskId:e.taskId,dateKey:e.dateKey,reply:'汪，我回来啦。尾巴下次接着画。',progress:'尾巴待画',recap:''}]:[]}});});
 await page.goto('/');await page.getByRole('button',{name:'＋ 添加一个想做的事'}).click();await page.getByLabel('添加今日任务').fill('画画');await page.getByRole('button',{name:'加入路线',exact:true}).click();
 await page.getByRole('button',{name:'留下作品',exact:true}).click();await page.getByRole('button',{name:'好呀',exact:true}).click();await page.getByLabel('和小芽说话').fill('尾巴下次再画');await page.getByRole('button',{name:'留下',exact:true}).click();
 await expect(page.locator('.chat-puppy')).toContainText('汪，我回来啦');await expect(page.locator('.chat-user')).toContainText('尾巴下次再画');
});

test('focus stops at the chosen duration without completing the task; deferral persists',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.clock.install({time:new Date('2026-10-03T12:00:00+08:00')});
 await page.addInitScript(()=>sessionStorage.setItem('jixiang-welcome-seen-v1','yes'));
 await page.goto('/');await page.getByRole('button',{name:'＋ 添加一个想做的事'}).click();await page.getByLabel('添加今日任务').fill('画画');await page.getByLabel('专注时长（分钟）').fill('1');await page.getByRole('button',{name:'加入路线',exact:true}).click();
 await page.getByRole('button',{name:'开始投入',exact:true}).click();await page.clock.runFor(61000);
 await expect(page.locator('.focus-card')).toHaveAttribute('data-focus-status','paused');
 await expect(page.getByLabel('本次剩余时间')).toHaveText('00:00');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('jixiang-prototype-state-v5')!).focusLogs[0]?.durationMs)).toBe(60000);let state=await page.evaluate(()=>JSON.parse(localStorage.getItem('jixiang-prototype-state-v5')!));expect(state.tasks[0].status).not.toBe('completed');
 await page.getByRole('button',{name:'结束',exact:true}).click();await page.getByRole('button',{name:'明天再做',exact:true}).click();await page.reload();
 await expect(page.locator('.route-list .task-row')).toHaveCount(0);await page.getByText('留到以后',{exact:true}).click();await expect(page.locator('.deferred-tasks')).toContainText('画画');await page.getByRole('button',{name:'今天做',exact:true}).click();await expect(page.locator('.route-list .task-row')).toHaveCount(1);
});
