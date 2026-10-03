import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, ExternalLinkIcon, Pencil1Icon, ReloadIcon } from "@radix-ui/react-icons";
import { KeyboardTextarea, useKeyboard } from "./mobile";
import { aiClient, type AiSnapshot, type SavedBookmark } from "./aiContracts";
import type { DailyEchoDraft, EvidenceRef } from "./echoAgent";
import { ReferenceArt } from "./ReferenceArt";
import "./aiExperience.css";

export type AiEchoPanelProps = {
  snapshot: AiSnapshot;
  draft?: DailyEchoDraft;
  onDraft: (draft: DailyEchoDraft) => void;
  onAcceptExperiment: (experiment: DailyEchoDraft["tomorrowExperiments"][number]) => void;
  acceptedExperimentIds: string[];
  onOpenSettings: () => void;
  includeDiary: boolean;
  onIncludeDiaryChange: (value: boolean) => void;
  useBookmarks: boolean;
  onUseBookmarksChange: (value: boolean) => void;
};

const kindLabels: Record<EvidenceRef["kind"], string> = { task: "任务", focus: "投入", outcome: "成果", diary: "日记", note: "便签", bookmark: "收藏" };
const signalLabels: Record<DailyEchoDraft["signals"][number]["type"], string> = { friction: "可以照顾的卡点", startup: "开始的方式", interest: "兴趣的线索", question: "值得再想一想", progress: "已经发生的进展" };
const refKey = (ref: EvidenceRef) => `${ref.kind}:${ref.dateKey}:${ref.id}`;

/** Link destinations and excerpts always come from an authorized local import. */
function safeBookmarkUrl(bookmark: SavedBookmark) {
  try {
    const url = new URL(bookmark.url);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    const allowed = bookmark.platform === "zhihu"
      ? host === "zhihu.com" || host.endsWith(".zhihu.com")
      : host === "xiaohongshu.com" || host.endsWith(".xiaohongshu.com") || host === "xhslink.com" || host.endsWith(".xhslink.com");
    return allowed ? url.href : null;
  } catch { return null; }
}

function safeDraft(draft: DailyEchoDraft, snapshot: AiSnapshot): DailyEchoDraft {
  const allowedRefs = new Map(snapshot.evidence.map(item => [refKey(item), item]));
  const refs = (input: EvidenceRef[]) => input.filter(ref => allowedRefs.has(refKey(ref))).map(ref => ({ id: ref.id, kind: ref.kind, dateKey: ref.dateKey }));
  const bookmarks = new Map(snapshot.bookmarks.filter(item => item.authorized).map(item => [item.id, item]));
  return {
    ...draft, status: "draft",
    facts: draft.facts.map(item => ({ ...item, evidenceRefs: refs(item.evidenceRefs) })).filter(item => item.evidenceRefs.length > 0),
    signals: draft.signals.map(item => ({ ...item, evidenceRefs: refs(item.evidenceRefs) })).filter(item => item.evidenceRefs.length > 0),
    sparkle: draft.sparkle && refs(draft.sparkle.evidenceRefs).length ? { ...draft.sparkle, evidenceRefs: refs(draft.sparkle.evidenceRefs) } : null,
    externalMatches: draft.externalMatches.flatMap(item => {
      const bookmark = bookmarks.get(item.bookmarkId);
      if (!bookmark || !safeBookmarkUrl(bookmark)) return [];
      return [{ ...item, url: bookmark.url, excerpt: bookmark.excerpt, savedAt: bookmark.savedAt, evidenceRefs: refs(item.evidenceRefs) }];
    }),
    tomorrowExperiments: draft.tomorrowExperiments.map(item => ({ ...item, evidenceRefs: refs(item.evidenceRefs) })).filter(item => item.evidenceRefs.length > 0),
  };
}

