/**
 * 印迹册的数据层。
 *
 * 这里故意不依赖 React，也不依赖页面状态。印章只是 FocusLog、任务计划、
 * 成果和用户便签的一个确定性视图；计时和日期仍然由宿主状态负责。未来的
 * Agent 可以读取 StampBookPage，但不能参与印章数量、日期或样式的计算。
 */

export const STAMP_BOOK_VERSION = 5 as const;
export const DEFAULT_STAMP_UNIT_MS = 10 * 60_000;

export type StampOutline = "plain" | "round" | "scallop" | "ticket" | "seal";
export type StampIcon =
  | "source"
  | "book"
  | "atom"
  | "flask"
  | "english"
  | "leaf"
  | "pen"
  | "mountain"
  | "coffee"
  | "spark";
export type StampColor = "ink" | "coral" | "blue" | "sage" | "violet" | "amber" | "brown";

/** 固定来源印章的兼容结构；旧版本可继续读取历史样式，但新 UI 不再提供 DIY 入口。 */
export type StampStyleChoice = {
  presetId: string;
  outline: StampOutline;
  color: StampColor;
  icon: StampIcon;
  /** source-only 样式显示任务/来源名称，不额外显示图标。 */
  showSource: boolean;
};

export type StampStyleAssignment = StampStyleChoice & {
  /** 默认按 subject 归类，也允许产品改为按 task kind 归类。 */
  scopeKey: string;
  selectedAt: number;
};

/** 仅用于兼容历史存档的样式值；产品文案统一定义于 stampDefinitions.ts。 */
const LEGACY_STAMP_STYLES: readonly StampStyleChoice[] = [
  {
    presetId: "source-only",
    outline: "plain",
    color: "ink",
    icon: "source",
    showSource: true,
  },
  {
    presetId: "study-book",
    outline: "round",
    color: "coral",
    icon: "book",
    showSource: true,
  },
  {
    presetId: "science-atom",
    outline: "scallop",
    color: "blue",
    icon: "atom",
    showSource: true,
  },
  {
    presetId: "botanical-leaf",
    outline: "seal",
    color: "sage",
    icon: "leaf",
    showSource: true,
  },
  {
    presetId: "quiet-spark",
    outline: "ticket",
    color: "amber",
    icon: "spark",
    showSource: true,
  },
];

export type StampTaskLike = {
  id: string;
  title?: string;
  subject?: string;
  kind?: string;
  planMinutes?: number;
  /** 仅用于迁移或今天的显式快照；历史日期应优先使用 FocusLog。 */
  actualMs?: number;
  actualMinutes?: number;
};

export type StampFocusLogLike = {
  id: string;
  dateKey?: string;
  taskId: string;
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;
};

export type StampOutcomeLike = {
  id: string;
  taskId?: string;
  dateKey?: string;
  body?: string;
  title?: string;
  classification?: string;
};

export type StampNoteLike = {
  id: string;
  taskId?: string;
  dateKey?: string;
  title?: string;
  body?: string;
  type?: string;
  archived?: boolean;
};

export type StampEventKind = "focus" | "outcome" | "note";
export type StampEventRef = {
  id: string;
  kind: StampEventKind;
  taskId: string;
  title?: string;
  body?: string;
};

export type StampGroup = {
  id: string;
  dateKey: string;
  taskId: string;
  taskTitle: string;
  subject: string;
  taskKind: string;
  style: StampStyleChoice;
  actualMs: number;
  plannedMs: number;
  stampUnitMs: number;
  actualStampCount: number;
  actualRemainderMs: number;
  plannedStampCount: number;
  plannedRemainderMs: number;
  focusLogIds: string[];
  outcomeIds: string[];
  noteIds: string[];
  /** 一组时间印章只对应一份可展开的来源便签/成果，不重复生成事件。 */
  eventRefs: StampEventRef[];
};

export type StampBookPage = {
  dateKey: string;
  totalMs: number;
  plannedMs: number;
  totalActualStampCount: number;
  totalPlannedStampCount: number;
  totalRemainderMs: number;
  groups: StampGroup[];
  /** 没有 FocusLog 的旧记录只能展示总量，不能伪造具体时间来源。 */
  legacyApproximate: boolean;
};

export type StampBookBuildInput = {
  dateKey: string;
  tasks: readonly StampTaskLike[];
  focusLogs?: readonly StampFocusLogLike[];
  /** 对“今天”传入包含当前运行片段的任务快照，历史日期不要传全局累计值。 */
  actualMsByTask?: Readonly<Record<string, number>>;
  outcomes?: readonly StampOutcomeLike[];
  notes?: readonly StampNoteLike[];
  styleAssignments?: Readonly<Record<string, StampStyleChoice | StampStyleAssignment>>;
  stampUnitMs?: number;
};

