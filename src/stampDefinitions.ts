import { DEFAULT_STAMP_UNIT_MS, localDateKey, resolveStampStyle, type StampFocusLogLike, type StampGroup, type StampIcon, type StampNoteLike, type StampOutcomeLike, type StampTaskLike, type StampStyleChoice } from "./stampBook";

export type StampCategory = "time" | "persistence" | "exploration" | "breakthrough" | "growth";
export type StampArtworkId = `time-${StampIcon}` | "persistence-return" | "breakthrough-milestone" | "growth-reflection" | "exploration-research" | "exploration-math" | "exploration-interest" | "exploration-journey";

/** Artwork is presentation metadata, separate from saved styles and acquisition evidence. */
export const STAMP_ARTWORK: Readonly<Record<StampArtworkId, string>> = {
  "time-book": "/assets/stamps-web/time-book.webp",
  "time-atom": "/assets/stamps-web/time-atom.webp",
  "time-flask": "/assets/stamps-web/time-flask.webp",
  "time-english": "/assets/stamps-web/time-english.webp",
  "time-leaf": "/assets/stamps-web/time-leaf.webp",
  "time-pen": "/assets/stamps-web/time-pen.webp",
  "time-mountain": "/assets/stamps-web/time-mountain.webp",
  "time-coffee": "/assets/stamps-web/time-coffee.webp",
  "time-source": "/assets/stamps-web/time-source.webp",
  "time-spark": "/assets/stamps-web/time-spark.webp",
  "persistence-return": "/assets/stamps-web/persistence-return.webp",
  "breakthrough-milestone": "/assets/stamps-web/breakthrough-milestone.webp",
  "growth-reflection": "/assets/stamps-web/growth-reflection.webp",
  "exploration-research": "/assets/stamps-web/exploration-research.webp",
  "exploration-math": "/assets/stamps-web/exploration-math.webp",
  "exploration-interest": "/assets/stamps-web/exploration-interest.webp",
  "exploration-journey": "/assets/stamps-web/exploration-journey.webp",
};

export type StampDefinition = {
  key: string;
  name: string;
  category: StampCategory;
  meaning: string;
  triggerDescription: string;
  iconType: StampIcon;
  artwork: StampArtworkId;
};

export const STAMP_CATEGORIES: ReadonlyArray<{ key: StampCategory; label: string; description: string }> = [
  { key: "time", label: "时间印迹", description: "一段真实投入，一枚有出处的印记。" },
  { key: "persistence", label: "坚持章", description: "曾经回来继续，日子不必连续。" },
  { key: "exploration", label: "探索章", description: "纪念第一次真正走进一个方向。" },
  { key: "breakthrough", label: "突破章", description: "有成果作证，记下一次阶段的抵达。" },
  { key: "growth", label: "成长章", description: "把投入、成果与自己的思考放在一起。" },
];

