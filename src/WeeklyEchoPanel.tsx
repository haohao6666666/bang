import { useEffect, useRef, useState } from "react";
import { aiClient, type AiSnapshot } from "./aiContracts";
import type { WeeklyEchoDraft } from "./echoAgent";
import { KeyboardTextarea } from "./mobile";
import "./aiExperience.css";

export function WeeklyEchoPanel({ snapshots, rangeStart, rangeEnd, draft, onDraft, onOpenDate, onOpenSettings }: {
  snapshots: AiSnapshot[]; rangeStart: string; rangeEnd: string; draft?: WeeklyEchoDraft;
  onDraft: (value: WeeklyEchoDraft) => void; onOpenDate: (key: string) => void; onOpenSettings: () => void;
}) {
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const payload = JSON.stringify(snapshots.map(day => ({ ...day, bookmarks: [] })));
  const days = new Set(snapshots.filter(day => day.evidence.some(item => item.kind === "diary")).map(day => day.dateKey));
  useEffect(() => { controller.current?.abort(); setBusy(false); setConsent(false); return () => controller.current?.abort(); }, [payload, rangeStart, rangeEnd]);
  async function generate() {
    if (!consent || days.size < 3 || busy) return;
    const request = new AbortController(); controller.current = request; setBusy(true); setError("");
    try {
      const { draft: result } = await aiClient.weekly(JSON.parse(payload), rangeStart, rangeEnd, request.signal);
      if (request.signal.aborted) return;
      const available = new Set(snapshots.map(item => item.dateKey));
      const observations = result.observations.filter(item => new Set(item.evidenceDates).size >= 2 && item.evidenceDates.every(day => available.has(day)));
      if (!observations.length) throw new Error("没有满足跨日期证据要求的观察。");
      onDraft({ ...result, status: "draft", rangeStart, rangeEnd, observations }); setConsent(false);
    } catch (reason) { if (!request.signal.aborted) setError((reason as Error).message); }
    finally { if (controller.current === request) { controller.current = null; setBusy(false); } }
  }
  return <details className="weekly-ai-panel paper-card"><summary>回看这一周 <span>{rangeStart.slice(5)} — {rangeEnd.slice(5)}</span></summary>
    <p className="ai-soft-note">只有至少三天日记，且每条观察都能回到两个日期时，才会生成周回声。</p>
    <details className="ai-request-preview"><summary>本次可发送 {snapshots.length} 天的记录 · {days.size} 个日记日期</summary><div className="ai-preview-records">{snapshots.map(day => <article key={day.dateKey}><span>{day.dateKey}</span>{day.evidence.map(item => <p key={item.id}>{item.text}</p>)}</article>)}</div></details>
    {days.size < 3 ? <p className="ai-soft-note">把日记留到三天后，再回来看看。</p> : <label className="ai-consent"><input type="checkbox" disabled={busy} checked={consent} onChange={event => setConsent(event.target.checked)} />允许将上面这七天内的记录发送给已配置的文本模型，生成待确认的周回声。</label>}
    <div className="ai-action-row"><button className="outline-button" disabled={!consent || busy || days.size < 3} onClick={generate}>{busy ? "正在梳理这一周…" : "生成周回声"}</button>{busy && <button className="text-button" onClick={() => { controller.current?.abort(); setBusy(false); }}>停止等待</button>}<button className="text-button" onClick={onOpenSettings}>模型设置</button></div>
    {error && <p className="ai-error" role="alert">{error}</p>}
    {draft?.status === "hidden" ? <div className="ai-hidden-draft">这份周回声已隐藏。<button className="text-button" onClick={() => onDraft({ ...draft, status: "draft" })}>重新查看周回声</button></div> : draft && <div className="ai-draft">
      <p className="ai-soft-note">{draft.status === "confirmed" ? "已确认并保存" : "AI 草稿 · 等你确认"}</p>
      {draft.observations.map((item, index) => <article className="ai-fact" key={item.id}>{editing ? <KeyboardTextarea aria-label={`编辑周观察 ${index + 1}`} value={item.text} onChange={event => onDraft({ ...draft, status: "draft", observations: draft.observations.map(row => row.id === item.id ? { ...row, text: event.target.value } : row) })} /> : <p>{item.text}</p>}<div className="weekly-evidence-links">{item.evidenceDates.map(day => <button className="text-button" key={day} onClick={() => onOpenDate(day)}>回看 {day.slice(5)}</button>)}</div></article>)}
      <div className="ai-action-row"><button className="primary-button" onClick={() => { onDraft({ ...draft, status: "confirmed" }); setEditing(false); }}>确认周回声</button><button className="text-button" onClick={() => setEditing(!editing)}>{editing ? "完成编辑" : "修改周观察"}</button><button className="text-button" onClick={() => onDraft({ ...draft, status: "hidden" })}>隐藏周回声</button></div>
    </div>}
  </details>;
}
