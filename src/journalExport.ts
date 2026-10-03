type Entry = {id:string;title:string;dateKey:string;kind:string;text:string;file?:File};
type Item = {id:string;reply:string;recap:string;imageUrl?:string;sources?:{url:string;title:string;excerpt:string}[]};
const escape = (value:string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const dataUrl = (file: File) => new Promise<string>((resolve,reject) => { const reader = new FileReader(); reader.onload=()=>resolve(String(reader.result)); reader.onerror=()=>reject(reader.error); reader.readAsDataURL(file); });
export async function readableJournal(entries: Entry[], items: Item[]) {
  const pages = await Promise.all(entries.map(async entry => {
    const item = items.find(i=>i.id===entry.id); let attachment = '';
    if (entry.file) {
      const url = escape(await dataUrl(entry.file)); const name = escape(entry.file.name);
      attachment = `${/^image\/(png|jpeg|webp)$/.test(entry.file.type)?`<img src="${url}" alt="${name}">`:''}<p><a href="${url}" download="${name}">保存原文件：${name}</a></p>`;
    }
    const sources = (item?.sources??[]).filter(s=>/^https:\/\//i.test(s.url)).map(s=>`<p><a href="${escape(s.url)}">${escape(s.title)}</a></p>`).join('');
    const stamp = item?.imageUrl && /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(item.imageUrl) ? `<figure><img class="stamp" src="${item.imageUrl}" alt="这一次的纪念印章"><figcaption>这一次的纪念印章</figcaption></figure>` : '';
    return `<article><small>${escape(entry.dateKey)} · ${entry.kind==='work'?'作品':'聊天'}</small><h2>${escape(entry.title)}</h2>${attachment}${entry.text?`<div class="said"><b>我</b><p>${escape(entry.text)}</p></div>`:''}${item?.reply?`<div class="puppy"><b>小芽</b><p>${escape(item.reply)}</p></div>`:''}${item?.recap?`<aside><b>小芽整理</b><p>${escape(item.recap)}</p></aside>`:''}${sources}${stamp}</article>`;
  }));
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>知途 · 作品与聊天</title><style>body{margin:0;background:#f5f1e8;color:#353c35;font:16px/1.8 system-ui,sans-serif}main{max-width:760px;margin:auto;padding:40px 22px}h1{font-size:30px}h2{font-size:21px}small,header p{color:#727a6b}article{background:#fffdf7;border:1px solid #e4dfd2;border-radius:20px;padding:26px;margin:24px 0}p{white-space:pre-wrap;overflow-wrap:anywhere}img{max-width:100%;max-height:650px;border-radius:12px}.stamp{width:180px}.puppy,aside{background:#edf1e6;padding:14px 18px;border-radius:12px;margin-top:12px}aside{background:#f5eee4}a{color:#426950}@media print{body{background:white}article{break-inside:avoid}}</style><main><header><h1>我的作品与小芽的陪伴</h1><p>知途 · ${entries.length} 条记录 · ${new Date().toLocaleDateString('zh-CN')}</p></header>${pages.join('')||'<p>这一页还空着，慢慢留下喜欢的事。</p>'}</main></html>`;
}