const timeTrigger = "同一天、同一任务累计留下 10 分钟真实投入，就有一枚印迹；每增加 10 分钟再留下一枚。";
export const TIME_STAMP_DEFINITIONS: readonly StampDefinition[] = [
  { key: "time:book", name: "书页印", category: "time", meaning: "在语文与文字的世界里，留下了一段认真投入。", triggerDescription: timeTrigger, iconType: "book", artwork: "time-book" },
  { key: "time:atom", name: "星轨印", category: "time", meaning: "在数学推演与思考中，留下了一段真实投入。", triggerDescription: timeTrigger, iconType: "atom", artwork: "time-atom" },
  { key: "time:flask", name: "求知印", category: "time", meaning: "在物理与实验探索中，留下了一段真实投入。", triggerDescription: timeTrigger, iconType: "flask", artwork: "time-flask" },
  { key: "time:english", name: "语言印", category: "time", meaning: "在英语与语言学习中，留下了一段真实投入。", triggerDescription: timeTrigger, iconType: "english", artwork: "time-english" },
  { key: "time:leaf", name: "新芽印", category: "time", meaning: "给兴趣留出时间，让喜欢的事情慢慢生长。", triggerDescription: timeTrigger, iconType: "leaf", artwork: "time-leaf" },
  { key: "time:pen", name: "笔尖印", category: "time", meaning: "在写作与表达中，留下了一段真实投入。", triggerDescription: timeTrigger, iconType: "pen", artwork: "time-pen" },
  { key: "time:mountain", name: "远山印", category: "time", meaning: "在阅读或科研方向，踏实地走过一小段路。", triggerDescription: timeTrigger, iconType: "mountain", artwork: "time-mountain" },
  { key: "time:coffee", name: "生活印", category: "time", meaning: "给生活、运动或休息，留出一段认真相处的时间。", triggerDescription: timeTrigger, iconType: "coffee", artwork: "time-coffee" },
  { key: "time:source", name: "足迹印", category: "time", meaning: "在自己选择的方向上，留下了一段真实投入。", triggerDescription: timeTrigger, iconType: "source", artwork: "time-source" },
  { key: "time:spark", name: "微光印", category: "time", meaning: "记录一段值得留下的投入，让细小的努力可被回看。", triggerDescription: timeTrigger, iconType: "spark", artwork: "time-spark" },
];

export const GROWTH_STAMP_DEFINITIONS: readonly StampDefinition[] = [
  { key: "persistence:return", name: "慢慢积累", category: "persistence", meaning: "你曾在不同的日子回来，把想做的事接着做下去。", triggerDescription: "在 3 个不同日期，各留下累计至少 10 分钟的真实投入记录。日期无需连续。", iconType: "leaf", artwork: "persistence-return" },
  { key: "breakthrough:milestone", name: "抵达一小步", category: "breakthrough", meaning: "一个阶段有了可以回看的成果，值得轻轻记下一笔。", triggerDescription: "保存一份标记为已完成的成果，并明确确认它完成了一个里程碑；该任务当天有至少 10 分钟真实投入。", iconType: "mountain", artwork: "breakthrough-milestone" },
  { key: "growth:reflection", name: "把经历写成收获", category: "growth", meaning: "投入留下成果，也留下你对这一天的亲自回望。", triggerDescription: "同一天，为一个有至少 10 分钟真实投入的任务保存已完成成果，再留下自己的日记。", iconType: "book", artwork: "growth-reflection" },
];

export function stampCategoryLabel(category: StampCategory): string {
  return STAMP_CATEGORIES.find((item) => item.key === category)!.label;
}

/** Calendar, the catalog, and detail sheets all resolve through these definitions. */
export function resolveTimeStampDefinition(group: { style: Pick<StampStyleChoice, "icon"> }): StampDefinition {
  return TIME_STAMP_DEFINITIONS.find((item) => item.iconType === group.style.icon) ?? TIME_STAMP_DEFINITIONS.find((item) => item.iconType === "source")!;
}

export function describeTimeStampOccurrence(group: Pick<StampGroup, "dateKey" | "taskTitle" | "actualMs" | "actualStampCount" | "focusLogIds">): string {
  const minutes = Math.round(group.actualMs / 60_000);
  return group.focusLogIds.length
    ? `${group.dateKey} 在「${group.taskTitle}」投入 ${minutes} 分钟，留下 ${group.actualStampCount} 枚时间印迹。`
    : `「${group.taskTitle}」目前累计 ${minutes} 分钟。尚无可核对的已保存投入片段，因此暂不计入印章册的首次获得记录。`;
}

export function stampAsset(definition: Pick<StampDefinition, "artwork">): string {
  return STAMP_ARTWORK[definition.artwork];
}

function explorationArtwork(theme: string): StampArtworkId {
  if (/科研|阅读/u.test(theme)) return "exploration-research";
  if (/数学/u.test(theme)) return "exploration-math";
  if (/兴趣/u.test(theme)) return "exploration-interest";
  return "exploration-journey";
}

