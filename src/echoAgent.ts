/**
 * Boundary between the local 迹向 product state and a future language-model
 * adapter.  This module deliberately contains no network client and never
 * mutates tasks, timers, dates, or user records.
 */

export type EchoSignalType = "friction" | "startup" | "interest" | "question" | "progress";
export type EchoDraftStatus = "draft" | "confirmed" | "hidden";

export type EvidenceRef = {
  id: string;
  dateKey: string;
  kind: "task" | "focus" | "outcome" | "diary" | "note" | "bookmark";
};

export type DailyEchoInput = {
  dateKey: string;
  timezone: string;
  diaryText: string;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    plannedMinutes: number;
    actualMinutes: number;
    outcomeId?: string;
  }>;
  outcomes: Array<{ id: string; body: string; classification: string; evidenceRefs: EvidenceRef[] }>;
  blockers: Array<{ id: string; label: string; evidenceRefs: EvidenceRef[] }>;
  authorisedBookmarks: Array<{ id: string; title: string; excerpt: string; url: string; savedAt: number }>;
};

export type DailyEchoDraft = {
  status: EchoDraftStatus;
  sourceNote?: string;
  quiet: boolean;
  facts: Array<{ id: string; text: string; evidenceRefs: EvidenceRef[] }>;
  signals: Array<{
    id: string;
    type: EchoSignalType;
    title: string;
    detail: string;
    confidence: number;
    needsExternal: boolean;
    evidenceRefs: EvidenceRef[];
  }>;
  sparkle: { id: string; text: string; evidenceRefs: EvidenceRef[] } | null;
  externalMatches: Array<{
    bookmarkId: string;
    whyRelevant: string;
    excerpt: string;
    savedAt: number;
    url: string;
    evidenceRefs: EvidenceRef[];
    usefulPart?: string;
    applicableWhen?: string;
    limitation?: string;
  }>;
  tomorrowExperiments: Array<{
    id: string;
    title: string;
    why: string;
    stopCondition?: string;
    evidenceRefs: EvidenceRef[];
  }>;
};

export type WeeklyEchoDraft = {
  status: EchoDraftStatus;
  rangeStart: string;
  rangeEnd: string;
  observations: Array<{ id: string; text: string; evidenceDates: string[] }>;
};

export type EchoAgentAdapter = {
  generateDailyEcho(input: DailyEchoInput): Promise<DailyEchoDraft>;
  generateWeeklyEcho(input: { rangeStart: string; rangeEnd: string; days: DailyEchoInput[] }): Promise<WeeklyEchoDraft>;
};

export function localDateKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function weeklyEchoEligibility(dateKeys: string[], timestamp = Date.now()) {
  return weeklyEchoDates(dateKeys, timestamp).length >= 3;
}

/** Returns the diary dates in the seven-day cycle containing `timestamp`. */
export function weeklyEchoDates(dateKeys: string[], timestamp = Date.now()) {
  const unique = [...new Set(dateKeys.filter(Boolean))].sort();
  if (!unique.length) return [];
  const first = new Date(`${unique[0]}T12:00:00`);
  const current = new Date(timestamp);
  const day = 24 * 60 * 60 * 1000;
  const offset = Math.max(0, Math.floor((current.getTime() - first.getTime()) / day));
  const cycleStart = new Date(first.getTime() + Math.floor(offset / 7) * 7 * day);
  const cycleEnd = new Date(cycleStart.getTime() + 6 * day);
  const startKey = localDateKey(cycleStart.getTime());
  const endKey = localDateKey(cycleEnd.getTime());
  return unique.filter((dateKey) => dateKey >= startKey && dateKey <= endKey);
}

export function filterWeeklyObservations(observations: WeeklyEchoDraft["observations"]) {
  return observations.filter((observation) => new Set(observation.evidenceDates).size >= 2);
}

export function emptyDailyEcho(status: EchoDraftStatus = "draft"): DailyEchoDraft {
  return {
    status,
    quiet: true,
    facts: [],
    signals: [],
    sparkle: null,
    externalMatches: [],
    tomorrowExperiments: [],
  };
}
