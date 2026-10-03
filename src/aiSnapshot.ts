import { localDateKey } from "./echoAgent";
import type { AiSnapshot, AiWorkspace } from "./aiContracts";

type SnapshotRecords = {
  tasks: { id: string; title: string; subject: string; planMinutes: number; status: string; expectedArtifact: string }[];
  focusLogs: { id: string; dateKey: string; taskId: string; durationMs: number }[];
  outcomes: { id: string; dateKey: string; taskId: string; body: string; nextStep?: string; classification: string }[];
  diaries: { id: string; dateKey: string; text: string }[];
  notes: { id: string; dateKey: string; title: string; body: string; taskId?: string; archived?: boolean; type: string }[];
};

export function buildAiSnapshot(state: SnapshotRecords, dateKey: string, workspace: AiWorkspace, today = localDateKey()): AiSnapshot {
  const logs = state.focusLogs.filter(item => item.dateKey === dateKey);
  const outcomes = state.outcomes.filter(item => item.dateKey === dateKey);
  const notes = state.notes.filter(item => item.dateKey === dateKey && !item.archived && item.type !== "pause");
  const taskIds = new Set([...logs, ...outcomes, ...notes].map(item => item.taskId));
  const tasks = state.tasks.filter(item => dateKey === today || taskIds.has(item.id)).map(item => ({
    id: `task:${dateKey}:${item.id}`, title: item.title, subject: item.subject,
    plannedMinutes: dateKey === today ? item.planMinutes : 0,
    actualMinutes: Math.round(logs.filter(log => log.taskId === item.id).reduce((sum, log) => sum + log.durationMs, 0) / 600) / 100,
    status: outcomes.find(outcome => outcome.taskId === item.id)?.classification ?? "没有当日成果状态",
  }));
  const titleFor = (id: string) => state.tasks.find(item => item.id === id)?.title ?? "已移除任务";
  const evidence: AiSnapshot["evidence"] = [
    ...tasks.map(item => ({ id: item.id, kind: "task" as const, dateKey, text: `${item.title}（${item.subject}）。${dateKey === today ? `计划 ${item.plannedMinutes} 分钟；` : ""}实际投入 ${item.actualMinutes} 分钟。${item.status !== "没有当日成果状态" ? `记录状态：${item.status}。` : ""}` })),
    ...logs.map(item => ({ id: `focus:${item.id}`, kind: "focus" as const, dateKey, text: `${titleFor(item.taskId)}：真实投入 ${Math.round(item.durationMs / 600) / 100} 分钟。` })),
    ...outcomes.map(item => ({ id: `outcome:${item.id}`, kind: "outcome" as const, dateKey, text: `${titleFor(item.taskId)}：${item.body}${item.nextStep ? `；继续点：${item.nextStep}` : ""}` })),
    ...notes.map(item => ({ id: `note:${item.id}`, kind: "note" as const, dateKey, text: `${item.title}：${item.body}` })),
    ...(workspace.includeDiary ? state.diaries.filter(item => item.dateKey === dateKey).map(item => ({ id: `diary:${item.id}`, kind: "diary" as const, dateKey, text: item.text })) : []),
  ];
  // Running time and undated legacy totals remain local; never manufacture dated focus logs.
  return { dateKey, tasks, evidence, bookmarks: workspace.useBookmarks ? workspace.bookmarks.filter(item => item.authorized && item.excerpt.length >= 20).slice(0, 80) : [] };
}

export function dateOffset(key: string, days: number) {
  const date = new Date(`${key}T12:00:00`); date.setDate(date.getDate() + days); return localDateKey(date.getTime());
}