export function localDateKey(timestamp = Date.now()): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function styleScopeKey(task: Pick<StampTaskLike, "subject" | "kind">): string {
  const source = String(task.subject || task.kind || "custom").trim().toLowerCase();
  return source.replace(/\s+/g, "-") || "custom";
}

export function presetStampStyle(presetId = "source-only"): StampStyleChoice {
  const preset = LEGACY_STAMP_STYLES.find((item) => item.presetId === presetId) ?? LEGACY_STAMP_STYLES[0];
  return { presetId: preset.presetId, outline: preset.outline, color: preset.color, icon: preset.icon, showSource: preset.showSource };
}

export function resolveStampStyle(
  task: Pick<StampTaskLike, "id" | "subject" | "kind">,
  assignments?: Readonly<Record<string, StampStyleChoice | StampStyleAssignment>>,
): StampStyleChoice {
  const assignment = assignments?.[`task:${task.id}`] ?? assignments?.[styleScopeKey(task)];
  if (!assignment) return stampSourcePreset(task);
  const preset = presetStampStyle(assignment.presetId);
  return {
    ...preset,
    ...assignment,
    presetId: assignment.presetId || preset.presetId,
  };
}

/**
 * 固定的来源印章。印迹册不再要求用户 DIY；样式由任务来源确定，保证同一
 * 类记录在日期卡和单日纸页里始终保持一致。动态文字、日期和数量仍由 UI
 * 代码绘制，图形只作为一个轻量的语义提示。
 */
export function stampSourcePreset(task: Pick<StampTaskLike, "subject" | "kind">): StampStyleChoice {
  const source = `${String(task.subject ?? "")} ${String(task.kind ?? "")}`.trim().toLowerCase();
  const match = (pattern: RegExp) => pattern.test(source);
  const fixed = (presetId: string, color: StampColor, icon: StampIcon): StampStyleChoice => ({
    presetId,
    outline: "plain",
    color,
    icon,
    showSource: true,
  });

  if (match(/语文|中文|国文|chinese/)) return fixed("source-language", "coral", "book");
  if (match(/数学|math|algebra|geometry/)) return fixed("source-math", "blue", "atom");
  if (match(/物理|physics|实验|lab|science/)) return fixed("source-physics", "sage", "flask");
  if (match(/英语|英文|english|\ben\b/)) return fixed("source-english", "violet", "english");
  if (match(/兴趣|爱好|interest|hobby/)) return fixed("source-interest", "sage", "leaf");
  if (match(/写作|作文|writing|pen/)) return fixed("source-writing", "violet", "pen");
  if (match(/阅读|论文|科研|reading|literature|research/)) return fixed("source-reading", "sage", "mountain");
  if (match(/生活|休息|运动|life|coffee|rest/)) return fixed("source-life", "brown", "coffee");
  return presetStampStyle();
}

function normalizedLogDate(log: StampFocusLogLike): string | undefined {
  if (log.dateKey) return log.dateKey;
  if (typeof log.startedAt === "number" && Number.isFinite(log.startedAt)) return localDateKey(log.startedAt);
  return undefined;
}

function durationOfLog(log: StampFocusLogLike): number {
  if (typeof log.durationMs === "number" && Number.isFinite(log.durationMs)) return Math.max(0, log.durationMs);
  if (typeof log.startedAt === "number" && typeof log.endedAt === "number") return Math.max(0, log.endedAt - log.startedAt);
  return 0;
}

function minutesToMs(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number * 60_000) : 0;
}

export function stampCounts(actualMs: number, plannedMs: number, stampUnitMs = DEFAULT_STAMP_UNIT_MS) {
  const unit = Math.max(1, stampUnitMs);
  const actual = Math.max(0, Math.round(actualMs));
  const planned = Math.max(0, Math.round(plannedMs));
  return {
    actualStampCount: Math.floor(actual / unit),
    actualRemainderMs: actual % unit,
    plannedStampCount: Math.ceil(planned / unit),
    plannedRemainderMs: planned % unit,
  };
}

function eventRefsForGroup(
  taskId: string,
  logs: readonly StampFocusLogLike[],
  outcomes: readonly StampOutcomeLike[],
  notes: readonly StampNoteLike[],
): StampEventRef[] {
  const refs: StampEventRef[] = logs.map((item) => ({ id: item.id, kind: "focus", taskId }));
  refs.push(...outcomes.map((item) => ({ id: item.id, kind: "outcome" as const, taskId, title: item.title, body: item.body })));
  refs.push(...notes.map((item) => ({ id: item.id, kind: "note" as const, taskId, title: item.title, body: item.body })));
  return refs;
}

