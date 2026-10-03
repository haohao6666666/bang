import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import JSZip from 'jszip';

test('works exclude chats, exports a readable booklet, category can be selected',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>sessionStorage.setItem('jixiang-welcome-seen-v1','yes'));
 await page.goto('/');
 await page.getByRole('button',{name:'＋ 添加一个想做的事'}).click();
 await page.getByLabel('添加今日任务').fill('观察种子');await page.getByLabel('任务类别',{exact:true}).selectOption('阅读');
 await page.getByRole('button',{name:'加入路线',exact:true}).click();
 await page.getByRole('button',{name:'留下作品',exact:true}).click();await page.getByRole('button',{name:'先只记在这里'}).click();
 await page.getByLabel('和小芽说话').fill('只是一条聊天');await page.getByRole('button',{name:'留下',exact:true}).click();
 await expect(page.locator('.chat-user')).toContainText('只是一条聊天');
 await page.locator('input[type=file]').setInputFiles({name:'观察.txt',mimeType:'text/plain',buffer:Buffer.from('豆子今天发芽了。')});
 await page.getByLabel('和小芽说话').fill('我的观察记录');await page.getByRole('button',{name:'留下',exact:true}).click();
 await expect(page.locator('.chat-user')).toHaveCount(2);await page.reload();
 await page.getByRole('navigation',{name:'主要导航'}).getByRole('button',{name:'足迹'}).click();
 await expect(page.getByLabel('任务分类时长统计')).toBeVisible();
 await page.getByRole('tab',{name:'作品',exact:true}).click();await expect(page.locator('.work-card')).toHaveCount(1);await expect(page.locator('.works-gallery')).not.toContainText('只是一条聊天');
 await page.getByRole('navigation',{name:'主要导航'}).getByRole('button',{name:'我的'}).click();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'导出作品与聊天'}).click();const download=await downloadPromise;
 expect(download.suggestedFilename()).toBe('知途-作品与聊天.html');
 const html=await fs.readFile((await download.path())!,'utf8');expect(html).toContain('只是一条聊天');expect(html).toContain('我的观察记录');expect(html).toContain('保存原文件：观察.txt');expect(html).not.toContain('"taskId"');
});

test('TXT, Word and PDF are actually read; export escapes markup',async({page})=>{
 await page.goto('/');
 const zip=new JSZip();zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>种子观察：长出两片叶子。</w:t></w:r></w:p></w:body></w:document>');
 const docx=await zip.generateAsync({type:'base64'});
 const pdf='%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n5 0 obj\n<< /Length 48 >>\nstream\nBT /F1 16 Tf 20 250 Td (Seed observation) Tj ET\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF';
 const result=await page.evaluate(async({docx,pdf})=>{
  // @ts-ignore Vite module, loaded in browser.
  const {readDocument}=await import('/src/reading.ts');
  // @ts-ignore Vite module, loaded in browser.
  const {readableJournal}=await import('/src/journalExport.ts');
  const txt=await readDocument(new File(['叶子是绿色的'], 'a.txt',{type:'text/plain'}));
  const word=await readDocument(new File([Uint8Array.from(atob(docx),c=>c.charCodeAt(0))],'a.docx'));
  const document=await readDocument(new File([pdf],'a.pdf',{type:'application/pdf'}));
  const html=await readableJournal([{id:'1',title:'<script>alert(1)</script>',text:'<img onerror=bad>',dateKey:'2026-10-03',kind:'chat'}],[]);
  return {txt,word,document,html};
 },{docx,pdf});
 expect(result.txt.text).toContain('绿色');expect(result.word.text).toContain('两片叶子');expect(result.document.text).toContain('Seed observation');expect(result.html).not.toContain('<script>');expect(result.html).toContain('&lt;img onerror=bad&gt;');
});

test('stats count saved time only, combine subjects, split overnight and deduplicate',async({page})=>{
 await page.goto('/');
 const groups=await page.evaluate(async()=>{
  // @ts-ignore Vite module, loaded in browser.
  const {focusTimeGroups}=await import('/src/TaskTimeStats.tsx');
  const start=new Date(2026,9,3).getTime();const first={id:'a',taskId:'t1',startedAt:start-60000,durationMs:120000};
  return focusTimeGroups([{id:'t1',subject:'阅读'},{id:'t2',subject:'数学'}],[first,first,{id:'b',taskId:'t2',startedAt:start+60000,durationMs:120000},{id:'bad',taskId:'t1',startedAt:start,durationMs:-5}],start,start+86400000);
 });
 expect(groups).toEqual([{subject:'阅读',taskKind:'custom',actualMs:60000},{subject:'数学',taskKind:'custom',actualMs:120000}]);
});
