export type Reading = { text: string; source: 'document' | 'image'; truncated?: boolean; note?: string; feedback?: string };
const limit = 12000;
export async function readDocument(file: File): Promise<Reading> {
  let text = '', truncated = false;
  if (/\.txt$/i.test(file.name) || file.type === 'text/plain') text = await file.text();
  else if (/\.docx$/i.test(file.name)) {
    const mammoth = await import('mammoth');
    text = (await mammoth.extractRawText({arrayBuffer: await file.arrayBuffer()})).value;
  } else if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
    const pdf = await import('pdfjs-dist');
    pdf.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    const loading = pdf.getDocument({data: await file.arrayBuffer()});
    const document = await loading.promise;
    try {
      for (let pageNumber = 1; pageNumber <= Math.min(document.numPages, 30); pageNumber++) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        text += content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('') + '\n';
        if (text.length > limit) { truncated = true; break; }
      }
      truncated ||= document.numPages > 30;
    } finally { await loading.destroy(); }
  } else throw new Error('这个格式暂时读不了，文件已经收好了。');
  text = text.trim();
  return {source: 'document', text: text.slice(0, limit), truncated: truncated || text.length > limit,
    ...(!text ? {note: '没有读到文字。扫描件可以转成照片再发给小芽。'} : {})};
}
export async function imageForReading(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d'); if (!context) throw new Error('图片暂时没有打开。');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    // Keep noisy camera photos inside the API payload bound instead of failing after upload.
    let quality=.85,data=canvas.toDataURL('image/jpeg',quality);
    while(data.length>2400000&&quality>.4){quality-=.1;data=canvas.toDataURL('image/jpeg',quality);}
    if(data.length>2400000){const small=document.createElement('canvas');small.width=Math.round(canvas.width*.7);small.height=Math.round(canvas.height*.7);const reduced=small.getContext('2d');if(!reduced)throw new Error('图片暂时没有打开。');reduced.drawImage(canvas,0,0,small.width,small.height);data=small.toDataURL('image/jpeg',.65);}
    return data;
  } finally { bitmap.close(); }
}