type CatalogTask = StampTaskLike & { expectedArtifact?: string; milestoneId?: string };
type CatalogOutcome = StampOutcomeLike & { createdAt?: number; nextStep?: string };
type CatalogNote = StampNoteLike & { outcomeId?: string; milestoneId?: string };
type CatalogDiary = { id: string; dateKey: string; text: string };
type CatalogEcho = { status: string; facts?: readonly { text: string }[]; signals?: readonly { title: string; detail: string }[]; sparkle?: { text: string } | null };
type CatalogMilestone = { id: string; title: string; criteria?: string; unlocked: boolean; unlockedByOutcomeId?: string };

/** Structural input lets the existing persisted state stay unchanged. */
export type StampCollectionInput = {
  tasks: readonly CatalogTask[];
  focusLogs?: readonly StampFocusLogLike[];
  outcomes?: readonly CatalogOutcome[];
  notes?: readonly CatalogNote[];
  diaries?: readonly CatalogDiary[];
  dailyEchoes?: Readonly<Record<string, CatalogEcho>>;
  milestones?: readonly CatalogMilestone[];
  stampStyles?: Readonly<Record<string, StampStyleChoice>>;
  stampBook?: { styleAssignments?: Readonly<Record<string, StampStyleChoice>> };
};

export type StampEvidence = {
  id: string;
  kind: "focus" | "task" | "outcome" | "note" | "diary" | "echo" | "milestone";
  dateKey: string;
  title: string;
  body: string;
  taskId?: string;
};
export type CollectedStamp = {
  definition: StampDefinition;
  earned: boolean;
  firstEarnedDate?: string;
  reason?: string;
  evidence: StampEvidence[];
};

type VerifiedLog = StampFocusLogLike & { dateKey: string; durationMs: number };

function validDateKey(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isFinite(parsed.getTime()) && localDateKey(parsed.getTime()) === value;
}

function verifiedLogs(input: StampCollectionInput): VerifiedLog[] {
  const tasks = new Set(input.tasks.map((task) => task.id));
  const ids = new Set<string>();
  return (input.focusLogs ?? []).flatMap((log) => {
    const dateKey = log.dateKey ?? (Number.isFinite(log.startedAt) ? localDateKey(log.startedAt) : undefined);
    const durationMs = typeof log.durationMs === "number" && Number.isFinite(log.durationMs)
      ? log.durationMs
      : typeof log.startedAt === "number" && typeof log.endedAt === "number" ? log.endedAt - log.startedAt : 0;
    if (!tasks.has(log.taskId) || !validDateKey(dateKey) || !Number.isFinite(durationMs) || durationMs <= 0 || ids.has(log.id)) return [];
    ids.add(log.id);
    return [{ ...log, dateKey, durationMs }];
  }).sort((a, b) => a.dateKey.localeCompare(b.dateKey) || (a.startedAt ?? 0) - (b.startedAt ?? 0) || a.id.localeCompare(b.id));
}

function uniqueEvidence(items: StampEvidence[]): StampEvidence[] {
  return [...new Map(items.map((item) => [`${item.kind}:${item.id}`, item])).values()];
}

