import {test,expect,type Page} from '@playwright/test';
import {DEMO_WORK_COUNT} from '../src/judgeDemo';
const key='jixiang-prototype-state-v5';
async function open(page:Page){
  await page.setViewportSize({width:1440,height:900});
  await page.addInitScript(()=>{sessionStorage.setItem('jixiang-welcome-seen-v1','yes');localStorage.setItem('jixiang-getting-started-v1','yes');});
  await page.goto('/');
}
async function add(page:Page){await page.getByRole('button',{name:'＋ 添加一个想做的事'}).click();await page.getByLabel('添加今日任务').fill('我的真实任务');await page.getByRole('button',{name:'加入路线',exact:true}).click();}
test('judge demo keeps personal data and server memory separate, including after reload',async({page})=>{
  await open(page);await add(page);
  const original=await page.evaluate(key=>localStorage.getItem(key),key);
  let calls=0;await page.route('**/api/ai/companion',async route=>{calls++;await route.fulfill({json:{items:[]}});});
  await page.getByRole('button',{name:'进入评委演示'}).click();
  await expect(page.getByLabel('三天体验演示')).toBeVisible();
  await expect(page.getByLabel('三天体验演示')).toContainText('模拟记录');
  for(const day of ['10 月 2 日','10 月 3 日','10 月 4 日'])await page.getByRole('button').filter({has:page.getByText(day,{exact:true})}).click();
  await page.getByRole('button',{name:'问小芽上次做到哪'}).click();
  await page.getByLabel('和小芽说话').fill('上次小车做到哪了？');
  await page.getByRole('button',{name:'留下',exact:true}).click();
  await expect(page.locator('.chat-puppy').last()).toContainText('配合');
  await page.keyboard.press('Escape');await page.reload();
  await expect(page.getByLabel('三天体验演示')).toBeVisible();
  await page.getByRole('button',{name:'退出演示',exact:true}).click();
  await expect(page.getByLabel('三天体验演示')).toHaveCount(0);
  await expect(page.locator('.route-card')).toContainText('我的真实任务');
  const restored=JSON.parse((await page.evaluate(key=>localStorage.getItem(key),key))!);
  const before=JSON.parse(original!);
  for(const field of ['tasks','focusLogs','focusLedger','outcomes','diaries','notes'])expect(restored[field]).toEqual(before[field]);
  expect(calls).toBe(0);
});
test('supplied and generated works and documents open again after refresh in judge mode',async({page})=>{
  await open(page);await page.getByRole('button',{name:'进入评委演示'}).click();
  await page.getByRole('button',{name:'看看作品',exact:true}).click();await page.reload();
  await page.getByRole('button',{name:'看看作品',exact:true}).click();
  await expect(page.locator('.work-card')).toHaveCount(DEMO_WORK_COUNT);
  for(const img of await page.locator('.work-card .work-image').all())await expect.poll(()=>img.evaluate((e:HTMLImageElement)=>e.complete&&e.naturalWidth>0)).toBe(true);
  await page.getByRole('button',{name:'查看作品：三天实验手记.txt',exact:true}).click();
  await expect(page.getByTestId('work-file-preview')).toContainText('10月3日');
  await expect(page.getByRole('link',{name:'保存原文件'})).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'查看作品：小车装配记录.webp',exact:true}).click();
  await expect(page.getByTestId('work-file-preview').getByRole('img')).toBeVisible();
  const box=await page.getByTestId('work-file-preview').getByRole('img').boundingBox();expect(box!.width).toBeLessThan(700);
  await page.keyboard.press('Escape');await page.setViewportSize({width:390,height:844});
  await page.getByRole('navigation',{name:'主要导航'}).getByRole('button',{name:'今日',exact:true}).click();
  await page.getByRole('button',{name:'看看这一天',exact:true}).click();
  await expect(page.getByTestId('calendar-day-detail')).toBeVisible();
  await page.screenshot({path:'.local/judge-mobile.png',fullPage:true});
});
test('ordinary uploads preserve photo and original document bytes after reload',async({page})=>{
  await open(page);await add(page);
  await page.getByRole('button',{name:'留下作品',exact:true}).click();await page.getByRole('button',{name:'先只记在这里'}).click();
  await page.locator('input[type=file]').setInputFiles('public/assets/judge-demo/great-wall.webp');await page.getByRole('button',{name:'留下',exact:true}).click();
  await expect(page.locator('.chat-user')).toHaveCount(1);
  await page.locator('input[type=file]').setInputFiles({name:'我的手记.txt',mimeType:'text/plain',buffer:Buffer.from('昨天画了第一版，今天把颜色改好了。')});
  await page.getByRole('button',{name:'留下',exact:true}).click();await expect(page.locator('.chat-user')).toHaveCount(2);
  await page.reload();await page.getByRole('navigation',{name:'主要导航'}).getByRole('button',{name:'足迹',exact:true}).click();await page.getByRole('tab',{name:'作品',exact:true}).click();
  const picture=page.locator('.work-card .work-image');await expect.poll(()=>picture.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
  await page.getByRole('button',{name:'查看作品：我的手记.txt',exact:true}).click();await expect(page.getByTestId('work-file-preview')).toContainText('把颜色改好了');
  const pending=page.waitForEvent('download');await page.getByRole('link',{name:'保存原文件'}).click();const download=await pending;expect(download.suggestedFilename()).toBe('我的手记.txt');
});
test('legacy File records upgrade without losing attachments',async({page,browserName})=>{
  test.skip(browserName==='webkit','Windows WebKit cannot seed legacy structured-cloned File records; byte-based attachments are tested separately.');
  await page.goto('/tests/runtime-fixture.html');
  await page.evaluate(async()=>{
    sessionStorage.setItem('jixiang-welcome-seen-v1','yes');localStorage.setItem('jixiang-getting-started-v1','yes');
    await new Promise<void>((resolve,reject)=>{const request=indexedDB.open('jixiang-companion',1);request.onupgradeneeded=()=>request.result.createObjectStore('journal');request.onsuccess=()=>{const db=request.result;const tx=db.transaction('journal','readwrite');tx.objectStore('journal').put({entries:[{id:'legacy-work',taskId:'old',title:'旧作品',dateKey:'2026-10-02',kind:'work',text:'从旧版本留下的',file:new File(['旧版原件仍在这里'],'旧手记.txt',{type:'text/plain'})}],items:[],enabled:false,introduced:true,proactive:false},'current');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);};request.onerror=()=>reject(request.error);});
  });
  await page.goto('/');await page.getByRole('navigation',{name:'主要导航'}).getByRole('button',{name:'足迹',exact:true}).click();await page.getByRole('tab',{name:'作品',exact:true}).click();
  await page.getByRole('button',{name:'查看作品：旧手记.txt',exact:true}).click();await expect(page.getByTestId('work-file-preview')).toContainText('旧版原件仍在这里');
});



