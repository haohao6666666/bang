import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, MagicWandIcon } from "@radix-ui/react-icons";
import { aiClient, type AiSnapshot, type GeneratedDayStamp } from "./aiContracts";
import { KeyboardTextarea, useKeyboard } from "./mobile";
import { ReferenceArt } from "./ReferenceArt";
import "./aiExperience.css";

export type DailyStampStudioProps = {
  snapshot: AiSnapshot;
  stamp?: GeneratedDayStamp;
  onStamp: (stamp: GeneratedDayStamp) => void;
  onOpenSettings: () => void;
};

function defaultBrief(snapshot: AiSnapshot) {
  const subjects = [...new Set(snapshot.tasks.filter(task => task.actualMinutes > 0).map(task => task.subject.trim()).filter(Boolean))].slice(0, 3);
  return `一枚温柔的手账纪念印章，记录${subjects.length ? subjects.join("、") : "认真度过的一天"}。米白纸张、草木与低饱和印泥，留有呼吸感。用图画纪念真实经历，不使用等级、分数或竞赛符号。`;
}

function safeImageSource(value: string) {
  if (/^data:image\/(?:png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value)) return value;
  if (value.startsWith("/api/ai/") && !value.startsWith("//") && !value.includes("\\")) return value;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; } catch { return null; }
}