/** 将某一天的真实投入聚合为印章组。 */
export function buildStampBookPage(input: StampBookBuildInput): StampBookPage {
  const unit = Math.max(1, input.stampUnitMs ?? DEFAULT_STAMP_UNIT_MS);
  const logsForDate = (input.focusLogs ?? []).filter((log) => normalizedLogDate(log) === input.dateKey);
  const outcomes = (input.outcomes ?? []).filter((item) => item.dateKey === input.dateKey);
  const notes = (input.notes ?? []).filter((item) => item.dateKey === input.dateKey && !item.archived && item.type !== "pause");
  const logMsByTask = new Map<string, number>();
  for (const log of logsForDate) logMsByTask.set(log.taskId, (logMsByTask.get(log.taskId) ?? 0) + durationOfLog(log));
  const hasExplicitActual = Boolean(input.actualMsByTask);
  const groups: StampGroup[] = [];
  for (const task of input.tasks) {
    const actualMs = hasExplicitActual
      ? Math.max(0, Number(input.actualMsByTask?.[task.id] ?? 0))
      : (logMsByTask.get(task.id) ?? 0);
    const plannedMs = minutesToMs(task.planMinutes);
    const taskLogs = logsForDate.filter((log) => log.taskId === task.id);
    const taskOutcomes = outcomes.filter((item) => item.taskId === task.id);
    const taskNotes = notes.filter((item) => item.taskId === task.id);
    // 计划本身不构成足迹：历史日期只有真实投入或用户主动留下的记录才出现。
    if (actualMs <= 0 && taskLogs.length === 0 && taskOutcomes.length === 0 && taskNotes.length === 0) continue;
    const counts = stampCounts(actualMs, plannedMs, unit);
    groups.push({
      id: `stamp-group-${input.dateKey}-${task.id}`,
      dateKey: input.dateKey,
      taskId: task.id,
      taskTitle: task.title ?? "未命名任务",
      subject: task.subject ?? task.kind ?? "自定义",
      taskKind: task.kind ?? "custom",
      style: resolveStampStyle(task, input.styleAssignments),
      actualMs,
      plannedMs,
      stampUnitMs: unit,
      ...counts,
      focusLogIds: taskLogs.map((item) => item.id),
      outcomeIds: taskOutcomes.map((item) => item.id),
      noteIds: taskNotes.map((item) => item.id),
      eventRefs: eventRefsForGroup(task.id, taskLogs, taskOutcomes, taskNotes),
    });
  }
  const totalMs = groups.reduce((sum, group) => sum + group.actualMs, 0);
  const plannedMs = groups.reduce((sum, group) => sum + group.plannedMs, 0);
  return {
    dateKey: input.dateKey,
    totalMs,
    plannedMs,
    totalActualStampCount: groups.reduce((sum, group) => sum + group.actualStampCount, 0),
    totalPlannedStampCount: groups.reduce((sum, group) => sum + group.plannedStampCount, 0),
    totalRemainderMs: groups.reduce((sum, group) => sum + group.actualRemainderMs, 0),
    groups,
    legacyApproximate: logsForDate.length === 0 && totalMs > 0,
  };
}

export type StampBookPagesInput = Omit<StampBookBuildInput, "dateKey"> & { dateKeys: readonly string[] };

export function buildStampBookPages(input: StampBookPagesInput): StampBookPage[] {
  return [...new Set(input.dateKeys.filter(Boolean))]
    .sort((a, b) => b.localeCompare(a))
    .map((dateKey) => buildStampBookPage({ ...input, dateKey }));
}

export function deriveStampBookDateKeys(input: {
  focusLogs?: readonly StampFocusLogLike[];
  outcomes?: readonly StampOutcomeLike[];
  notes?: readonly StampNoteLike[];
  diaries?: readonly { dateKey?: string }[];
}): string[] {
  const keys = new Set<string>();
  for (const log of input.focusLogs ?? []) { const key = normalizedLogDate(log); if (key) keys.add(key); }
  for (const item of [...(input.outcomes ?? []), ...(input.diaries ?? [])]) if (item.dateKey) keys.add(item.dateKey);
  for (const item of input.notes ?? []) if (item.dateKey && !item.archived && item.type !== "pause") keys.add(item.dateKey);
  return [...keys].sort((a, b) => b.localeCompare(a));
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? value as UnknownRecord : {};
}

function normalizeTaskForMigration(item: UnknownRecord, index: number): UnknownRecord {
  const actualMs = Number(item.actualMs ?? minutesToMs(item.actualMinutes));
  return {
    ...item,
    id: String(item.id ?? `legacy-task-${index}`),
    actualMs: Number.isFinite(actualMs) ? Math.max(0, actualMs) : 0,
    planMinutes: Number(item.planMinutes ?? String(item.duration ?? "").match(/\d+/)?.[0] ?? 10),
  };
}

