import { useRef, useState } from "react";
import { TrashIcon, Pencil1Icon, CheckIcon } from "@radix-ui/react-icons";
import { KeyboardTextarea } from "./mobile";

export type WorkKind = "photo" | "document" | "note";
export type WorkRecord = {
  id: string;
  taskId: string;
  dateKey: string;
  kind: WorkKind;
  name: string;
  mime?: string;
  text?: string;
  dataUrl?: string;
  revisedFrom?: string;
  createdAt: number;
  updatedAt: number;
  hidden?: boolean;
};

type Props = {
  taskId: string;
  dateKey: string;
  records: WorkRecord[];
  onSave: (record: WorkRecord) => void;
  onDelete: (id: string) => void;
};

const MAX_FILE_BYTES = 2_500_000;
const id = () => `work-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("文件读取失败。"));
    reader.onerror = () => reject(new Error("文件读取失败。"));
    reader.readAsDataURL(file);
  });
}

export function WorkCapture({ taskId, dateKey, records, onSave, onDelete }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [error, setError] = useState("");

  const saveNote = () => {
    const text = draft.trim();
    if (!text) { setError("写一句就好。"); return; }
    const current = editingId ? records.find(item => item.id === editingId) : undefined;
    const now = Date.now();
    onSave({
      id: current?.id ?? id(), taskId, dateKey, kind: "note", name: "一句记录", text,
      revisedFrom: current?.revisedFrom, createdAt: current?.createdAt ?? now, updatedAt: now,
    });
    setDraft(""); setEditingId(null); setEditorOpen(false); setError("");
  };

  const saveFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) { setError("文件请控制在 2.5 MB 以内。"); return; }
    try {
      const now = Date.now();
      const kind: WorkKind = file.type.startsWith("image/") ? "photo" : "document";
      onSave({ id: id(), taskId, dateKey, kind, name: file.name, mime: file.type || "application/octet-stream", dataUrl: await fileToDataUrl(file), createdAt: now, updatedAt: now });
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "文件暂时没有保存。"); }
  };

  const startEdit = (record: WorkRecord) => {
    if (record.kind !== "note") return;
    setEditingId(record.id); setDraft(record.text ?? ""); setEditorOpen(true); setError("");
  };

  return <section className="work-capture" aria-label="作品与记录">
    <div className="work-capture-heading"><div><span className="eyebrow">作品与一句话</span><h3>想留下时，再放进来</h3></div><span className="work-capture-count">{records.length} 条</span></div>
    <div className="work-capture-actions">
      <button type="button" className="outline-button" onClick={() => inputRef.current?.click()}>加一份作品</button>
      <button type="button" className="outline-button" onClick={() => { setEditingId(null); setDraft(""); setEditorOpen(true); setError(""); }}>写一句</button>
      <input ref={inputRef} type="file" accept="image/*,.pdf,.doc,.docx,.txt,.md" aria-label="上传作品" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void saveFile(file); }} />
    </div>
    {editorOpen && <div className="work-note-editor"><KeyboardTextarea value={draft} maxLength={1200} aria-label="作品一句话记录" placeholder="例如：把开头改成了一个具体问题" onChange={event => { setDraft(event.target.value); setError(""); }} /><div><button type="button" className="primary-button small" onClick={saveNote}><CheckIcon />保存</button><button type="button" className="text-button" onClick={() => { setDraft(""); setEditingId(null); setEditorOpen(false); }}>取消</button></div></div>}
    {error && <p className="work-capture-error" role="alert">{error}</p>}
    <div className="work-record-list">{records.filter(item => !item.hidden).map(record => <article className="work-record" key={record.id}>
      {record.kind === "photo" && record.dataUrl ? <img src={record.dataUrl} alt={record.name} loading="lazy" /> : record.kind === "document" && record.dataUrl ? <a className="work-document" href={record.dataUrl} download={record.name}>打开 {record.name}</a> : <p>{record.text}</p>}
      <div className="work-record-meta"><span>{record.kind === "photo" ? "照片" : record.kind === "document" ? "文档" : "记录"} · {record.dateKey}</span><div><button type="button" className="icon-button" aria-label={`编辑作品：${record.name}`} onClick={() => startEdit(record)} disabled={record.kind !== "note"}><Pencil1Icon /></button><button type="button" className="icon-button" aria-label={`删除作品：${record.name}`} onClick={() => onDelete(record.id)}><TrashIcon /></button></div></div>
    </article>)}</div>
  </section>;
}
