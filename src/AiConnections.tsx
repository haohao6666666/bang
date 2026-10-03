import { useEffect, useState } from "react";
import { KeyboardInput, KeyboardTextarea } from "./mobile";
import { aiClient, type AiServiceStatus, type ModelConfiguration, type SavedBookmark } from "./aiContracts";
import { collectionUrl, createBookmark, mergeBookmarks, parseBookmarkFile } from "./bookmarkImport";
import "./aiConnections.css";

const presets = {
  qwen: { provider: "qwen", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  deepseek: { provider: "deepseek", baseUrl: "https://api.deepseek.com", model: "deepseek-flash" },
  tokendance: { provider: "tokendance", baseUrl: "https://tokendance.space/gateway/v1", model: "deepseek-v4.1-flash" },
  doubaoText: { provider: "doubao", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", model: "" },
  wan: { provider: "wan", baseUrl: "https://dashscope.aliyuncs.com/api/v1", model: "wan2.2-t2i-flash" },
  doubaoImage: { provider: "doubao", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", model: "doubao-seedream-5-0-pro-260628" },
};

export function AiConnections({ bookmarks, onBookmarks }: { bookmarks: SavedBookmark[]; onBookmarks: (items: SavedBookmark[]) => void }) {
  const [status, setStatus] = useState<AiServiceStatus>();
  const [textConfig, setTextConfig] = useState<ModelConfiguration>(presets.qwen);
  const [imageConfig, setImageConfig] = useState<ModelConfiguration>(presets.wan);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [title, setTitle] = useState(""), [url, setUrl] = useState(""), [excerpt, setExcerpt] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [editing, setEditing] = useState<string>();
  useEffect(() => {
    let active = true;
    aiClient.status().then(value => { if (active) { setStatus(value); setTextConfig(value.text); setImageConfig(value.image); } }).catch(() => { if (active) setMessage("本机 AI 服务尚未启动。请用 npm run dev 启动完整版。"); });
    return () => { active = false; };
  }, []);
  async function saveModels() {
    setBusy(true); setMessage("");
    try { const value = await aiClient.configure({ text: textConfig, image: imageConfig }); setStatus(value); setTextConfig(value.text); setImageConfig(value.image); setMessage("配置已保存到本机服务。填写密钥后，可在回响或印章册中发起首次调用。"); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  function saveBookmark() {
    try {
      const bookmark = createBookmark({ title, url, excerpt });
      if (editing) {
        if (bookmarks.some(item => item.id !== editing && item.url === bookmark.url)) throw new Error("这个链接已经在收藏库里了。");
        onBookmarks(bookmarks.map(item => item.id === editing ? { ...bookmark, id: editing, savedAt: item.savedAt } : item));
      } else onBookmarks(mergeBookmarks(bookmarks, [bookmark]));
      setTitle(""); setUrl(""); setExcerpt(""); setEditing(undefined); setImportMessage("已存入本机。原文片段需要逐条授权后，才可参与分析。");
    } catch (error) { setImportMessage((error as Error).message); }
  }
  const modelFields = (kind: "text" | "image") => {
    const value = kind === "text" ? textConfig : imageConfig;
    const change = kind === "text" ? setTextConfig : setImageConfig;
    return <fieldset className="model-fieldset" disabled={busy}><legend>{kind === "text" ? "理解与回声" : "每日印章绘图"} <span>{status?.[kind].configured ? "已填写密钥 · 待实际调用验证" : "待填写 API Key"}</span></legend>
      <label>服务商<select aria-label={kind === "text" ? "文本模型服务商" : "绘图模型服务商"} value={value.provider} onChange={event => { const provider = event.target.value; const preset = provider === "doubao" ? presets[kind === "text" ? "doubaoText" : "doubaoImage"] : presets[provider as keyof typeof presets]; change({ ...preset, apiKey: "" }); }}>
        {kind === "text" ? <><option value="qwen">通义千问</option><option value="deepseek">DeepSeek</option><option value="tokendance">Token Dance</option></> : <option value="wan">通义万相</option>}<option value="doubao">豆包 · 火山方舟</option>
      </select></label>
      <label>模型名称 / 接入点 ID<KeyboardInput aria-label={kind === "text" ? "文本模型名称" : "绘图模型名称"} value={value.model} placeholder="填写控制台可用的模型或 ep-…" onChange={event => change({ ...value, model: event.target.value })} /></label>
      <details><summary>API 地址</summary><KeyboardInput aria-label={kind === "text" ? "文本 API 地址" : "绘图 API 地址"} value={value.baseUrl} onChange={event => change({ ...value, baseUrl: event.target.value })} /><small>支持所选厂商的大陆官方地址。百炼可填写工作空间专属地址。</small></details>
      <label>API Key<KeyboardInput aria-label={kind === "text" ? "文本 API Key" : "绘图 API Key"} type="password" autoComplete="off" spellCheck={false} value={value.apiKey ?? ""} placeholder={status?.[kind].configured ? "留空保留当前厂商密钥" : "只保存于本机服务"} onChange={event => change({ ...value, apiKey: event.target.value })} /></label>
    </fieldset>;
  };
  return <section className="ai-connections settings-group" aria-label="模型与收藏">
    <p className="eyebrow">模型与收藏</p><h3>连接经验，也保留自己的判断。</h3>
    <p className="connection-description">记录先留在本机。只有你确认生成时，本次预览的内容才会发送给所选模型服务。</p>
    <details className="connection-section"><summary>国内大模型 <span>{status?.text.configured ? "已配置" : "待配置"}</span></summary>
      <p className="connection-description">文本模型负责理解，绘图模型负责画章。密钥存于本机 .local 目录，不写进浏览器缓存或导出记录；模型调用按厂商规则计费。</p>
      {modelFields("text")}{modelFields("image")}
      <button type="button" className="primary-button" disabled={busy} onClick={saveModels}>{busy ? "正在保存…" : "保存模型配置"}</button>
    </details>
    {message && <p className="connection-feedback" role="status">{message}</p>}
    <details className="connection-section" open><summary>我的收藏库 <span>{bookmarks.length} 条</span></summary>
      <div className="collection-platforms"><span>知乎 · 导入</span><span>小红书 · 导入</span></div>
      <p className="connection-description">粘贴分享链接与自己有权使用的原文片段，或导入 JSON 文件。当前支持本机收藏导入，尚不支持账号收藏自动同步；只放链接不会假装读过全文。</p>
      <div className="bookmark-form">
        <label>收藏标题<KeyboardInput value={title} onChange={event => setTitle(event.target.value)} aria-label="收藏标题" maxLength={200} placeholder="例如：把大任务缩成第一步" /></label>
        <label>分享链接<KeyboardInput value={url} onChange={event => setUrl(event.target.value)} aria-label="收藏分享链接" placeholder="知乎 / 小红书 HTTPS 链接" /></label>
        <label>原文片段<KeyboardTextarea value={excerpt} onChange={event => setExcerpt(event.target.value)} aria-label="收藏原文片段" maxLength={8000} placeholder="粘贴与你有关的部分；至少 20 字才可参与分析" /></label>
        <button type="button" className="outline-button" onClick={saveBookmark}>{editing ? "保存收藏修改" : "存入收藏库"}</button>
        {editing && <button className="text-button" onClick={() => { setEditing(undefined); setTitle(""); setUrl(""); setExcerpt(""); }}>取消编辑</button>}
      </div>
      <label className="bookmark-import">导入 JSON 收藏文件<input type="file" accept=".json,application/json" aria-label="导入收藏文件" onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
        try { if (file.size > 2_000_000) throw new Error("文件请控制在 2 MB 以内。"); const next = mergeBookmarks(bookmarks, parseBookmarkFile(await file.text())); onBookmarks(next); setImportMessage(`导入 ${next.length - bookmarks.length} 条新收藏，重复链接已跳过。导入内容默认不授权分析。`); }
        catch (error) { setImportMessage((error as Error).message); }
      }} /></label>
      <details className="import-example"><summary>查看文件格式</summary><pre>{'[{"title":"收藏标题","url":"https://www.zhihu.com/question/…","excerpt":"你有权使用的原文片段"}]'}</pre></details>
      {importMessage && <p className="connection-feedback" role="status">{importMessage}</p>}
      <div className="bookmark-list">{bookmarks.map(bookmark => <article key={bookmark.id}>
        <span>{bookmark.platform === "zhihu" ? "知乎" : "小红书"} · {new Date(bookmark.savedAt).toLocaleDateString("zh-CN")}</span><h4>{bookmark.title}</h4><p>{bookmark.excerpt || "仅保存链接，尚无可分析的原文片段。"}</p>
        <label className="bookmark-authorize"><input type="checkbox" aria-label={`允许分析收藏：${bookmark.title}`} disabled={bookmark.excerpt.length < 20} checked={bookmark.authorized} onChange={event => onBookmarks(bookmarks.map(item => item.id === bookmark.id ? { ...item, authorized: event.target.checked } : item))} />允许在我确认生成时分析这段原文</label>
        <div>{collectionUrl(bookmark.url) && <a href={bookmark.url} target="_blank" rel="noopener noreferrer">查看原文 ↗</a>}<button className="text-button" onClick={() => { setEditing(bookmark.id); setTitle(bookmark.title); setUrl(bookmark.url); setExcerpt(bookmark.excerpt); }}>编辑</button><button className="text-button" onClick={() => onBookmarks(bookmarks.filter(item => item.id !== bookmark.id))}>移除</button></div>
      </article>)}</div>
      {!bookmarks.length && <p className="collection-empty">把曾经打动你的方法，放在这里等一次合适的重逢。</p>}
    </details>
  </section>;
}
