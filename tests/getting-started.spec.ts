import {test, expect} from '@playwright/test';

test.use({viewport:{width:390,height:844}});

test('first-use guide covers the real flow, exits and is not repeated on reload',async({page})=>{
  await page.goto('/');
  const entrance=page.getByTestId('welcome-transition');
  if(await entrance.count())await page.getByRole('button',{name:'进入知途',exact:true}).click();
  const guide=page.getByTestId('getting-started');
  await expect(guide).toBeVisible();
  const titles=['把做过的小事，好好收起来','从一件想做的事开始','这会儿，只做这一件','做到了哪儿，你说了算','说一句，下次就接得上','画作和文档，也有自己的位置','翻到那一天，再看一眼','按你的习惯来'];
  for(let index=0;index<titles.length;index++){
    await expect(guide.getByRole('heading')).toHaveText(titles[index]);
    await expect(guide.getByLabel(`第 ${index+1} 步，共 8 步`)).toBeVisible();
    const box=await guide.boundingBox();expect(box!.width).toBeLessThanOrEqual(390);
    if(index<titles.length-1)await guide.getByRole('button',{name:'下一步'}).click();
  }
  await guide.getByRole('button',{name:'上一步'}).click();
  await expect(guide.getByRole('heading')).toHaveText(titles[6]);
  await guide.getByRole('button',{name:'下一步'}).click();
  await guide.getByRole('button',{name:'开始使用'}).click();
  await expect(guide).toHaveCount(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('jixiang-prototype-state-v5')!).tasks)).toHaveLength(0);
  await page.reload();await expect(guide).toHaveCount(0);
  await page.getByRole('navigation',{name:'主要导航'}).getByRole('button',{name:'我的',exact:true}).click();
  await page.getByRole('button',{name:'重看新手教程'}).click();
  await expect(guide).toBeVisible();
  await expect(page.getByTestId('bottom-sheet')).toHaveCount(0);
  await page.keyboard.press('Escape');await expect(guide).toHaveCount(0);
});

test('completed tutorial survives rename, task menu has no editor or memory prose',async({page})=>{
  await page.addInitScript(()=>{sessionStorage.setItem('jixiang-welcome-seen-v1','yes');localStorage.setItem('jixiang-getting-started-v1','yes');});
  await page.goto('/');
  await expect(page).toHaveTitle(/知途/);
  await page.getByRole('button',{name:'＋ 添加一个想做的事'}).click();
  await page.getByLabel('添加今日任务').fill('画一只小狗');
  await page.getByLabel('专注时长（分钟）').fill('1');
  await page.getByRole('button',{name:'加入路线',exact:true}).click();
  const row=page.locator('.task-row').first();
  await expect(row.locator('.task-copy em')).toHaveCount(0);
  await row.getByRole('button',{name:'更多操作：画一只小狗'}).click();
  await expect(page.getByRole('button',{name:'编辑任务',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'删除任务',exact:true})).toBeVisible();
  await page.reload();await expect(page.locator('.task-copy')).toContainText('画一只小狗');
});
