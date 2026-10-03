import { useEffect, useState } from "react";
import { CheckIcon, TrashIcon } from "@radix-ui/react-icons";
import { KeyboardTextarea } from "./mobile";
import { ReferenceArt } from "./ReferenceArt";
import {
  createTaskEvidence,
  listTaskEvidence,
  removeTaskAttachment,
  removeTaskEvidence,
  saveTaskEvidence,
  subscribeTaskEvidence,
  type CompanionTask,
  type TaskEvidenceRecord,
} from "./taskEvidence";
import { requestCompanion } from "./taskEvidence";
import "./taskCompanion.css";

export type TaskCompanionRecord = TaskEvidenceRecord;
export type TaskCompanionProps = {
  task: CompanionTask;
  dateKey: string;
  onConfirm: (record: TaskCompanionRecord) => void;
  onDelete?: (record: TaskCompanionRecord) => void;
  onOpenSettings?: () => void;
  onForget?: () => void;
  onClose?: () => void;
};

type CloseoutChoice = "result" | "progress" | "blocked" | "skip";

const choices: Array<{ value: CloseoutChoice; label: string; hint: string }> = [
  { value: "result", label: "有结果", hint: "留下了具体内容" },
  { value: "progress", label: "有进展", hint: "事情往前走了一点" },
  { value: "blocked", label: "卡住了", hint: "记下卡点，之后再接" },
  { value: "skip", label: "跳过", hint: "只保留投入记录" },
];

function closeoutReply(choice: CloseoutChoice) {
  if (choice === "result") return "这条具体结果先收好。";
  if (choice === "progress") return "你留下了一点进展，下一次可以从这里接上。";
  return "卡点已经被记住，之后可以从这里继续。";
}

export function TaskCompanion({ task, dateKey, onConfirm, onDelete, onClose, onForget }: TaskCompanionProps) {
  const [choice, setChoice] = useState<CloseoutChoice | null>(null);
  const [summary, setSummary] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [records, setRecords] = useState<TaskEvidenceRecord[]>(() => listTaskEvidence(task.id));

  useEffect(() => {
    setRecords(listTaskEvidence(task.id));
    return subscribeTaskEvidence(() => setRecords(listTaskEvidence(task.id)));
  }, [task.id]);

  const skip = () => {
    onClose?.();
  };

  const save = () => {
    if (!choice) return;
    if (choice === "skip") {
      skip();
      return;
    }
    const body = summary.trim();
    if (!body) {
      setError("想留下的内容，写一句就好。");
      return;
    }
    const record = createTaskEvidence({
      id: `${task.id}:${dateKey}:${Date.now()}`,
      taskId: task.id,
      dateKey,
      summary: body,
      nextStep: nextStep.trim() || undefined,
      source: "chat",
      evidenceQuotes: [body],
    });
    saveTaskEvidence(record);
    onConfirm(record);
    setReply(closeoutReply(choice));
    if (/记错了|忘掉这件事|忘记这件事/.test(body)) onForget?.();
    void requestCompanion(task, [{ role: "user", content: body }]).then(result => { if (result.reply.trim()) setReply(result.reply.trim()); }).catch(() => {});
    setError("");
  };

  const deleteRecord = async (record: TaskEvidenceRecord) => {
    removeTaskEvidence(record.id);
    if (record.attachment) await removeTaskAttachment(record.attachment.id);
    onDelete?.(record);
  };

  return <section className="task-companion task-closeout" data-testid="task-companion" aria-label="任务收尾">
    <header className="task-companion-heading"><div><span className="task-companion-eyebrow">这一步已经结束</span><h2>刚才具体留下了什么？</h2><p><strong>{task.title}</strong> · 已记录 {Math.max(0, Math.round(task.actualMinutes))} 分钟</p></div><ReferenceArt kind="thinking" alt="陪伴的小狗" /></header>
    <div className="closeout-choice-grid" role="group" aria-label="这一步的收尾方式">
      {choices.map(item => <button type="button" key={item.value} className={choice === item.value ? "selected" : ""} onClick={() => { setChoice(item.value); setError(""); }}>{item.label}<small>{item.hint}</small></button>)}
    </div>
    {choice && choice !== "skip" && <><label className="closeout-note">补一句（可选）<KeyboardTextarea aria-label="补充这一步留下的内容" value={summary} maxLength={1200} placeholder="例如：整理了三道错题，找到第二题出错的原因" onChange={event => { setSummary(event.target.value); setError(""); }} /></label><label className="closeout-note">下一次从哪里接上？（可选）<KeyboardTextarea aria-label="填写下一次继续点" value={nextStep} maxLength={600} placeholder="例如：从第三题开始" onChange={event => { setNextStep(event.target.value); setError(""); }} /></label></>}
    {error && <p className="task-companion-error" role="alert">{error}</p>}
    {reply && <div className="closeout-reply"><ReferenceArt kind="cheering" alt="小狗轻轻回应" /><p>{reply}</p></div>}
    {!reply && <div className="closeout-actions"><button type="button" className="task-companion-primary" disabled={!choice} onClick={save}>{choice === "skip" ? "跳过" : "收好这句话"}</button>{onClose && <button type="button" className="task-companion-close" onClick={skip}>现在不写</button>}</div>}
    {reply && <button type="button" className="task-companion-primary closeout-done" onClick={onClose}>完成</button>}
    {records.length > 0 && <section className="task-saved-records" aria-label="这项任务已保存的具体足迹"><h3>以前留下的内容</h3>{records.slice(0, 3).map(record => <article key={record.id}><div><span>{record.dateKey}</span><p>{record.summary}</p>{record.nextStep && <small>下一步：{record.nextStep}</small>}</div><button type="button" className="task-companion-icon-button" aria-label="删除这条足迹" onClick={() => void deleteRecord(record)}><TrashIcon /></button></article>)}</section>}
  </section>;
}
