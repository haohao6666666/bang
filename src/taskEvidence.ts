/**
 * User-confirmed task evidence lives in a small, separate local store.
 * Attachment bytes, when a user chooses to keep them, are held in IndexedDB;
 * record metadata never contains a data URL or base64 payload.
 */

export type EvidenceSource = "chat" | "image" | "document";

export type TaskEvidenceAttachment = {
  id: string;
  name: string;
  mime: string;
  size: number;
};

export type TaskEvidenceRecord = {
  id: string;
  taskId: string;
  dateKey: string;
  summary: string;
  nextStep?: string;
  source: EvidenceSource;
  evidenceQuotes: string[];
  attachment?: TaskEvidenceAttachment;
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = "jixiang-task-evidence-v1";
const CHANGE_EVENT = "jixiang-task-evidence-change";
const MAX_RECORDS = 300;
const MAX_TEXT = 4000;
const MAX_QUOTES = 8;
const MAX_QUOTE_TEXT = 500;
const MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;

function makeId(prefix = "evidence") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanRecord(value: unknown): TaskEvidenceRecord | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<TaskEvidenceRecord>;
  if (typeof item.id !== "string" || !item.id || typeof item.taskId !== "string" || !item.taskId || typeof item.dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.dateKey) || typeof item.summary !== "string" || !item.summary.trim()) return null;
  const source: EvidenceSource = item.source === "image" || item.source === "document" ? item.source : "chat";
  const quotes = Array.isArray(item.evidenceQuotes)
    ? item.evidenceQuotes.filter((quote): quote is string => Boolean(typeof quote === "string" && quote.trim())).slice(0, MAX_QUOTES).map((quote) => quote.trim().slice(0, MAX_QUOTE_TEXT))
    : [];
  const attachment = item.attachment && typeof item.attachment === "object" && typeof item.attachment.id === "string" && typeof item.attachment.name === "string" && typeof item.attachment.mime === "string" && Number.isFinite(item.attachment.size)
    ? { id: item.attachment.id, name: item.attachment.name.slice(0, 180), mime: item.attachment.mime.slice(0, 120), size: Math.max(0, Math.min(MAX_ATTACHMENT_BYTES, Math.floor(item.attachment.size))) }
    : undefined;
  const createdAt = Number.isFinite(item.createdAt) ? Number(item.createdAt) : Date.now();
  const updatedAt = Number.isFinite(item.updatedAt) ? Number(item.updatedAt) : createdAt;
  return {
    id: item.id,
    taskId: item.taskId,
    dateKey: item.dateKey,
    summary: item.summary.trim().slice(0, MAX_TEXT),
    ...(typeof item.nextStep === "string" && item.nextStep.trim() ? { nextStep: item.nextStep.trim().slice(0, MAX_TEXT) } : {}),
    source,
    evidenceQuotes: quotes,
    ...(attachment ? { attachment } : {}),
    createdAt,
    updatedAt,
  };
}

function readAll(): TaskEvidenceRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    return raw.flatMap((item) => {
      const record = cleanRecord(item);
      if (!record || seen.has(record.id)) return [];
      seen.add(record.id);
      return [record];
    }).slice(0, MAX_RECORDS);
  } catch {
    return [];
  }
}

function writeAll(records: TaskEvidenceRecord[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS))); } catch { /* private mode or a full store: the UI still keeps its draft */ }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function createTaskEvidence(input: Omit<TaskEvidenceRecord, "id" | "createdAt" | "updatedAt"> & Partial<Pick<TaskEvidenceRecord, "id" | "createdAt" | "updatedAt">>): TaskEvidenceRecord {
  const now = Date.now();
  const record = cleanRecord({ ...input, id: input.id || makeId(), createdAt: input.createdAt ?? now, updatedAt: input.updatedAt ?? now });
  if (!record) throw new Error("记录需要任务、日期和一段实际成果。");
  return record;
}

/** Upsert by stable record id; repeated confirmation cannot create a duplicate. */
export function saveTaskEvidence(input: TaskEvidenceRecord): TaskEvidenceRecord {
  const record = cleanRecord(input);
  if (!record) throw new Error("无法保存这条记录。");
  const records = readAll();
  const index = records.findIndex((item) => item.id === record.id);
  if (index >= 0) records[index] = record;
  else records.unshift(record);
  writeAll(records);
  return record;
}

export function listTaskEvidence(taskId?: string): TaskEvidenceRecord[] {
  const records = readAll();
  return taskId ? records.filter((item) => item.taskId === taskId) : records;
}

export function removeTaskEvidence(id: string): boolean {
  const records = readAll();
  const removed = records.find((item) => item.id === id);
  const next = records.filter((item) => item.id !== id);
  if (next.length === records.length) return false;
  writeAll(next);
  if (removed?.attachment) void removeTaskAttachment(removed.attachment.id);
  return true;
}

export function clearTaskEvidence(taskId?: string): number {
  const records = readAll();
  const removedRecords = taskId ? records.filter((item) => item.taskId === taskId) : records;
  const next = taskId ? records.filter((item) => item.taskId !== taskId) : [];
  if (removedRecords.length) {
    writeAll(next);
    void Promise.all(removedRecords.flatMap((item) => item.attachment ? [removeTaskAttachment(item.attachment.id)] : []));
  }
  return removedRecords.length;
}

