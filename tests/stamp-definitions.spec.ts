import { expect, test } from "@playwright/test";
import { buildStampCollection, resolveTimeStampDefinition, stampAsset, type StampCollectionInput } from "../src/stampDefinitions";
import { buildStampBookPage, migrateV4ToV5, presetStampStyle } from "../src/stampBook";

const minute = 60_000;
const task = { id: "reading", subject: "科研阅读", kind: "reading", title: "读论文", actualMs: 90 * minute };
const log = (id: string, dateKey: string, durationMs = 10 * minute) => ({ id, taskId: task.id, dateKey, durationMs });
const entry = (data: StampCollectionInput, key: string) => buildStampCollection(data).find((item) => item.definition.key === key)!;

test("invalid, duplicate and orphan logs cannot fabricate acquisition", () => {
  const data = { tasks: [task], focusLogs: [log("a", "2026-10-01", 5 * minute), log("a", "2026-10-01", 5 * minute), log("b", "2026-02-30"), log("c", "2026-10-01", -minute), { ...log("d", "2026-10-01"), taskId: "deleted" }] };
  expect(buildStampCollection(data).every((item) => !item.earned)).toBe(true);
});

test("persistence counts distinct non-consecutive dates and is independent of input order", () => {
  const logs = [log("c", "2026-10-09"), log("a", "2026-10-01"), log("b", "2026-10-05")];
  const result = entry({ tasks: [task], focusLogs: logs }, "persistence:return");
  expect(result.firstEarnedDate).toBe("2026-10-09");
  expect(entry({ tasks: [task], focusLogs: [...logs].reverse() }, "persistence:return")).toEqual(result);
});

test("catalog and calendar resolve the same migrated historical style", () => {
  const style = presetStampStyle("science-atom");
  const data = { tasks: [task], focusLogs: [log("a", "2026-10-01")], stampStyles: { "task:reading": style } };
  const group = buildStampBookPage({ ...data, dateKey: "2026-10-01", styleAssignments: data.stampStyles }).groups[0];
  const definition = resolveTimeStampDefinition(group);
  expect(definition.key).toBe("time:atom");
  expect(entry(data, definition.key).earned).toBe(true);
  expect(entry(data, "time:mountain").earned).toBe(false);
});

test("growth links original evidence, includes confirmed echoes and excludes hidden echoes", () => {
  const data: StampCollectionInput = { tasks: [task], focusLogs: [log("a", "2026-10-01")], outcomes: [{ id: "o", taskId: task.id, dateKey: "2026-10-01", classification: "completed", body: "我的原始成果" }], diaries: [{ id: "d", dateKey: "2026-10-01", text: "我的原始日记" }], dailyEchoes: { "2026-10-01": { status: "confirmed", sparkle: { text: "已确认的回声原文" } } } };
  const result = entry(data, "growth:reflection");
  expect(result.firstEarnedDate).toBe("2026-10-01");
  expect(result.evidence.filter((item) => item.kind === "echo").map((item) => item.body)).toEqual(["已确认的回声原文"]);
  expect(result.evidence.find((item) => item.id === "d")?.body).toBe("我的原始日记");
  const hidden = { ...data, dailyEchoes: { "2026-10-01": { status: "hidden", sparkle: { text: "隐藏文字" } } } };
  expect(entry(hidden, "growth:reflection").evidence.some((item) => item.kind === "echo")).toBe(false);
  expect(entry({ ...data, focusLogs: [] }, "growth:reflection").earned).toBe(false);
});

test("legacy migration preserves all recorded product evidence", () => {
  const raw = { version: 4, tasks: [task], focusLogs: [log("a", "2026-10-01")], outcomes: [{ id: "o", dateKey: "2026-10-01", body: "成果" }], diaries: [{ id: "d", dateKey: "2026-10-01", text: "日记" }], dailyEchoes: { "2026-10-01": { status: "confirmed" } }, preferences: { reduceMotion: true }, stampBook: { pendingSetup: { taskId: task.id } } };
  const migrated = migrateV4ToV5(raw);
  expect(migrated.diaries).toEqual(raw.diaries);
  expect(migrated.dailyEchoes).toEqual(raw.dailyEchoes);
  expect(migrated.preferences).toEqual(raw.preferences);
  expect((migrated.focusLogs as Array<{ durationMs: number }>)[0].durationMs).toBe(10 * minute);
});

test("milestone and growth artwork are distinct from the time stamps sharing their old icon", () => {
  const catalog = buildStampCollection({ tasks: [task] });
  for (const key of ["persistence:return", "breakthrough:milestone", "growth:reflection"]) {
    const collectible = catalog.find((item) => item.definition.key === key)!;
    const time = catalog.find((item) => item.definition.category === "time" && item.definition.iconType === collectible.definition.iconType)!;
    expect(stampAsset(collectible.definition)).not.toEqual(stampAsset(time.definition));
    expect(collectible.earned).toBe(false);
    expect(collectible.evidence).toEqual([]);
  }
});

test("exploration artwork follows the theme and safely handles a new custom theme", () => {
  const subjects = ["科研阅读", "数学", "兴趣", "星空观测"];
  const data = { tasks: subjects.map((subject, index) => ({ ...task, id: String(index), subject })) };
  const exploration = buildStampCollection(data).filter((item) => item.definition.category === "exploration");
  expect(exploration.map((item) => item.definition.artwork)).toEqual(["exploration-research", "exploration-math", "exploration-interest", "exploration-journey"]);
  expect(new Set(exploration.map((item) => stampAsset(item.definition))).size).toBe(4);
  expect(exploration.every((item) => !item.earned)).toBe(true);
  expect(entry({ tasks: [{ ...task, subject: "阅读" }] }, "exploration:阅读").definition.artwork).toBe("exploration-research");
});