/** Evidence bodies are the original saved text, never generated observations. */
function evidenceFor(input: StampCollectionInput, logs: VerifiedLog[], explicitOutcomes?: readonly CatalogOutcome[]): StampEvidence[] {
  const dates = new Set(logs.map((log) => log.dateKey));
  const taskIds = new Set(logs.map((log) => log.taskId));
  const pairs = new Set(logs.map((log) => `${log.dateKey}:${log.taskId}`));
  const outcomes = explicitOutcomes ?? (input.outcomes ?? []).filter((outcome) => pairs.has(`${outcome.dateKey}:${outcome.taskId}`));
  const refs: StampEvidence[] = logs.map((log) => ({
    id: log.id, kind: "focus", dateKey: log.dateKey, taskId: log.taskId,
    title: input.tasks.find((task) => task.id === log.taskId)?.title ?? "真实投入",
    body: `${Math.floor(log.durationMs / 60_000)} 分 ${Math.floor(log.durationMs % 60_000 / 1000)} 秒的真实投入。${Number.isFinite(log.startedAt) ? `开始于 ${new Date(log.startedAt!).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}。` : ""}`,
  }));
  for (const task of input.tasks.filter((item) => taskIds.has(item.id))) refs.push({ id: task.id, kind: "task", dateKey: logs.find((log) => log.taskId === task.id)!.dateKey, taskId: task.id, title: task.title ?? "相关任务", body: task.expectedArtifact ?? `投入方向：${task.subject ?? task.kind ?? "自定义"}` });
  for (const outcome of outcomes) refs.push({ id: outcome.id, kind: "outcome", dateKey: outcome.dateKey ?? "", taskId: outcome.taskId, title: outcome.title ?? "保存的成果", body: outcome.body ?? "" });
  for (const note of input.notes ?? []) if (!note.archived && note.type !== "pause" && pairs.has(`${note.dateKey}:${note.taskId}`)) refs.push({ id: note.id, kind: "note", dateKey: note.dateKey!, taskId: note.taskId, title: note.title ?? "主动留下的便签", body: note.body ?? "" });
  for (const diary of input.diaries ?? []) if (dates.has(diary.dateKey) && diary.text.trim()) refs.push({ id: diary.id, kind: "diary", dateKey: diary.dateKey, title: "这一天的日记", body: diary.text });
  for (const dateKey of [...dates].sort()) {
    const echo = input.dailyEchoes?.[dateKey];
    if (echo?.status !== "confirmed") continue;
    const text = [...(echo.facts ?? []).map((item) => item.text), ...(echo.signals ?? []).map((item) => `${item.title}：${item.detail}`), ...(echo.sparkle?.text ? [echo.sparkle.text] : [])].filter(Boolean).join("\n\n");
    if (text) refs.push({ id: `echo-${dateKey}`, kind: "echo", dateKey, title: "已确认的每日回声", body: text });
  }
  return uniqueEvidence(refs);
}

function thresholdDate(logs: VerifiedLog[]): string | undefined {
  const totals = new Map<string, number>();
  for (const log of logs) totals.set(log.dateKey, (totals.get(log.dateKey) ?? 0) + log.durationMs);
  return [...totals.entries()].find(([, ms]) => ms >= DEFAULT_STAMP_UNIT_MS)?.[0];
}