function EvidenceList({ refs, snapshot }: { refs: EvidenceRef[]; snapshot: AiSnapshot }) {
  const items = refs.flatMap(ref => {
    const evidence = snapshot.evidence.find(item => refKey(item) === refKey(ref));
    return evidence ? [evidence] : [];
  });
  if (!items.length) return <p className="ai-source-note">这条内容没有可核对的本机来源，请先修改或隐藏。</p>;
  return <details className="ai-evidence"><summary>查看依据 · {items.length} 条<ChevronDownIcon /></summary><div>{items.map(item => <article key={refKey(item)}><span>{kindLabels[item.kind]} · {item.dateKey}</span><p>{item.text}</p></article>)}</div></details>;
}

export function AiEchoPanel({ snapshot, draft, onDraft, onAcceptExperiment, acceptedExperimentIds, onOpenSettings, includeDiary, onIncludeDiaryChange, useBookmarks, onUseBookmarksChange }: AiEchoPanelProps) {
  const keyboard = useKeyboard();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [factEdits, setFactEdits] = useState<string[]>([]);
  const [sparkleEdit, setSparkleEdit] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const allowedSnapshot = useMemo<AiSnapshot>(() => {
    const bookmarks = useBookmarks ? snapshot.bookmarks.filter(item => item.authorized && safeBookmarkUrl(item)) : [];
    const bookmarkIds = new Set(bookmarks.map(item => item.id));
    return { ...snapshot, evidence: snapshot.evidence.filter(item => (includeDiary || item.kind !== "diary") && (item.kind !== "bookmark" || bookmarkIds.has(item.id))), bookmarks };
  }, [snapshot, includeDiary, useBookmarks]);
  const requestScope = JSON.stringify(allowedSnapshot);
  const liveScope = useRef(requestScope);
  liveScope.current = requestScope;
  const hasRecord = allowedSnapshot.evidence.some(item => item.kind !== "bookmark");

  useEffect(() => {
    requestId.current += 1;
    requestRef.current?.abort(); requestRef.current = null;
    setBusy(false); setConsent(false); setError(""); setEditing(false);
    return () => { requestId.current += 1; requestRef.current?.abort(); };
  }, [requestScope, includeDiary, useBookmarks]);

  const cancel = () => {
    requestId.current += 1; requestRef.current?.abort(); requestRef.current = null;
    setBusy(false); setConsent(false); setError("已取消。本机记录没有改变。");
  };
  const generate = async () => {
    if (!consent || busy || !hasRecord) return;
    keyboard.hide(); setError(""); setBusy(true); setEditing(false);
    const controller = new AbortController(); requestRef.current = controller;
    const id = ++requestId.current; const scope = requestScope;
    const current = () => id === requestId.current && !controller.signal.aborted && liveScope.current === scope;
    try {
      const status = await aiClient.status();
      if (!current()) return;
      if (!status.text.configured) throw new Error("还没有配置文字模型。请先到 AI 设置填写服务地址、模型和密钥。");
      const result = await aiClient.daily(allowedSnapshot, controller.signal);
      if (!current()) return;
      onDraft(safeDraft(result.draft, allowedSnapshot));
    } catch (cause) {
      if (current()) setError(cause instanceof Error ? cause.message : "这次没有生成成功。请检查 AI 设置后重试。");
    } finally {
      if (current()) { setBusy(false); setConsent(false); requestRef.current = null; }
    }
  };
  const startEditing = () => { keyboard.hide(); setFactEdits(draft?.facts.map(item => item.text) ?? []); setSparkleEdit(draft?.sparkle?.text ?? ""); setEditing(true); };
  const saveEdits = () => {
    if (!draft) return;
    keyboard.hide();
    onDraft({ ...draft, status: "draft", facts: draft.facts.map((item, index) => ({ ...item, text: factEdits[index]?.trim() ?? item.text })).filter(item => item.text), sparkle: draft.sparkle && sparkleEdit.trim() ? { ...draft.sparkle, text: sparkleEdit.trim() } : null });
    setEditing(false);
  };
  const openSettings = () => { keyboard.hide(); onOpenSettings(); };
  const visibleDraft = draft && draft.status !== "hidden";

  return <section className="ai-echo-panel paper-card" data-testid="ai-echo-panel" aria-label="AI 每日回声">
    <header className="ai-panel-heading"><div><span className="eyebrow">让经历，慢慢变成理解</span><h2>和今天聊一聊</h2><p>AI 帮你整理线索，最后由你确认。</p></div><ReferenceArt kind="thinking" /></header>
    <div className="ai-request-options">
      <label><input type="checkbox" checked={includeDiary} disabled={busy} onChange={event => { setConsent(false); onIncludeDiaryChange(event.target.checked); }} /><span>这次包含已保存的日记<small>不勾选时，日记内容不会发送。</small></span></label>
      <label><input type="checkbox" checked={useBookmarks} disabled={busy} onChange={event => { setConsent(false); onUseBookmarksChange(event.target.checked); }} /><span>参考我授权的收藏<small>只使用在本机导入并授权的摘录。</small></span></label>
    </div>
    <details className="ai-request-preview"><summary>将发送哪些内容<ChevronDownIcon /></summary><p>{snapshot.dateKey} · {allowedSnapshot.tasks.length} 项任务 · {allowedSnapshot.evidence.length} 条来源 · {allowedSnapshot.bookmarks.length} 条收藏</p><div className="ai-preview-records">{allowedSnapshot.tasks.map(task => <article key={task.id}><span>任务 · {task.subject}</span><p>{task.title} · 实际 {task.actualMinutes} 分钟</p></article>)}{allowedSnapshot.evidence.map(item => <article key={refKey(item)}><span>{kindLabels[item.kind]} · {item.dateKey}</span><p>{item.text}</p></article>)}{allowedSnapshot.bookmarks.map(bookmark => <article key={bookmark.id}><span>授权收藏 · {bookmark.title}</span><p>{bookmark.excerpt}</p></article>)}</div></details>
    <label className="ai-consent"><input type="checkbox" checked={consent} disabled={busy || !hasRecord} onChange={event => { setConsent(event.target.checked); if (!event.target.checked) { requestId.current += 1; requestRef.current?.abort(); setBusy(false); } }} /><span>我同意将上方选定内容发送至已配置的 AI 服务，用于这次回声。</span></label>
    {!hasRecord && <p className="ai-soft-note">先保存一段真实记录，再一起回看。今天不必填满。</p>}
    <div className="ai-action-row"><button className="primary-button" disabled={!consent || busy || !hasRecord} onClick={generate}>{busy ? <><span className="ai-loading-dot" />正在整理今天…</> : <>{draft ? <ReloadIcon /> : null}{draft ? "重新生成回声" : "生成这一天的回声"}</>}</button>{busy ? <button className="text-button" onClick={cancel}>取消</button> : <button className="text-button" onClick={openSettings}>AI 设置</button>}</div>
    {busy && <p className="ai-soft-note" role="status">正在等待模型回复。离开这一天会取消等待。</p>}
    {error && <div className="ai-error" role="alert"><p>{error}</p><button className="text-button" onClick={openSettings}>检查 AI 设置</button></div>}

    {draft?.status === "hidden" && <div className="ai-hidden-draft"><span>这份回声已隐藏，原始记录仍然保留。</span><button className="text-button" onClick={() => onDraft({ ...draft, status: "draft" })}>重新查看</button></div>}
    {visibleDraft && <div className="ai-draft" data-testid="ai-daily-draft">
      {draft.sourceNote && <p className="ai-soft-note" role="status">{draft.sourceNote}</p>}
      <div className="ai-draft-status"><span>{draft.status === "confirmed" ? <><CheckIcon />你已确认</> : "AI 回声草稿 · 等你确认"}</span><small>{snapshot.dateKey}</small></div>
      {draft.quiet && <p className="ai-quiet-message">今天暂时没有足够的线索，也可以留下一段安静的记录。你的每一天不需要被评分。</p>}
      {draft.facts.length > 0 && <section className="ai-draft-section"><h3>今天真实发生的事</h3>{draft.facts.map((fact, index) => <article className="ai-fact" key={fact.id}>{editing ? <KeyboardTextarea aria-label={`修改事实 ${index + 1}`} value={factEdits[index] ?? ""} maxLength={1600} onChange={event => setFactEdits(values => values.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} /> : <p>{fact.text}</p>}<EvidenceList refs={fact.evidenceRefs} snapshot={allowedSnapshot} /></article>)}</section>}
      {draft.sparkle && <section className="ai-sparkle"><span>值得留住的一点光</span>{editing ? <KeyboardTextarea aria-label="修改闪耀瞬间" value={sparkleEdit} maxLength={1600} onChange={event => setSparkleEdit(event.target.value)} /> : <p>{draft.sparkle.text}</p>}<EvidenceList refs={draft.sparkle.evidenceRefs} snapshot={allowedSnapshot} /></section>}
      {draft.signals.length > 0 && <section className="ai-draft-section"><h3>可以一起想想</h3>{draft.signals.map(signal => <article className="ai-signal" key={signal.id}><span>{signalLabels[signal.type] ?? "一条待确认的线索"}</span><h4>{signal.title}</h4><p>{signal.detail}</p><EvidenceList refs={signal.evidenceRefs} snapshot={allowedSnapshot} /></article>)}</section>}
      {useBookmarks && draft.externalMatches.length > 0 && <section className="ai-draft-section"><h3>从自己的收藏里，找一点帮助</h3>{draft.externalMatches.map((match, index) => {
        const bookmark = allowedSnapshot.bookmarks.find(item => item.id === match.bookmarkId && item.authorized);
        const href = bookmark && safeBookmarkUrl(bookmark);
        if (!bookmark || !href) return null;
        return <article className="ai-bookmark-match" key={`${bookmark.id}-${index}`}><span>{bookmark.platform === "zhihu" ? "知乎" : "小红书"} · 你授权的收藏</span><h4>{bookmark.title}</h4><p>{match.whyRelevant}</p><dl><dt>可借鉴的部分</dt><dd>{match.usefulPart || "先对照原文，判断是否适合自己。"}</dd><dt>适合什么时候</dt><dd>{match.applicableWhen || "需要你结合当下情况判断。"}</dd><dt>使用时的边界</dt><dd>{match.limitation || "这是一条参考经验，不代表适用于每个人。"}</dd></dl><details className="ai-evidence"><summary>查看导入原文<ChevronDownIcon /></summary><blockquote>{bookmark.excerpt}</blockquote><a href={href} target="_blank" rel="noopener noreferrer">打开收藏来源<ExternalLinkIcon /></a></details><EvidenceList refs={match.evidenceRefs} snapshot={allowedSnapshot} /></article>;
      })}</section>}
      {editing ? <div className="ai-action-row"><button className="primary-button" onClick={saveEdits}>保存修改</button><button className="text-button" onClick={() => { keyboard.hide(); setEditing(false); }}>取消修改</button></div> : <div className="ai-draft-actions"><button className="primary-button" disabled={draft.status === "confirmed" || busy} onClick={() => { keyboard.hide(); onDraft({ ...draft, status: "confirmed" }); }}>{draft.status === "confirmed" ? "这份回声已确认" : "确认这份回声"}</button><button className="text-button" disabled={busy} onClick={startEditing}><Pencil1Icon />修改文字</button><button className="text-button" disabled={busy} onClick={() => { keyboard.hide(); onDraft({ ...draft, status: "hidden" }); }}>隐藏</button></div>}
      {!editing && draft.tomorrowExperiments.length > 0 && <section className="ai-draft-section ai-experiments"><h3>明天，可以轻轻试一试</h3><p className="ai-soft-note">确认回声后，再挑一个适合自己的尝试。</p>{draft.tomorrowExperiments.map(experiment => { const accepted = acceptedExperimentIds.includes(experiment.id); return <article key={experiment.id}><h4>{experiment.title}</h4><p>{experiment.why}</p>{experiment.stopCondition && <p className="ai-stop-condition">可以停下来的时候：{experiment.stopCondition}</p>}<EvidenceList refs={experiment.evidenceRefs} snapshot={allowedSnapshot} /><button className="outline-button" disabled={accepted || draft.status !== "confirmed" || busy} onClick={() => { keyboard.hide(); onAcceptExperiment(experiment); }}>{accepted ? <><CheckIcon />已放进明天</> : "把这个尝试放进明天"}</button></article>; })}</section>}
    </div>}
  </section>;
}
