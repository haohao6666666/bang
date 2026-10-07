/** Some Safari file pickers return an empty or generic MIME type. */
export function normaliseWorkFile(file:File){
  const types:Record<string,string>={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',pdf:'application/pdf',txt:'text/plain',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
  const inferred=types[file.name.split('.').at(-1)?.toLowerCase()??''];
  if(inferred&&(!file.type||file.type==='application/octet-stream'))return new File([file],file.name,{type:inferred,lastModified:file.lastModified});
  return file;
}
