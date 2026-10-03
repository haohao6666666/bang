import {test,expect} from '@playwright/test';

test('Xiaoya is reachable without tasks, reading toggle persists, and chat receives a reply',async({page})=>{
 await page.setViewportSize({width:393,height:852});
 await page.addInitScript(()=>{sessionStorage.setItem('jixiang-welcome-seen-v1','yes');localStorage.setItem('jixiang-tutorial-v2','done');});
 await page.route('**/api/ai/companion',async route=>{const body=route.request().postDataJSON();const e=body.events?.at(-1);await route.fulfill({json:{items:e?[{id:e.id,taskId:e.taskId,dateKey:e.dateKey,reply:'汪，耳朵画好啦，尾巴下次接着画。',progress:'尾巴待画',recap:''}]:[]}});});
 await page.goto('/');
 const guide=page.getByRole('button',{name:'结束新手引导'});if(await guide.isVisible())await guide.click();
 const puppy=page.getByRole('button',{name:'和小芽聊聊',exact:true});
 const avatarBox=await puppy.getByAltText('小芽').boundingBox(),buttonBox=await puppy.boundingBox();
 expect(avatarBox!.x).toBeGreaterThanOrEqual(buttonBox!.x);expect(avatarBox!.x+avatarBox!.width).toBeLessThanOrEqual(buttonBox!.x+buttonBox!.width);
 expect(Math.abs(avatarBox!.x+avatarBox!.width/2-buttonBox!.x-buttonBox!.width/2)).toBeLessThanOrEqual(1);
 await page.getByRole('navigation').getByRole('button',{name:'足迹',exact:true}).click();
 await page.getByRole('tab',{name:'作品',exact:true}).click();
 const emptyArt=page.locator('.works-gallery .stampbook-empty img');
 await expect(emptyArt).toBeVisible();
 const artBounds=await emptyArt.boundingBox();expect(artBounds!.width).toBeLessThanOrEqual(160);expect(artBounds!.height).toBeLessThanOrEqual(160);
 await page.getByRole('button',{name:'和小芽聊聊',exact:true}).click();
 await expect(page.getByAltText('小芽，陪你聊聊的小伙伴')).toBeVisible();
 await page.getByRole('button',{name:'好呀',exact:true}).click();
 const reading=page.getByRole('checkbox',{name:/让小芽读作品/});
 await reading.check();await expect(reading).toBeChecked();
 await reading.uncheck();await expect(reading).not.toBeChecked();
 await reading.check();
 await page.getByLabel('和小芽说话').fill('小狗的耳朵画好了，尾巴下次画。');
 await page.getByRole('button',{name:'留下',exact:true}).click();
 await expect(page.locator('.chat-puppy')).toContainText('尾巴下次接着画');
 await page.getByRole('button',{name:'收起小芽聊天'}).click();
 await page.reload();await page.getByRole('button',{name:'和小芽聊聊',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:/让小芽读作品/})).toBeChecked();
 await expect(page.locator('.chat-puppy')).toContainText('尾巴下次接着画');
 await expect(page.locator('.task-row')).toHaveCount(0);
});

test('stamp book tab contains its full label on narrow phones',async({page})=>{
 await page.setViewportSize({width:320,height:740});
 await page.addInitScript(()=>sessionStorage.setItem('jixiang-welcome-seen-v1','yes'));
 await page.goto('/');
 const guide=page.getByRole('button',{name:'结束新手引导'});if(await guide.isVisible())await guide.click();
 await page.getByRole('navigation').getByRole('button',{name:'足迹',exact:true}).click();
 const tab=page.getByRole('tab',{name:'我的印章册',exact:true});
 await expect(tab).toBeVisible();
 expect(await tab.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await tab.click();await expect(tab).toHaveAttribute('aria-selected','true');
});
