import type { DailyEchoDraft, EvidenceRef, WeeklyEchoDraft } from "./echoAgent";
import { collectionUrl } from "./bookmarkImport";

export type BookmarkPlatform = "zhihu" | "xiaohongshu";
export type SavedBookmark = { id: string; platform: BookmarkPlatform; title: string; url: string; excerpt: string; savedAt: number; authorized: boolean };
export type AiSnapshot = {
  dateKey: string;
  tasks: Array<{ id: string; title: string; subject: string; plannedMinutes: number; actualMinutes: number; status: string }>;
  evidence: Array<EvidenceRef & { text: string }>;
  bookmarks: SavedBookmark[];
};
export type GeneratedDayStamp = { id: string; dateKey: string; imageUrl: string; title: string; meaning: string; prompt?: string; createdAt: number; evidenceIds: string[]; model?: string; sourceTaskId?: string };
export type ModelConfiguration = { provider: string; baseUrl: string; model: string; apiKey?: string };
export type AiServiceStatus = {
  text: Omit<ModelConfiguration,"apiKey"> & { configured: boolean };
  image: Omit<ModelConfiguration,"apiKey"> & { configured: boolean };
  bookmarks: { zhihu: "import"; xiaohongshu: "import" };
};
export type AiWorkspace = { version: 1; bookmarks: SavedBookmark[]; stamps: GeneratedDayStamp[]; includeDiary: boolean; useBookmarks: boolean };
export type AiEvidenceView = (refs: EvidenceRef[]) => void;

async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/ai/${path}`, { method: body === undefined ? "GET" : "POST", headers: body === undefined ? undefined : { "Content-Type": "application/json", "X-Jixiang-Request": "1" }, body: body === undefined ? undefined : JSON.stringify(body), signal });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : "服务暂时不可用，请检查本机 AI 服务是否已启动。");
  if (!result || typeof result !== "object") throw new Error("服务没有返回可读取的内容，请稍后重试。");
  return result as T;
}
export const aiClient = {
  status: () => request<AiServiceStatus>("status"),
  configure: (config: { text: ModelConfiguration; image: ModelConfiguration }) => request<AiServiceStatus>("config", config),
  daily: (snapshot: AiSnapshot, signal?: AbortSignal) => request<{ draft: DailyEchoDraft }>("echo", { snapshot, consent: true }, signal),
  weekly: (snapshots: AiSnapshot[], rangeStart: string, rangeEnd: string, signal?: AbortSignal) => request<{ draft: WeeklyEchoDraft }>("weekly", { snapshots, rangeStart, rangeEnd, consent: true }, signal),
  stamp: (input: { dateKey: string; brief: string; evidenceIds: string[]; snapshot: AiSnapshot }, signal?: AbortSignal) => request<{ stamp: GeneratedDayStamp }>("stamp", { ...input, consent: true }, signal),
  stamps: () => request<{ stamps: GeneratedDayStamp[] }>("stamps"),
  memory: (input: { eventKey: string; taskId?: string; dateKey: string; userQuotes?: string[]; nextStep?: string; sourceIds?: string[]; forget?: boolean; allDates?: boolean }) => request<{ stored: boolean; duplicate?: boolean }>("memory", input),
  memoryStatus: () => request<{ enabled: boolean; count: number }>("memory/status"),
  clearMemory: () => request<{ cleared: boolean }>("memory-clear", {}),
  autoStamp: (input: { dateKey: string; brief: string; evidenceIds: string[]; snapshot: AiSnapshot; eventKey: string }, signal?: AbortSignal) => request<{ stamp: GeneratedDayStamp }>("stamp", { ...input, automatic: true }, signal),
};

export const AI_WORKSPACE_KEY = "jixiang-ai-workspace-v1";
export function readAiWorkspace(): AiWorkspace {
  const empty: AiWorkspace = { version: 1, bookmarks: [], stamps: [], includeDiary: false, useBookmarks: false };
  try {
    const value = JSON.parse(localStorage.getItem(AI_WORKSPACE_KEY) || "null");
    if (value?.version !== 1) return empty;
    const seen = new Set<string>();
    const bookmarks = (Array.isArray(value.bookmarks) ? value.bookmarks : []).slice(0, 200).flatMap((item: unknown) => {
      const row = item as SavedBookmark;
      if (!row || typeof row.id !== "string" || seen.has(row.id) || typeof row.url !== "string" || typeof row.title !== "string" || typeof row.excerpt !== "string") return [];
      const url = collectionUrl(row.url); if (!url) return [];
      seen.add(row.id);
      return [{ id: row.id, ...url, title: row.title.slice(0, 200), excerpt: row.excerpt.slice(0, 8000), savedAt: Number.isFinite(row.savedAt) ? row.savedAt : Date.now(), authorized: row.authorized === true && row.excerpt.length >= 20 }];
    });
    const stamps = (Array.isArray(value.stamps) ? value.stamps : []).filter((item: GeneratedDayStamp) => item && typeof item.id === "string" && typeof item.dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.dateKey) && typeof item.imageUrl === "string" && typeof item.title === "string" && Array.isArray(item.evidenceIds));
    return { ...empty, bookmarks, stamps, includeDiary: value.includeDiary === true, useBookmarks: value.useBookmarks === true };
  } catch { return empty; }
}