export function subscribeTaskEvidence(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handle = () => listener();
  window.addEventListener(CHANGE_EVENT, handle);
  window.addEventListener("storage", handle);
  return () => { window.removeEventListener(CHANGE_EVENT, handle); window.removeEventListener("storage", handle); };
}

export type CompanionTask = { id: string; title: string; actualMinutes: number };
export type CompanionMessage = { role: "user" | "assistant"; content: string };
export type CompanionMemoryDraft = { summary: string; nextStep?: string; evidenceQuotes?: string[] };
export type CompanionResponse = { reply: string; memoryDraft?: CompanionMemoryDraft };
export type EvidenceAnalysisResponse = { summary: string; observations?: Array<{ text: string; quote?: string }>; uncertainties?: string[]; nextStep?: string };
export type UploadPayload = { name: string; mime: string; text?: string; dataUrl?: string };

async function postAi<T>(path: "companion" | "analyze", body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/ai/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Jixiang-Request": "1" },
    body: JSON.stringify(body),
    signal,
  });
  const result = await response.json().catch(() => null) as { error?: unknown } | T | null;
  if (!response.ok) throw new Error(result && typeof result === "object" && typeof (result as { error?: unknown }).error === "string" ? String((result as { error: string }).error) : "这次没有连接到文字模型，请检查 AI 设置后再试。");
  if (!result || typeof result !== "object") throw new Error("模型没有返回可读取的内容。");
  return result as T;
}

export function requestCompanion(task: CompanionTask, messages: CompanionMessage[], signal?: AbortSignal) {
  return postAi<CompanionResponse>("companion", { consent: true, task: { id: task.id, title: task.title, actualMinutes: Math.max(0, Math.round(task.actualMinutes)) }, messages }, signal);
}

export function requestEvidenceAnalysis(task: Pick<CompanionTask, "id" | "title">, file: UploadPayload, signal?: AbortSignal) {
  return postAi<EvidenceAnalysisResponse>("analyze", { consent: true, task: { id: task.id, title: task.title }, file }, signal);
}

type AttachmentDb = { id: string; blob: Blob; name: string; mime: string; size: number; createdAt: number };
const DB_NAME = "jixiang-task-evidence-v1";
const DB_STORE = "attachments";
const MAX_STORED_ATTACHMENTS = 40;
const MAX_STORED_ATTACHMENT_BYTES = 120 * 1024 * 1024;

function openAttachmentDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("本机暂不支持附件保存。")); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("附件存储失败。"));
  });
}

async function pruneAttachmentDb(db: IDBDatabase) {
  const rows = await new Promise<AttachmentDb[]>((resolve, reject) => {
    const request = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).getAll();
    request.onsuccess = () => resolve((request.result as AttachmentDb[]) || []);
    request.onerror = () => reject(request.error);
  });
  let total = rows.reduce((sum, row) => sum + Math.max(0, Number(row.size) || row.blob?.size || 0), 0);
  const stale = rows.sort((a, b) => a.createdAt - b.createdAt).filter((row, index) => {
    if (rows.length - index > MAX_STORED_ATTACHMENTS && total > 0) { total -= Math.max(0, Number(row.size) || row.blob?.size || 0); return true; }
    if (total > MAX_STORED_ATTACHMENT_BYTES) { total -= Math.max(0, Number(row.size) || row.blob?.size || 0); return true; }
    return false;
  });
  if (!stale.length) return;
  await new Promise<void>((resolve) => { const tx = db.transaction(DB_STORE, "readwrite"); const store = tx.objectStore(DB_STORE); stale.forEach((row) => store.delete(row.id)); tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); });
}

/** Store only after the user confirms an AI draft. Bytes are bounded and never put in localStorage. */
export async function storeTaskAttachment(file: Blob & { name?: string }, name = "成果附件"): Promise<TaskEvidenceAttachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("附件超过 12 MB，请先压缩后再试。");
  const meta: TaskEvidenceAttachment = { id: makeId("attachment"), name: (file.name || name).slice(0, 180), mime: (file.type || "application/octet-stream").slice(0, 120), size: file.size };
  const db = await openAttachmentDb();
  await new Promise<void>((resolve, reject) => { const tx = db.transaction(DB_STORE, "readwrite"); tx.objectStore(DB_STORE).put({ ...meta, blob: file, createdAt: Date.now() } satisfies AttachmentDb); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error || new Error("附件保存失败。")); });
  await pruneAttachmentDb(db).catch(() => {});
  db.close();
  return meta;
}

export async function getTaskAttachmentUrl(id: string): Promise<string | null> {
  try {
    const db = await openAttachmentDb();
    const row = await new Promise<AttachmentDb | undefined>((resolve, reject) => { const request = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).get(id); request.onsuccess = () => resolve(request.result as AttachmentDb | undefined); request.onerror = () => reject(request.error); });
    db.close();
    return row?.blob ? URL.createObjectURL(row.blob) : null;
  } catch { return null; }
}

export async function removeTaskAttachment(id: string): Promise<void> {
  try { const db = await openAttachmentDb(); await new Promise<void>((resolve) => { const tx = db.transaction(DB_STORE, "readwrite"); tx.objectStore(DB_STORE).delete(id); tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); }); db.close(); } catch { /* best effort cleanup */ }
}

export const taskEvidenceLimits = { maxAttachmentBytes: MAX_ATTACHMENT_BYTES, maxText: MAX_TEXT, maxQuotes: MAX_QUOTES } as const;
