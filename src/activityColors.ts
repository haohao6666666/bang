import type { StampGroup } from "./stampBook";

// Activity colors are independent of historical stamp customization. The same
// source keeps its meaning and color in day, week, and month views.
const ACTIVITY_PALETTE = ["#71966b", "#648dae", "#ae819f", "#c99855", "#659c96", "#b9866d", "#8a80ab"] as const;

export function activityColor(subject: string): string {
  const source = subject.trim().toLowerCase();
  const colorFor = (value: string): string | undefined => {
    if (/语文|中文|国文|chinese/.test(value)) return "#c77e74";
    if (/数学|math|algebra|geometry/.test(value)) return "#648dae";
    if (/物理|化学|实验|physics|chemistry|science|\blab\b/.test(value)) return "#6b9d97";
    if (/英语|英文|外语|english|language|\ben\b/.test(value)) return "#9380ad";
    if (/写作|作文|writing|\bpen\b/.test(value)) return "#b77f99";
    if (/阅读|论文|科研|reading|literature|research/.test(value)) return "#71966b";
    if (/运动|锻炼|跑步|sport|workout|running|exercise/.test(value)) return "#c99855";
    if (/编程|代码|coding|programming/.test(value)) return "#659c96";
    if (/绘画|画画|设计|drawing|painting|design/.test(value)) return "#be8b73";
    if (/音乐|乐器|music/.test(value)) return "#ae819f";
    if (/休息|睡眠|rest|sleep/.test(value)) return "#9795b3";
    if (/生活|咖啡|life|coffee/.test(value)) return "#af8b6d";
    if (/兴趣|爱好|interest|hobby/.test(value)) return "#c78f67";
    return undefined;
  };
  const semantic = colorFor(source);
  if (semantic) return semantic;
  let hash = 0;
  for (const char of source || "自定义") hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return ACTIVITY_PALETTE[hash % ACTIVITY_PALETTE.length];
}

export type ActivityDistribution = {
  key: string;
  label: string;
  actualMs: number;
  color: string;
  percentage: number;
};

export function buildActivityDistribution(groups: readonly Pick<StampGroup, "subject" | "taskKind" | "actualMs">[]): {
  totalMs: number;
  activities: ActivityDistribution[];
} {
  const bySubject = new Map<string, Omit<ActivityDistribution, "percentage">>();
  for (const group of groups) {
    if (!Number.isFinite(group.actualMs) || group.actualMs <= 0) continue;
    const label = group.subject.trim().replace(/\s+/g, " ") || "自定义";
    const key = label.toLowerCase();
    const existing = bySubject.get(key);
    if (existing) existing.actualMs += group.actualMs;
    else bySubject.set(key, { key, label, actualMs: group.actualMs, color: activityColor(label) });
  }
  const totalMs = [...bySubject.values()].reduce((sum, entry) => sum + entry.actualMs, 0);
  const activities = [...bySubject.values()]
    .sort((a, b) => b.actualMs - a.actualMs || a.key.localeCompare(b.key, "zh-CN"))
    .map((entry) => ({ ...entry, percentage: entry.actualMs / totalMs * 100 }));
  return { totalMs, activities };
}

export function formatActivityDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) return `${seconds} 秒`;
  return remainder ? `${minutes} 分 ${remainder} 秒` : `${minutes} 分钟`;
}

export function formatActivityPercentage(value: number): string {
  return value > 0 && value < 1 ? "<1%" : `${Math.round(value)}%`;
}
