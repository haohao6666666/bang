import type { SavedBookmark } from "./aiContracts";

export function collectionUrl(value: string) {
  // A share message may include a title and a URL. Never fetch it automatically.
  const candidate = value.match(/https:\/\/[^\s<>"）]+/)?.[0] ?? value;
  try {
    const url = new URL(candidate);
    const zhihu = ["zhihu.com", "www.zhihu.com", "zhuanlan.zhihu.com"].includes(url.hostname);
    const xhs = ["xiaohongshu.com", "www.xiaohongshu.com", "xhslink.com"].includes(url.hostname);
    if ((!zhihu && !xhs) || url.protocol !== "https:" || url.username || url.password || url.port) return null;
    url.hash = "";
    return { url: url.href, platform: zhihu ? "zhihu" as const : "xiaohongshu" as const };
  } catch { return null; }
}

export function createBookmark(value: { url: string; title: string; excerpt?: string }): SavedBookmark {
  const link = collectionUrl(value.url);
  if (!link) throw new Error("请填写知乎或小红书的 HTTPS 分享链接。");
  if (!value.title.trim()) throw new Error("给这条收藏写一个标题，方便以后找到。");
  return { id: `bookmark-${crypto.randomUUID()}`, ...link, title: value.title.trim().slice(0, 200), excerpt: (value.excerpt ?? "").trim().slice(0, 8000), savedAt: Date.now(), authorized: false };
}

export function parseBookmarkFile(contents: string): SavedBookmark[] {
  let data: unknown;
  try { data = JSON.parse(contents); } catch { throw new Error("请选择 JSON 收藏文件，格式见下方示例。"); }
  const records = Array.isArray(data) ? data : (data as { bookmarks?: unknown })?.bookmarks;
  if (!Array.isArray(records) || !records.length || records.length > 200) throw new Error("文件应包含 1–200 条收藏。");
  return records.map((item: unknown, i: number) => {
    const row = item as Record<string, unknown>;
    if (!row || typeof row.url !== "string" || typeof row.title !== "string") throw new Error(`第 ${i + 1} 条缺少 title 或 url。`);
    try { return createBookmark({ url: row.url, title: row.title, excerpt: typeof row.excerpt === "string" ? row.excerpt : "" }); }
    catch (error) { throw new Error(`第 ${i + 1} 条：${(error as Error).message}`); }
  });
}

export function mergeBookmarks(current: SavedBookmark[], incoming: SavedBookmark[]) {
  const urls = new Set(current.map(item => item.url));
  const added = incoming.filter(item => { if (urls.has(item.url)) return false; urls.add(item.url); return true; });
  if (current.length + added.length > 200) throw new Error("本机收藏库最多保留 200 条，请先整理已有收藏。");
  return [...added, ...current];
}