test('version-one journal upgrades while retaining personal notes',async({page})=>{
  await page.goto('/tests/runtime-fixture.html');
  await page.evaluate(async()=>{
    sessionStorage.setItem('jixiang-welcome-seen-v1','yes');localStorage.setItem('jixiang-getting-started-v1','yes');
    await new Promise<void>((resolve,reject)=>{
      const request=indexedDB.open('jixiang-companion',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('journal');
      request.onsuccess=()=>{const db=request.result;const tx=db.transaction('journal','readwrite');
        tx.objectStore('journal').put({entries:[{id:'legacy-note',taskId:'old',title:'旧作品说明',dateKey:'2026-10-02',kind:'work',text:'我上次把耳朵画好了。'}],items:[],enabled:false,introduced:true,proactive:false},'current');
        tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      };request.onerror=()=>reject(request.error);
    });
  });
  await page.goto('/');await page.getByRole('navigation',{name:'主要导航'}).getByRole('button',{name:'足迹',exact:true}).click();await page.getByRole('tab',{name:'作品',exact:true}).click();
  await expect(page.locator('.work-card')).toContainText('我上次把耳朵画好了。');await page.reload();
  await page.getByRole('navigation',{name:'主要导航'}).getByRole('button',{name:'足迹',exact:true}).click();await page.getByRole('tab',{name:'作品',exact:true}).click();
  await expect(page.locator('.work-card')).toContainText('我上次把耳朵画好了。');
});


test('expanded demo keeps daily membership, status and remembered progress within the selected day',async({page})=>{
  await open(page);await page.getByRole('button',{name:'进入评委演示'}).click();
  await expect(page.getByLabel('演示记录概览')).toContainText('18');
  await expect(page.getByLabel('演示记录概览')).toContainText('11');
  for(const [day,count] of [['10 月 2 日',11],['10 月 3 日',12],['10 月 4 日',12]] as const){
    await page.getByLabel('三天体验演示').getByRole('button').filter({has:page.getByText(day,{exact:true})}).click();
    await expect(page.locator('.route-list .task-row')).toHaveCount(count);
    await page.getByRole('button',{name:'看看这一天',exact:true}).click();
    await expect(page.locator('.day-overview-task')).toHaveCount(count);
    await expect(page.locator('.day-recap p')).toHaveCount(1);
    const sky=page.locator('.day-overview-task').filter({hasText:'找找今晚的北斗七星'});
    if(day==='10 月 4 日')await expect(sky.locator('b')).toHaveText('×');else await expect(sky).toHaveCount(0);
    await page.getByRole('navigation',{name:'主要导航'}).getByRole('button',{name:'今日',exact:true}).click();
  }
  await page.getByLabel('三天体验演示').getByRole('button').filter({has:page.getByText('10 月 2 日',{exact:true})}).click();
  await page.getByRole('button',{name:'问小芽上次做到哪'}).click();
  await expect(page.locator('.chat-history')).not.toContainText('重新看了装配');
  await page.getByLabel('和小芽说话').fill('你记得小狗画到哪了吗？');await page.getByRole('button',{name:'留下',exact:true}).click();
  await expect(page.locator('.chat-puppy').last()).toContainText('草稿');
  await expect(page.locator('.chat-puppy').last()).not.toContainText('颜色');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'看看作品',exact:true}).click();
  const compare=page.locator('.work-comparison').filter({hasText:'给小狗画一条弯弯的尾巴'});
  await compare.locator('summary').click();await expect(compare.locator('figure')).toHaveCount(2);
  await expect(compare).toContainText('2026-10-02');await expect(compare).toContainText('2026-10-04');
  await expect(page.locator('.work-card').filter({hasText:'生成素材'})).toHaveCount(4);
});

test('existing active demonstration upgrades without touching personal data',async({page})=>{
  await page.addInitScript(()=>{
    sessionStorage.setItem('zhitu-judge-active','yes');localStorage.setItem('zhitu-judge-release','1');
    localStorage.setItem('jixiang-prototype-state-v5',JSON.stringify({version:5,tasks:[],focusLogs:[],outcomes:[],notes:[],diaries:[]}));
  });
  await open(page);await expect(page.getByLabel('演示记录概览')).toContainText('18');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhitu-judge-state-v1')!).tasks.length)).toBe(18);
  const personal=await page.evaluate(()=>JSON.parse(localStorage.getItem('jixiang-prototype-state-v5')!));expect(personal.tasks).toEqual([]);
  await page.getByRole('button',{name:'看看作品',exact:true}).click();await expect(page.locator('.work-card')).toHaveCount(DEMO_WORK_COUNT);
});
