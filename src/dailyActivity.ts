type Log = { id: string; taskId: string; dateKey: string; startedAt: number; endedAt: number; durationMs: number };
type Session = { activeTaskId: string | null; status: string; startedAt: number | null };

/** A live view only: never saves, completes a task, or awards an extra stamp. */
export function withRunningFocus(logs: Log[], session: Session, now: number): Log[] {
  if (session.status !== 'running' || !session.activeTaskId || !session.startedAt) return logs;
  const start = new Date(session.startedAt);
  const dateKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  return [...logs, { id: 'live-focus-session', taskId: session.activeTaskId, dateKey, startedAt: session.startedAt, endedAt: now, durationMs: Math.max(0, now - session.startedAt) }];
}

export function dailyTaskTime(logs: Log[], dateKey: string, taskId?: string): number {
  const start = new Date(`${dateKey}T00:00:00`).getTime();
  const next = new Date(start); next.setDate(next.getDate() + 1);
  const seen = new Set<string>();
  return logs.reduce((total, log) => {
    if (taskId && log.taskId !== taskId) return total;
    if (seen.has(log.id) || !Number.isFinite(log.durationMs) || log.durationMs <= 0) return total;
    seen.add(log.id);
    const recordedStart = new Date(log.startedAt);
    const recordedDate = `${recordedStart.getFullYear()}-${String(recordedStart.getMonth() + 1).padStart(2, '0')}-${String(recordedStart.getDate()).padStart(2, '0')}`;
    // Older imports can retain a valid date without a matching clock timestamp.
    // Preserve their recorded day instead of moving their time to another year.
    if (recordedDate !== log.dateKey) return total + (log.dateKey === dateKey ? log.durationMs : 0);
    return total + Math.max(0, Math.min(log.startedAt + log.durationMs, next.getTime()) - Math.max(log.startedAt, start));
  }, 0);
}
