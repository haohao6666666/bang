export function usefulReply(value) {
  const reply=typeof value==='string'?value.trim():'';
  return Boolean(reply&&!/(?:今天|今日).{0,12}(?:聊[得的].{0,8}多|额度|次数.{0,6}(?:用完|上限))|明天再聊|今天先收好.{0,15}(?:稍后|之后|再看)/.test(reply));
}