/** Pure derived collection: never awards from task.actualMs, plans, or a legacy ledger. */
export function buildStampCollection(input: StampCollectionInput): CollectedStamp[] {
  const logs = verifiedLogs(input);
  const assignments = { ...input.stampBook?.styleAssignments, ...input.stampStyles };
  const result: CollectedStamp[] = TIME_STAMP_DEFINITIONS.map((definition) => {
    const matchingTasks = input.tasks.filter((task) => resolveStampStyle(task, assignments).icon === definition.iconType);
    const firstDates = matchingTasks.flatMap((task) => {
      const date = thresholdDate(logs.filter((log) => log.taskId === task.id));
      return date ? [{ taskId: task.id, date }] : [];
    }).sort((a, b) => a.date.localeCompare(b.date) || a.taskId.localeCompare(b.taskId));
    const first = firstDates[0];
    const earnedLogs = first ? logs.filter((log) => log.taskId === first.taskId && log.dateKey === first.date) : [];
    return { definition, earned: Boolean(first), firstEarnedDate: first?.date, reason: first ? `在「${input.tasks.find((task) => task.id === first.taskId)?.title ?? "相关任务"}」第一次留下了至少 10 分钟真实投入。` : undefined, evidence: evidenceFor(input, earnedLogs) };
  });

  const persistence = GROWTH_STAMP_DEFINITIONS[0];
  const qualifyingDates = [...new Set(logs.map((log) => log.dateKey))].filter((date) => logs.filter((log) => log.dateKey === date).reduce((sum, log) => sum + log.durationMs, 0) >= DEFAULT_STAMP_UNIT_MS).slice(0, 3);
  const persistent = qualifyingDates.length === 3;
  result.push({ definition: persistence, earned: persistent, firstEarnedDate: persistent ? qualifyingDates[2] : undefined, reason: persistent ? `在 ${qualifyingDates.join("、")} 都留下了至少 10 分钟真实投入。这些回来的日子，组成了你的积累。` : undefined, evidence: persistent ? evidenceFor(input, logs.filter((log) => qualifyingDates.includes(log.dateKey))) : [] });

  const themes = new Map<string, string>();
  for (const task of input.tasks) {
    const label = task.subject?.trim() || task.kind?.trim() || "自选方向";
    themes.set(label.toLocaleLowerCase(), label);
  }
  if (!themes.size) themes.set("自选方向", "自选方向");
  for (const [key, label] of themes) {
    const taskIds = new Set(input.tasks.filter((task) => (task.subject?.trim() || task.kind?.trim() || "自选方向").toLocaleLowerCase() === key).map((task) => task.id));
    const themeLogs = logs.filter((log) => taskIds.has(log.taskId));
    const firstDate = thresholdDate(themeLogs);
    const definition: StampDefinition = { key: `exploration:${key}`, name: `初航 · ${label}`, category: "exploration", meaning: `第一次真正走进「${label}」，从好奇迈向亲身尝试。`, triggerDescription: `首次在「${label}」方向，于同一天留下累计至少 10 分钟的真实投入记录。`, iconType: "mountain", artwork: explorationArtwork(label) };
    result.push({ definition, earned: Boolean(firstDate), firstEarnedDate: firstDate, reason: firstDate ? `${firstDate}，你第一次在「${label}」留下至少 10 分钟真实投入。` : undefined, evidence: firstDate ? evidenceFor(input, themeLogs.filter((log) => log.dateKey === firstDate)) : [] });
  }

  const completed = (input.outcomes ?? []).filter((item) => item.classification === "completed" && item.body?.trim() && validDateKey(item.dateKey)).slice().sort((a, b) => a.dateKey!.localeCompare(b.dateKey!) || (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id));
  const outcomeLogs = (outcome: CatalogOutcome) => logs.filter((log) => log.taskId === outcome.taskId && log.dateKey === outcome.dateKey);
  const hasFocus = (outcome: CatalogOutcome) => outcomeLogs(outcome).reduce((sum, log) => sum + log.durationMs, 0) >= DEFAULT_STAMP_UNIT_MS;
  const milestoneOutcome = completed.find((outcome) => hasFocus(outcome) && input.milestones?.some((milestone) => milestone.unlocked && milestone.unlockedByOutcomeId === outcome.id));
  const milestone = milestoneOutcome ? input.milestones?.find((item) => item.unlocked && item.unlockedByOutcomeId === milestoneOutcome.id) : undefined;
  result.push({ definition: GROWTH_STAMP_DEFINITIONS[1], earned: Boolean(milestoneOutcome), firstEarnedDate: milestoneOutcome?.dateKey, reason: milestone ? `你保存了完成成果，并确认抵达「${milestone.title}」。` : undefined, evidence: milestoneOutcome && milestone ? [...evidenceFor(input, outcomeLogs(milestoneOutcome), [milestoneOutcome]), { id: milestone.id, kind: "milestone", dateKey: milestoneOutcome.dateKey!, title: milestone.title, body: milestone.criteria ?? "由保存的完成成果确认。" }] : [] });

  const reflectedOutcome = completed.find((outcome) => hasFocus(outcome) && input.diaries?.some((diary) => diary.dateKey === outcome.dateKey && diary.text.trim()));
  result.push({ definition: GROWTH_STAMP_DEFINITIONS[2], earned: Boolean(reflectedOutcome), firstEarnedDate: reflectedOutcome?.dateKey, reason: reflectedOutcome ? `${reflectedOutcome.dateKey}，你留下真实投入和已完成的成果，也用日记回望了这一天。` : undefined, evidence: reflectedOutcome ? evidenceFor(input, outcomeLogs(reflectedOutcome), [reflectedOutcome]) : [] });
  return result;
}