export function DailyStampStudio({ snapshot, stamp, onStamp, onOpenSettings }: DailyStampStudioProps) {
  const keyboard = useKeyboard();
  const [brief, setBrief] = useState(() => defaultBrief(snapshot));
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  // Illustrations do not need diary or bookmark text, task titles, or saved outcomes' prose.
  const limitedSnapshot = useMemo<AiSnapshot>(() => {
    const evidence = snapshot.evidence.filter(item => item.dateKey === snapshot.dateKey && (item.kind === "focus" || item.kind === "outcome" || item.kind === "note")).slice(0, 40).map(item => ({ ...item, text: item.kind === "focus" ? "当天的一段真实投入。" : item.kind === "outcome" ? "当天主动保存了一份成果。" : "当天主动保存了一张便签。" }));
    return { dateKey: snapshot.dateKey, tasks: snapshot.tasks.filter(task => task.actualMinutes > 0).map(task => ({ ...task, title: task.subject })), evidence, bookmarks: [] };
  }, [snapshot]);
  const scope = JSON.stringify(limitedSnapshot);
  const liveScope = useRef(scope); liveScope.current = scope;
  const evidenceIds = limitedSnapshot.evidence.map(item => item.id);
  const hasEvidence = evidenceIds.length > 0;
  const currentStamp = stamp?.dateKey === snapshot.dateKey ? stamp : undefined;
  const imageSource = currentStamp && safeImageSource(currentStamp.imageUrl);

  useEffect(() => {
    requestId.current += 1; requestRef.current?.abort(); requestRef.current = null;
    setBusy(false); setConsent(false); setError("");
    return () => { requestId.current += 1; requestRef.current?.abort(); };
  }, [scope]);
  useEffect(() => { setBrief(defaultBrief(snapshot)); setImageFailed(false); }, [snapshot.dateKey]);
  useEffect(() => { setImageFailed(false); }, [currentStamp?.imageUrl]);

  const cancel = () => { requestId.current += 1; requestRef.current?.abort(); requestRef.current = null; setBusy(false); setConsent(false); setError("已停止等待。已提交的绘图任务可能仍在服务端继续，已有记录没有改变。"); };
  const generate = async () => {
    if (!consent || !brief.trim() || busy || !hasEvidence || currentStamp) return;
    keyboard.hide(); setBusy(true); setError("");
    const controller = new AbortController(); requestRef.current = controller;
    const id = ++requestId.current; const capturedScope = scope;
    const current = () => id === requestId.current && !controller.signal.aborted && liveScope.current === capturedScope;
    try {
      const status = await aiClient.status();
      if (!current()) return;
      if (!status.image.configured) throw new Error("还没有配置图像模型。请到 AI 设置填写图像服务地址、模型和密钥。");
      const result = await aiClient.stamp({ dateKey: snapshot.dateKey, brief: brief.trim(), evidenceIds, snapshot: limitedSnapshot }, controller.signal);
      if (!current()) return;
      if (result.stamp.dateKey !== snapshot.dateKey || !safeImageSource(result.stamp.imageUrl) || !result.stamp.evidenceIds.length || result.stamp.evidenceIds.some(evidenceId => !evidenceIds.includes(evidenceId))) throw new Error("这次绘制返回的日期或来源不匹配，未保存。请检查服务后重试。");
      onStamp(result.stamp);
    } catch (cause) {
      if (current()) setError(cause instanceof Error ? cause.message : "这次没有画好，请稍后重试。");
    } finally {
      if (current()) { setBusy(false); setConsent(false); requestRef.current = null; }
    }
  };
  const openSettings = () => { keyboard.hide(); onOpenSettings(); };

  return <section className="daily-stamp-studio paper-card" data-testid="daily-stamp-studio" aria-label="AI 纪念印章">
    <header className="ai-panel-heading"><div><span className="eyebrow">留一枚今天的模样</span><h2>今日纪念印章</h2><p>{snapshot.dateKey} · 由真实经历启发</p></div><ReferenceArt kind="books" /></header>
    <p className="ai-soft-note">这是一幅单独收藏的 AI 插画，不增加时间印迹数量，也不改变已获得的成长印章。</p>
    {currentStamp ? <div className="ai-stamp-kept" data-testid="generated-day-stamp">
      {imageSource && !imageFailed ? <img src={imageSource} alt={`${currentStamp.title}纪念印章`} decoding="async" draggable={false} onError={() => setImageFailed(true)} /> : <div className="ai-stamp-image-missing"><ReferenceArt kind="resting" /><p>这枚印章的图片暂时无法加载，文字和来源仍然保留。</p></div>}
      <span className="ai-kept-label"><CheckIcon />这一天，已经收好</span><h3>{currentStamp.title}</h3><p>{currentStamp.meaning}</p>
      <details className="ai-evidence"><summary>查看绘制说明与来源<ChevronDownIcon /></summary><p>{currentStamp.prompt}</p><p className="ai-source-note">模型：{currentStamp.model} · {currentStamp.evidenceIds.length} 条记录作为来源</p>{currentStamp.evidenceIds.map(id => { const item = snapshot.evidence.find(evidence => evidence.id === id); return item ? <article key={id}><span>{item.dateKey} · {item.kind === "focus" ? "真实投入" : item.kind === "outcome" ? "保存成果" : "主动便签"}</span><p>{item.text}</p></article> : <p key={id} className="ai-source-note">原始记录已不可用，保留印章中的来源编号：{id}</p>; })}</details>
    </div> : <>
      {!hasEvidence && <div className="ai-stamp-empty"><ReferenceArt kind="resting" /><p>先留下一段投入、一份成果或一张便签。以后回看时，印章才有属于你的故事。</p></div>}
      <label className="ai-brief-label">你希望这枚印章画些什么？<KeyboardTextarea aria-label="纪念印章绘制说明" value={brief} maxLength={500} disabled={busy} onChange={event => { setBrief(event.target.value); setConsent(false); }} /></label>
      <details className="ai-request-preview"><summary>将发送给绘图服务的内容<ChevronDownIcon /></summary><p>上方绘制说明、日期、投入方向与时长，以及 {evidenceIds.length} 条来源编号。日记、收藏摘录、任务标题和成果正文不会发送。</p><div className="ai-preview-records">{limitedSnapshot.tasks.map(task => <article key={task.id}><span>投入方向</span><p>{task.subject} · {task.actualMinutes} 分钟</p></article>)}{limitedSnapshot.evidence.map(item => <article key={`${item.kind}-${item.id}`}><span>{item.dateKey} · {item.id}</span><p>{item.text}</p></article>)}</div></details>
      <label className="ai-consent"><input type="checkbox" checked={consent} disabled={busy || !hasEvidence} onChange={event => setConsent(event.target.checked)} /><span>我确认绘制说明，并同意把上方列出的内容发送至已配置的图像服务，为这一天绘制一枚纪念印章。</span></label>
      <div className="ai-action-row"><button className="primary-button" disabled={busy || !consent || !hasEvidence || !brief.trim()} onClick={generate}>{busy ? <><span className="ai-loading-dot" />正在画今天的故事…</> : <><MagicWandIcon />绘制纪念印章</>}</button>{busy ? <button className="text-button" onClick={cancel}>停止等待</button> : <button className="text-button" onClick={openSettings}>图像设置</button>}</div>
      {busy && <p className="ai-soft-note" role="status">绘图需要一点时间。你可以取消等待，已有记录会保留。</p>}
    </>}
    {error && <div className="ai-error" role="alert"><p>{error}</p><button className="text-button" onClick={openSettings}>检查图像设置</button></div>}
  </section>;
}
