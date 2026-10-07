import {test,expect} from '@playwright/test';

test('native chat remains within the panned keyboard viewport and restores after closing',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>{
    sessionStorage.setItem('jixiang-welcome-seen-v1','yes');
    Object.defineProperty(crypto,'randomUUID',{configurable:true,value:undefined});
    localStorage.setItem('jixiang-getting-started-v1','yes');
    const viewport=Object.assign(new EventTarget(),{height:844,width:390,offsetTop:0,scale:1});
    Object.defineProperty(window,'visualViewport',{configurable:true,value:viewport});
    (window as any).moveNativeViewport=(height:number,offsetTop:number,type='resize')=>{viewport.height=height;viewport.offsetTop=offsetTop;viewport.dispatchEvent(new Event(type));};
  });
  await page.goto('/');
  await page.getByRole('button',{name:'＋ 添加一个想做的事'}).click();
  await page.getByLabel('添加今日任务').fill('画一只小狗');
  await page.getByRole('button',{name:'加入路线',exact:true}).click();
  await page.getByRole('button',{name:'留下作品',exact:true}).click();
  await page.getByRole('button',{name:'先只记在这里'}).click();
  const input=page.getByLabel('和小芽说话');
  for(let i=0;i<5;i++){
    await input.fill(`第 ${i+1} 次进度：今天画好了耳朵，接下来想给小狗画一条弯弯的尾巴，再看看背景。`);
    await page.getByRole('button',{name:'留下',exact:true}).click();
  }
  await input.focus();
  await page.evaluate(()=>(window as any).moveNativeViewport(390,180));
  await expect.poll(()=>page.locator('.phone-stage').evaluate(el=>Math.round(el.getBoundingClientRect().height))).toBe(844);
  await expect.poll(()=>page.locator('.phone-stage').evaluate(el=>Math.round(el.getBoundingClientRect().top))).toBe(0);
  const bounds=async()=>({sheet:await page.getByTestId('bottom-sheet').boundingBox(),input:await input.boundingBox(),button:await page.getByRole('button',{name:'留下',exact:true}).boundingBox()});
  let boxes=await bounds();
  for(const box of Object.values(boxes)){expect(box!.y).toBeGreaterThanOrEqual(180);expect(box!.y+box!.height).toBeLessThanOrEqual(571);}
  const timeline=page.locator('.chat-timeline');
  expect(await timeline.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
  await timeline.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  const inputY=(await input.boundingBox())!.y;
  await timeline.evaluate(el=>{el.scrollTop=0;});
  expect((await input.boundingBox())!.y).toBe(inputY);
  await page.evaluate(()=>(window as any).moveNativeViewport(390,230,'scroll'));
  await expect.poll(()=>page.locator('.phone-stage').evaluate(el=>Math.round(el.getBoundingClientRect().top))).toBe(0);
  boxes=await bounds();expect(boxes.input!.y).toBeGreaterThanOrEqual(230);expect(boxes.button!.y+boxes.button!.height).toBeLessThanOrEqual(621);
  // Close while Safari is still reporting its keyboard pan, then replay its
  // intermediate resize and a stale offset after the keyboard disappears.
  await page.getByRole('button',{name:'收起小芽聊天'}).click();
  expect(await input.evaluate(el=>el!==document.activeElement)).toBe(true);
  await page.evaluate(()=>(window as any).moveNativeViewport(650,90));
  await expect.poll(()=>page.locator('.phone-stage').evaluate(el=>Math.round(el.getBoundingClientRect().top))).toBe(0);
  await expect.poll(()=>page.locator('.phone-stage').evaluate(el=>Math.round(el.getBoundingClientRect().height))).toBe(844);
  await page.evaluate(()=>(window as any).moveNativeViewport(844,90));
  await expect.poll(()=>page.locator('.phone-stage').evaluate(el=>Math.round(el.getBoundingClientRect().top))).toBe(0);
  await expect(page.getByTestId('keyboard-dock')).toHaveCount(0);
  await expect(page.getByTestId('bottom-sheet')).toHaveCount(0);
  await expect(page.getByRole('navigation',{name:'主要导航'})).toBeVisible();
});

test('LAN origin survives API proxy while unrelated origins stay blocked',async({request})=>{
  const allowed=await request.get('/api/ai/status',{headers:{Host:'127.0.0.2:4174',Origin:'http://127.0.0.2:4174'}});
  expect(allowed.status()).toBe(200);
  expect(await allowed.json()).toHaveProperty('text');
  const rejected=await request.get('/api/ai/status',{headers:{Host:'127.0.0.2:4174',Origin:'https://attacker.example'}});
  expect(rejected.status()).toBe(403);
});

test('all product input sheets keep the underlying page steady on repeated opening and dismissal',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.clock.install({time:new Date('2026-10-03T12:00:00+08:00')});
 await page.addInitScript(()=>{
   sessionStorage.setItem('jixiang-welcome-seen-v1','yes');localStorage.setItem('jixiang-getting-started-v1','yes');
   const viewport=Object.assign(new EventTarget(),{height:844,width:390,offsetTop:0,scale:1});
   Object.defineProperty(window,'visualViewport',{configurable:true,value:viewport});
   (window as any).moveNativeViewport=(height:number,offsetTop:number)=>{viewport.height=height;viewport.offsetTop=offsetTop;viewport.dispatchEvent(new Event('resize'));};
 });
 await page.goto('/');
 await page.getByRole('navigation').getByRole('button',{name:'足迹',exact:true}).click();
 await page.getByRole('button',{name:'查看 2026-10-03 的记录'}).click();
 // Finish the day-page entrance before measuring its resting scroll position.
 await page.clock.runFor(450);
 const background=page.locator('.app-screen .mobile-scroll');
 await page.getByRole('button',{name:'日记与成果'}).click();
 // Measure after the browser has brought the clicked trigger into view;
 // the regression under test is input/keyboard movement, not click scrolling.
 const initial=await background.evaluate(el=>({height:el.clientHeight,top:el.scrollTop}));
 await page.getByRole('button',{name:'写便签',exact:true}).click();
 await page.getByLabel('便签内容').fill('下次接着画尾巴。');
 await page.evaluate(()=>(window as any).moveNativeViewport(390,180));
 await expect.poll(()=>background.evaluate(el=>({height:el.clientHeight,top:el.scrollTop}))).toEqual(initial);
 await page.keyboard.press('Escape');
 await expect(page.getByTestId('bottom-sheet')).toHaveCount(0);
 await page.evaluate(()=>(window as any).moveNativeViewport(844,100));
 await expect.poll(()=>page.locator('.phone-stage').evaluate(el=>Math.round(el.getBoundingClientRect().top))).toBe(0);
 for(let i=0;i<3;i++){
   await page.getByRole('button',{name:'和小芽聊聊',exact:true}).click();
   await page.getByLabel('和小芽说话').fill('这条只是输入，没有发送。');
   await page.evaluate(()=>(window as any).moveNativeViewport(390,180));
   await expect.poll(()=>background.evaluate(el=>({height:el.clientHeight,top:el.scrollTop}))).toEqual(initial);
   await page.keyboard.press('Escape');
   await expect(page.getByTestId('bottom-sheet')).toHaveCount(0);
   await page.evaluate(()=>(window as any).moveNativeViewport(844,100));
   await expect.poll(()=>background.evaluate(el=>({height:el.clientHeight,top:el.scrollTop}))).toEqual(initial);
 }
});