function normalizeLegacyLog(item: UnknownRecord, index: number): UnknownRecord {
  const startedAt = Number(item.startedAt);
  const endedAt = Number(item.endedAt);
  const rawDuration = Number(item.durationMs);
  const durationMs = Number.isFinite(rawDuration) ? Math.max(0, rawDuration) : (Number.isFinite(startedAt) && Number.isFinite(endedAt) ? Math.max(0, endedAt - startedAt) : 0);
  return {
    ...item,
    id: String(item.id ?? `legacy-focus-${index}`),
    taskId: String(item.taskId ?? ""),
    dateKey: String(item.dateKey ?? (Number.isFinite(startedAt) ? localDateKey(startedAt) : localDateKey())),
    startedAt: Number.isFinite(startedAt) ? startedAt : Date.now(),
    endedAt: Number.isFinite(endedAt) ? endedAt : Date.now(),
    durationMs,
  };
}

function normalizeLegacyNote(item: UnknownRecord, index: number): UnknownRecord {
  const createdAt = Number(item.createdAt);
  const type = String(item.type ?? "result");
  return {
    ...item,
    id: String(item.id ?? `legacy-note-${index}`),
    type,
    dateKey: String(item.dateKey ?? (Number.isFinite(createdAt) ? localDateKey(createdAt) : localDateKey())),
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    /** 自动暂停保留在数据中供分析使用，但不显示为印迹事件。 */
    archived: type === "pause" ? true : Boolean(item.archived),
  };
}

/**
 * 将 v4 状态转成 v5 可保存结构。此函数保留未知字段，方便宿主继续保存
 * diaries、echoes、milestones 等产品字段；只规范印迹册所需的字段。
 */
export function migrateV4ToV5(raw: unknown): UnknownRecord & {
  version: 5;
  stampStyles: Record<string, StampStyleChoice>;
} {
  const source = record(raw);
  const rawTasks = Array.isArray(source.tasks) ? source.tasks : [];
  const tasks = rawTasks.map((item, index) => normalizeTaskForMigration(record(item), index));
  const rawLogs = Array.isArray(source.focusLogs) ? source.focusLogs : [];
  const focusLogs = rawLogs.map((item, index) => normalizeLegacyLog(record(item), index));
  const focusLedgerSource = record(source.focusLedger);
  const focusLedger: Record<string, number> = {};
  for (const task of tasks) {
    const id = String(task.id);
    const legacyLedger = Number(focusLedgerSource[id]);
    const actualMs = Number(task.actualMs);
    focusLedger[id] = Number.isFinite(legacyLedger) ? Math.max(0, legacyLedger) : (Number.isFinite(actualMs) ? Math.max(0, actualMs) : 0);
  }
  const rawNotes = Array.isArray(source.notes) ? source.notes : [];
  const legacyEchoes = Array.isArray(source.echoes) ? source.echoes : [];
  const notes = [
    ...rawNotes.map((item, index) => normalizeLegacyNote(record(item), index)),
    ...legacyEchoes.map((item, index) => normalizeLegacyNote({ ...record(item), id: `legacy-echo-${String(record(item).id ?? index)}`, type: "result" }, rawNotes.length + index)),
  ];
  const rawOutcomes = Array.isArray(source.outcomes) ? source.outcomes : [];
  const outcomes = rawOutcomes.map((item) => {
    const outcome = record(item);
    const createdAt = Number(outcome.createdAt);
    return { ...outcome, dateKey: String(outcome.dateKey ?? (Number.isFinite(createdAt) ? localDateKey(createdAt) : localDateKey())) };
  });
  const existingStyles = record(source.stampStyles);
  const existingBook = record(source.stampBook);
  const bookStyles = record(existingBook.styleAssignments);
  const stampStyles: Record<string, StampStyleChoice> = {};
  for (const [scope, value] of Object.entries({ ...bookStyles, ...existingStyles })) {
    const item = record(value);
    const preset = presetStampStyle(String(item.presetId ?? "source-only"));
    stampStyles[scope] = { ...preset, ...item, presetId: String(item.presetId ?? preset.presetId) } as StampStyleChoice;
  }
  return {
    ...source,
    version: STAMP_BOOK_VERSION,
    tasks,
    focusLogs,
    focusLedger,
    notes,
    outcomes,
    stampStyles,
    stampBook: { ...existingBook, version: STAMP_BOOK_VERSION, styleAssignments: stampStyles },
  };
}
