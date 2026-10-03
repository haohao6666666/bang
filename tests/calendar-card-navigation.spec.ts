import {test,expect} from '@playwright/test';

test.use({timezoneId:'Asia/Shanghai',viewport:{width:390,height:844}});
async function recordedCalendar(page:import('@playwright/test').Page){
 await page.clock.install({time:new Date('2026-10-03T12:00:00+08:00')});
 await page.addInitScript(()=>{
   sessionStorage.setItem('jixiang-welcome-seen-v1','yes');localStorage.setItem('jixiang-getting-started-v1','yes');
   const tasks=['今天画小狗','昨天读一页书'].map((title,index)=>({id:`task-${index}`,title,subject:'阅读',duration:'25 分钟',planMinutes:25,actualMs:600000,status:'ready',kind:'reading',color:'sage',expectedArtifact:'',revisionCount:0}));
   const focusLogs=tasks.map((task,index)=>{const dateKey=index===0?'2026-10-03':'2026-10-02';const startedAt=new Date(`${dateKey}T10:00:00+08:00`).getTime();return {id:`focus-${index}`,taskId:task.id,dateKey,startedAt,endedAt:startedAt+600000,durationMs:600000};});
   localStorage.setItem('jixiang-prototype-state-v5',JSON.stringify({version:5,tasks,focusLogs,focusSession:{activeTaskId:null,status:'idle',startedAt:null},focusLedger:{'task-0':600000,'task-1':600000},preferences:{reduceMotion:true},stampStyles:{},stampBook:{version:5,styleAssignments:{}}}));
 });
 await page.goto('/');await page.getByRole('navigation').getByRole('button',{name:'足迹',exact:true}).click();
}
test('task text, blank card space and keyboard open the date of that card only',async({page})=>{
 await recordedCalendar(page);
 const today=page.locator('.stampbook-mobile-day-card[data-date="2026-10-03"]');
 const yesterday=page.locator('.stampbook-mobile-day-card[data-date="2026-10-02"]');
 const detail=page.getByTestId('calendar-day-detail');
 await today.getByText('今天画小狗',{exact:true}).click();
 await expect(detail.locator('.day-heading')).toContainText('10.03');
 await expect(detail.locator('.day-overview-tasks')).toContainText('今天画小狗');
 await expect(detail.locator('.day-overview-tasks')).not.toContainText('昨天读一页书');
 await page.getByRole('button',{name:'‹ 返回日历',exact:true}).click();
 await yesterday.scrollIntoViewIfNeeded();
 await yesterday.click({position:{x:25,y:90}});
 await expect(detail.locator('.day-heading')).toContainText('10.02');
 await expect(detail.locator('.day-overview-tasks')).toContainText('昨天读一页书');
 await expect(detail.locator('.day-overview-tasks')).not.toContainText('今天画小狗');
 await page.getByRole('button',{name:'‹ 返回日历',exact:true}).click();
 await today.focus();await page.keyboard.press('Enter');
 await expect(detail.locator('.day-heading')).toContainText('10.03');
});
test('dragging a day card switches dates without accidentally opening details',async({page})=>{
 await recordedCalendar(page);
 const today=page.locator('.stampbook-mobile-day-card[data-date="2026-10-03"]');
 await today.scrollIntoViewIfNeeded();
 const box=(await today.boundingBox())!;
 await page.mouse.move(box.x+box.width-30,box.y+80);
 await page.mouse.down();await page.mouse.move(box.x+20,box.y+82,{steps:10});await page.mouse.up();
 await expect(page.getByTestId('calendar-day-detail')).toHaveCount(0);
 await page.clock.runFor(1000);
 const yesterday=page.locator('.stampbook-mobile-day-card[data-date="2026-10-02"]');
 await yesterday.scrollIntoViewIfNeeded();await yesterday.getByText('昨天读一页书',{exact:true}).click();
 await expect(page.getByTestId('calendar-day-detail').locator('.day-heading')).toContainText('10.02');
});
