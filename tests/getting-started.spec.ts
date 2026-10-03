import {test,expect} from '@playwright/test';
test.use({viewport:{width:390,height:844}});

test('spotlight guide follows real controls across task, chat, work, day and settings',async({page})=>{

  await page.route('**/api/ai/companion',route=>route.fulfill({json:{items:[],forgotten:[],pendingIds:[],syncedAt:Date.now()}}));
  await page.goto('/');await page.getByRole('button',{name:'进入知途',exact:true}).click();const guide=page.getByTestId('getting-started');
  const step=async(id:string)=>{await expect(guide).toHaveAttribute('data-step',id);const b=await guide.locator('.tour-tip').boundingBox();expect(b!.y).toBeGreaterThanOrEqual(0);expect(b!.y+b!.height).toBeLessThanOrEqual(845);};
  const next=async(id:string)=>{await step(id);await guide.getByRole('button',{name:'下一步',exact:true}).click();};
  await next('welcome');await step('add');await page.locator('.add-task-button').click();
  await step('form');await page.getByLabel('添加今日任务').fill('画一只小狗');await page.getByLabel('专注时长（分钟）').fill('17');await page.getByRole('button',{name:'加入路线',exact:true}).click();
  await step('start');await page.getByRole('button',{name:'开始投入',exact:true}).click();await next('timer');
  await step('pause');await page.getByRole('button',{name:'先停一下'}).click();await step('resume');await page.getByRole('button',{name:'继续投入'}).click();await step('end');await page.getByRole('button',{name:'结束',exact:true}).click();
  await step('done');await page.getByRole('button',{name:'这件事做完了'}).click();await step('chat');await page.locator('.companion-invite').click();
  await step('memory');await page.getByRole('button',{name:'先只记在这里'}).click();await next('memory');
  await step('message');await page.getByLabel('和小芽说话').fill('耳朵画好了，尾巴下次画。');await page.getByRole('button',{name:'留下',exact:true}).click();
  await step('upload');await page.locator('.chat-compose-actions input[type=file]').setInputFiles({name:'小狗草稿.txt',mimeType:'text/plain',buffer:Buffer.from('耳朵是圆圆的，下一次画尾巴。')});await next('reading');
  await step('save-work');await page.getByRole('button',{name:'留下',exact:true}).click();await step('close-chat');await page.getByLabel('收起小芽聊天').click();
  await step('footprints');await page.getByRole('navigation',{name:'主要导航'}).getByRole('button',{name:'足迹',exact:true}).click();await next('time');
  await step('calendar');await page.locator('.stampbook-mobile-day-card.is-today .stampbook-mobile-day-date').click();await next('day');await step('back');await page.locator('.day-toolbar button').first().click();
  await step('works');await page.locator('[data-tour=view-works]').click();await expect(page.locator('.works-gallery .work-card')).toHaveCount(1);await next('work-gallery');
  await step('collection');await page.locator('[data-tour=view-collection]').click();await next('stamps');await step('my');await page.getByRole('navigation',{name:'主要导航'}).getByRole('button',{name:'我的',exact:true}).click();await next('preferences');
  await step('export');await guide.getByRole('button',{name:'跳过这步'}).click();await step('finish');await guide.getByRole('button',{name:'开始用知途'}).click();await expect(guide).toHaveCount(0);
  await page.reload();await expect(guide).toHaveCount(0);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('jixiang-prototype-state-v5')!).tasks[0].status)).toBe('completed');
  await page.getByRole('navigation',{name:'主要导航'}).getByRole('button',{name:'我的',exact:true}).click();await page.getByRole('button',{name:'重看新手教程'}).click();await expect(guide).toBeVisible();await page.keyboard.press('Escape');await expect(guide).toHaveCount(0);
});

test('closing first-use guide does not fabricate records and existing users are not forced through it',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'进入知途',exact:true}).click();await page.getByLabel('结束新手引导').click();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('jixiang-prototype-state-v5')!).tasks)).toHaveLength(0);await page.reload();await expect(page.getByTestId('getting-started')).toHaveCount(0);
 await page.getByRole('button',{name:'＋ 添加一个想做的事'}).click();await page.getByLabel('添加今日任务').fill('读一页书');await page.getByRole('button',{name:'加入路线',exact:true}).click();
 const row=page.locator('.task-row').first();await expect(row.locator('.task-copy em')).toHaveCount(0);await row.getByRole('button',{name:'更多操作：读一页书'}).click();await expect(page.getByRole('button',{name:'编辑任务',exact:true})).toHaveCount(0);
});

test('tutorial link reopens a skipped guide without changing saved tasks',async({page})=>{
 await page.addInitScript(()=>{sessionStorage.setItem('jixiang-welcome-seen-v1','yes');localStorage.setItem('jixiang-getting-started-v1','yes');});
 await page.goto('/');
 await page.getByRole('button',{name:'＋ 添加一个想做的事'}).click();await page.getByLabel('添加今日任务').fill('读一页书');await page.getByRole('button',{name:'加入路线',exact:true}).click();
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('jixiang-prototype-state-v5')!));
 await page.goto('/?tutorial=1');
 await expect(page.getByTestId('getting-started')).toBeVisible();
 expect(new URL(page.url()).searchParams.has('tutorial')).toBe(false);
 await page.getByLabel('结束新手引导').click();
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('jixiang-prototype-state-v5')!));
 expect(after.tasks).toEqual(before.tasks);expect(after.focusLogs).toEqual(before.focusLogs);expect(after.outcomes).toEqual(before.outcomes);
 await page.reload();await expect(page.getByTestId('getting-started')).toHaveCount(0);
});

