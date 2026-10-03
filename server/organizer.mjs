import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { text, list, dateKey, normalizeSnapshot, ServiceError } from './validation.mjs';

const read = async (file, fallback) => { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; } };
const write = async (file, value) => { await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 }); const tmp = `${file}.${randomUUID()}.tmp`; await fs.writeFile(tmp, JSON.stringify(value), { mode: 0o600 }); await fs.rename(tmp, file); };
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const short = value => text(value, 220).split(/(?<=[。！？!?])\s*/).slice(0, 2).join('');
const acceptable = value => value && !/成长信号|可追溯投入|基于分析|资料不足/.test(value);

/** Durable coalesced jobs. Local saves never wait for providers. */
export function createOrganizer({ dataDir, memory, review, draw, env = {}, delay = 5000 }) {
  const file = path.join(dataDir, 'background.json');
  const empty = () => ({ version: 1, jobs: {}, reviews: [], spent: {}, blockedDates: [], epoch: 0 });
  let timer, busy = false, tail = Promise.resolve();
  const serial = fn => { const next = tail.then(fn); tail = next.catch(() => {}); return next; };
  const db = () => read(file, empty());
  const cap = Math.max(0, Number(env.JIXIANG_DAILY_BUDGET_CNY ?? 3));
  const costs = { text: Math.max(.01, Number(env.JIXIANG_TEXT_MAX_COST_CNY ?? .1)), image: Math.max(.01, Number(env.JIXIANG_IMAGE_MAX_COST_CNY ?? 1)) };
  async function reserve(kind) {
    return serial(async () => {
      const data = await db(), day = new Date().toISOString().slice(0, 10), usage = data.spent[day] || { cost: 0, text: 0, image: 0 };
      if (usage.cost + costs[kind] > cap || usage[kind] >= (kind === 'image' ? 2 : 20)) throw new ServiceError('今天先收好已有的记录。', 429);
      data.spent = Object.fromEntries(Object.entries(data.spent).slice(-30));
      data.spent[day] = { ...usage, cost: Math.round((usage.cost + costs[kind]) * 10000) / 10000, [kind]: usage[kind] + 1 };
      await write(file, data);
    });
  }
  function wake(ms = delay) { clearTimeout(timer); timer = setTimeout(() => { void run().catch(() => {}); }, ms); timer.unref?.(); }
  async function saveIfCurrent(job, patch) {
    return serial(async () => { const data = await db(); const current = data.jobs[job.id]; if (!current || data.epoch !== job.epoch || current.fingerprint !== job.fingerprint) return false; data.jobs[job.id] = { ...current, ...patch }; await write(file, data); return true; });
  }
  async function run() {
    if (busy) { wake(); return; }
    if (!(await memory.settings()).enabled) return;
    busy = true;
    try {
      const data = await db();
      const job = Object.values(data.jobs).find(job => job.status === 'pending' && job.nextAt <= Date.now());
      if (!job) { const pending = Object.values(data.jobs).filter(job => job.status === 'pending'); if (pending.length) wake(Math.max(100, Math.min(...pending.map(job => job.nextAt)) - Date.now())); return; }
      try {
        if (!job.reviewDone && job.finalize) {
          await reserve('text');
          const raw = await review(job.snapshot);
          const summary = short(raw?.text), ids = list(raw?.evidenceIds, 8).filter(id => job.snapshot.evidence.some(row => row.id === id));
          const references = list(raw?.references, 2).flatMap(item => { const source = job.snapshot.bookmarks.find(row => row.id === item?.bookmarkId); const quote = text(item?.quote, 180); return source && quote && source.excerpt.includes(quote) ? [{ title: source.title, url: source.url, quote }] : []; });
          if (acceptable(summary) && ids.length) await serial(async () => { const latest = await db(); if (latest.epoch !== job.epoch || latest.jobs[job.id]?.fingerprint !== job.fingerprint) return; const record = { id: job.id, taskId: job.taskId, dateKey: job.dateKey, text: summary, evidenceIds: ids, references, source: 'companion', createdAt: Date.now() }; latest.reviews = [...latest.reviews.filter(row => row.id !== job.id), record]; await write(file, latest); });
          await saveIfCurrent(job, { reviewDone: true });
        }
        if (!job.stampDone && !data.blockedDates.includes(job.dateKey)) {
          // Provider calls are bounded even when a synchronous provider fails mid-flight.
          const body = { automatic: true, dateKey: job.dateKey, sourceTaskId: job.taskId, eventKey: job.id, snapshot: { ...job.snapshot, bookmarks: [] }, evidenceIds: job.snapshot.evidence.map(row => row.id), brief: job.snapshot.evidence.slice(-3).map(row => row.text).join('；').slice(0, 400) };
          const stamp = await draw(body);
          const current = await db();
          if (current.epoch !== job.epoch || !current.jobs[job.id]) { await draw({ remove: true, dateKey: job.dateKey }); return; }
          await saveIfCurrent(job, { stampDone: true, stampId: stamp?.stamp?.id });
        }
        await saveIfCurrent(job, { status: 'done' });
      } catch (error) {
        const attempts = (job.attempts || 0) + 1;
        await saveIfCurrent(job, { attempts, status: attempts >= 3 || error?.status === 429 ? 'waiting' : 'pending', nextAt: Date.now() + Math.min(600000, 30000 * 2 ** attempts) });
      }
    } finally { busy = false; wake(); }
  }
  return {
    reserve,
    enqueue: body => serial(async () => {
      if (!(await memory.settings()).enabled) return { accepted: false };
      const date = dateKey(body.dateKey), taskId = text(body.taskId, 180) || 'unlinked';
      const normalized = normalizeSnapshot(body.snapshot);
      const evidence = normalized.evidence.filter(row => ['outcome', 'note', 'diary'].includes(row.kind) && row.dateKey === date && row.text.length >= 4).slice(-12).map(row => ({ ...row, text: row.text.slice(0, 500) }));
      if (!evidence.length) return { accepted: false };
      const snapshot = { dateKey: date, tasks: [], evidence, bookmarks: normalized.bookmarks.slice(0, 3).map(row => ({ ...row, excerpt: row.excerpt.slice(0, 1200) })) };
      const data = await db(), id = `experience-${hash([taskId, date]).slice(0, 24)}`, fingerprint = hash(snapshot), old = data.jobs[id];
      if (old?.fingerprint === fingerprint && (!body.finalize || old.finalize)) return { accepted: true, duplicate: true };
      data.jobs[id] = { id, taskId, dateKey: date, snapshot, fingerprint, epoch: data.epoch, finalize: Boolean(body.finalize || old?.finalize), reviewDone: old?.fingerprint === fingerprint && old?.reviewDone, stampDone: old?.stampDone || false, attempts: 0, nextAt: Date.now() + delay, status: 'pending' };
      await write(file, data); wake(); return { accepted: true };
    }),
    results: async () => ({ reviews: (await db()).reviews }),
    edit: body => serial(async () => {
      const data = await db(); const record = data.reviews.find(row => row.id === body.id); if (!record) return { saved: false };
      if (body.remove) { data.reviews = data.reviews.filter(row => row.id !== body.id); if (data.jobs[body.id]) data.jobs[body.id].reviewDone = true; }
      else if (typeof body.hidden === 'boolean') record.hidden = body.hidden;
      else { const value = short(body.text); if (value) { record.text = value; record.edited = true; } }
      await write(file, data); return { saved: true };
    }),
    purge: body => serial(async () => {
      const data = await db(); data.epoch++;
      const matches = row => (!body.taskId || row.taskId === body.taskId) && (!body.dateKey || row.dateKey === body.dateKey);
      const dates = new Set(Object.values(data.jobs).filter(matches).map(row => row.dateKey));
      data.jobs = Object.fromEntries(Object.entries(data.jobs).filter(([, job]) => !matches(job)).map(([key, job]) => [key, { ...job, epoch: data.epoch }]));
      data.reviews = data.reviews.filter(row => !matches(row));
      if (!body.keepStamps) for (const day of dates) await draw({ remove: true, dateKey: day });
      await write(file, data); return { cleared: true };
    }),
    hideStamp: day => serial(async () => { const data = await db(); data.blockedDates = [...new Set([...data.blockedDates, dateKey(day)])]; await write(file, data); }),
    pause: () => serial(async () => { const data = await db(); data.epoch++; data.jobs = {}; await write(file, data); clearTimeout(timer); }),
    resume: () => { wake(); },
    stop: () => clearTimeout(timer),
    run,
  };
}
