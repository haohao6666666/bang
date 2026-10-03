import {test,expect} from '@playwright/test';
import {dailyTaskTime,withRunningFocus} from '../src/dailyActivity';

test('daily time preserves legacy dates, splits midnight, and never repeats a saved fragment',()=>{
 const start=new Date('2026-10-02T23:58:00+08:00').getTime();
 const log={id:'saved',taskId:'reading',dateKey:'2026-10-02',startedAt:start,endedAt:start+5*60000,durationMs:5*60000};
 const legacy={...log,id:'legacy',dateKey:'2026-10-03',startedAt:1,endedAt:600001,durationMs:600000};
 expect(dailyTaskTime([log,log,legacy],'2026-10-03')).toBe(13*60000);
 expect(dailyTaskTime([log],'2026-10-02')).toBe(2*60000);
 const saved:typeof log[]=[];
 const live=withRunningFocus(saved,{activeTaskId:'reading',status:'running',startedAt:start},start+5*60000);
 expect(dailyTaskTime(live,'2026-10-03')).toBe(3*60000);expect(saved).toHaveLength(0);
});

test.use({timezoneId:'Asia/Shanghai'});
test('running task appears immediately and daily time stays live without completing it',async({page})=>{
  await page.setViewportSize({width:393,height:852});
  await page.clock.install({time:new Date('2026-10-03T12:00:00+08:00')});
  await page.addInitScript(()=>{sessionStorage.setItem('jixiang-welcome-seen-v1','yes');localStorage.setItem('jixiang-getting-started-v1','yes');});
  await page.goto('/');
  await page.getByRole('button',{name:'＋ 添加一个想做的事'}).click();
  await page.getByLabel('添加今日任务').fill('给小狗画耳朵');
  await page.getByRole('button',{name:'加入路线',exact:true}).click();
  await page.getByRole('button',{name:'开始投入',exact:true}).click();
  await page.clock.runFor(65000);
  await page.getByRole('navigation').getByRole('button',{name:'足迹',exact:true}).click();
  const card=page.locator('.stampbook-mobile-day-card[data-date="2026-10-03"]');
  await expect(card).toContainText('给小狗画耳朵');
  await expect(card.getByLabel('未完成',{exact:true})).toContainText('○');
  await expect(card).toContainText('1 分钟');
  await expect(card.getByTestId('calendar-stamp')).toHaveCount(0);
  await expect(page.getByLabel('任务分类时长统计')).toContainText(/1\s*分钟/);
  await card.getByRole('button',{name:'查看 2026-10-03 的记录'}).click();
  await expect(page.locator('.day-overview-task')).toContainText('给小狗画耳朵');
  await expect(page.locator('.day-overview-task')).toContainText('1 分钟');
  await page.clock.runFor(60000);
  await expect(page.locator('.day-overview-task')).toContainText('2 分钟');
  await page.getByRole('navigation').getByRole('button',{name:'今日',exact:true}).click();
  await page.getByRole('button',{name:'先停一下',exact:true}).click();
  await page.getByRole('navigation').getByRole('button',{name:'足迹',exact:true}).click();
  await expect(page.locator('.day-overview-task')).toContainText('2 分钟');
  await page.reload();
  await page.getByRole('navigation').getByRole('button',{name:'足迹',exact:true}).click();
  await expect(page.locator('.stampbook-mobile-day-card[data-date="2026-10-03"]')).toContainText('给小狗画耳朵');
  await expect(page.locator('.stampbook-mobile-day-card[data-date="2026-10-03"]')).toContainText('2 分钟');
});

test('changing pages resets scroll and long pages have no empty scroll tail',async({page})=>{
  await page.setViewportSize({width:393,height:740});
  await page.addInitScript(()=>{sessionStorage.setItem('jixiang-welcome-seen-v1','yes');localStorage.setItem('jixiang-getting-started-v1','yes');});
  await page.goto('/');
  const nav=page.getByRole('navigation');
  const scroll=page.locator('.app-screen .mobile-scroll');
  const verifyTail=async()=>{
    await scroll.evaluate(el=>{el.scrollTop=el.scrollHeight;});
    const bounds=await page.locator('.jixiang-app').evaluate(el=>{
      const last=el.querySelector('.tab-panel')!;
      return {tail:el.getBoundingClientRect().bottom-last.getBoundingClientRect().bottom,extra:el.scrollHeight-el.getBoundingClientRect().height};
    });
    expect(bounds.tail).toBeLessThanOrEqual(24);expect(bounds.extra).toBeLessThanOrEqual(2);
  };
  await nav.getByRole('button',{name:'足迹',exact:true}).click();
  await page.getByRole('tab',{name:'我的印章册',exact:true}).click();
  await verifyTail();
  await page.getByRole('tab',{name:'作品',exact:true}).click();
  expect(await scroll.evaluate(el=>el.scrollTop)).toBe(0);
  await verifyTail();
  await page.getByRole('tab',{name:'日历',exact:true}).click();await verifyTail();
  await nav.getByRole('button',{name:'今日',exact:true}).click();
  expect(await scroll.evaluate(el=>el.scrollTop)).toBe(0);await verifyTail();
});
