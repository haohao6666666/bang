import { useState } from "react";
import { KeyboardInput, KeyboardTextarea } from "./mobile";
import { type SavedBookmark } from "./aiContracts";
import { collectionUrl, createBookmark, mergeBookmarks, parseBookmarkFile } from "./bookmarkImport";
import "./aiConnections.css";

/** 收藏导入是目前唯一需要用户主动管理的外部资料入口。 */
export function AiConnections({ bookmarks, onBookmarks }: { bookmarks: SavedBookmark[]; onBookmarks: (items: SavedBookmark[]) => void }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [editing, setEditing] = useState<string>();
  const [message, setMessage] = useState("");

  const saveBookmark = () => {
    try {
      const next = createBookmark({ title, url, excerpt });
      if (editing) {
        if (bookmarks.some(item => item.id !== editing && item.url === next.url)) throw new Error("这个链接已经在收藏库里了。");
        onBookmarks(bookmarks.map(item => item.id === editing ? { ...next, id: editing, savedAt: item.savedAt } : item));
      } else onBookmarks(mergeBookmarks(bookmarks, [next]));
      setTitle(""); setUrl(""); setExcerpt(""); setEditing(undefined); setMessage("已存入本机；只有你授权的原文片段会在合适时被参考。");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "收藏暂时没有保存。"); }
  };

  return <section className="ai-connections settings-group" aria-label="我的收藏库">
    <p className="eyebrow">收藏</p><h3>把以后可能用得上的内容放在这里</h3>
    <p className="connection-description">自动整理只会使用你导入并明确授权的原文片段。当前支持本机导入，尚未接通账号收藏自动同步。</p>
    <details className="connection-section" open><summary>我的收藏库 <span>{bookmarks.length} 条</span></summary>
      <div className="collection-platforms"><span>知乎 · 导入</span><span>小红书 · 导入</span></div>
      <div className="bookmark-form">
        <label>收藏标题<KeyboardInput value={title} onChange={event => setTitle(event.target.value)} aria-label="收藏标题" maxLength={200} placeholder="例如：把大问题缩成第一步" /></label>
        <label>分享链接<KeyboardInput value={url} onChange={event => setUrl(event.target.value)} aria-label="收藏分享链接" placeholder="知乎 / 小红书 HTTPS 链接" /></label>
        <label>原文片段<KeyboardTextarea value={excerpt} onChange={event => setExcerpt(event.target.value)} aria-label="收藏原文片段" maxLength={8000} placeholder="粘贴你有权使用的片段" /></label>
        <button type="button" className="outline-button" onClick={saveBookmark}>{editing ? "保存修改" : "存入收藏库"}</button>
        {editing && <button className="text-button" onClick={() => { setEditing(undefined); setTitle(""); setUrl(""); setExcerpt(""); }}>取消编辑</button>}
      </div>
      <label className="bookmark-import">导入 JSON 收藏文件<input type="file" accept=".json,application/json" aria-label="导入收藏文件" onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
        try { if (file.size > 2_000_000) throw new Error("文件请控制在 2 MB 以内。"); const next = mergeBookmarks(bookmarks, parseBookmarkFile(await file.text())); onBookmarks(next); setMessage(`导入 ${next.length - bookmarks.length} 条新收藏，重复链接已跳过。`); }
        catch (cause) { setMessage(cause instanceof Error ? cause.message : "导入文件格式不正确。"); }
      }} /></label>
      {message && <p className="connection-feedback" role="status">{message}</p>}
      <div className="bookmark-list">{bookmarks.map(bookmark => <article key={bookmark.id}>
        <span>{bookmark.platform === "zhihu" ? "知乎" : "小红书"} · {new Date(bookmark.savedAt).toLocaleDateString("zh-CN")}</span><h4>{bookmark.title}</h4><p>{bookmark.excerpt || "只保存了链接，尚无可整理的原文片段。"}</p>
        <label className="bookmark-authorize"><input type="checkbox" aria-label={`允许整理收藏：${bookmark.title}`} disabled={bookmark.excerpt.length < 20} checked={bookmark.authorized} onChange={event => onBookmarks(bookmarks.map(item => item.id === bookmark.id ? { ...item, authorized: event.target.checked } : item))} />允许在合适的时候参考这段原文</label>
        <div>{collectionUrl(bookmark.url) && <a href={bookmark.url} target="_blank" rel="noopener noreferrer">打开原文 ↗</a>}<button className="text-button" onClick={() => { setEditing(bookmark.id); setTitle(bookmark.title); setUrl(bookmark.url); setExcerpt(bookmark.excerpt); }}>编辑</button><button className="text-button" onClick={() => onBookmarks(bookmarks.filter(item => item.id !== bookmark.id))}>移除</button></div>
      </article>)}</div>
      {!bookmarks.length && <p className="collection-empty">还没有导入收藏。</p>}
    </details>
  </section>;
}
