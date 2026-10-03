import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { text, list, dateKey, ServiceError } from './validation.mjs';

const read = async (file, fallback) => { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; } };
const write = async (file, value) => { await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 }); const temp = `${file}.${randomUUID()}.tmp`; await fs.writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 }); await fs.rename(temp, file); };

/** Single local account. Only compact context leaves this store; no raw-document API. */
export function createMemoryStore(dataDir) {
  const root = path.join(dataDir, 'memory');
  const settingsFile = path.join(dataDir, 'memory-settings.json');
  let tail = Promise.resolve();
  const serial = fn => { const next = tail.then(fn); tail = next.catch(() => {}); return next; };
  const settings = () => read(settingsFile, { enabled: true, epoch: 0 });
  const files = async () => { const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []); const results = []; for (const entry of entries) if (entry.isDirectory()) { for (const name of await fs.readdir(path.join(root, entry.name))) if (/^\d{4}-\d{2}-\d{2}\.json$/.test(name)) results.push(path.join(root, entry.name, name)); } return results; };
  const forget = async body => {
    const task = text(body.taskId, 180); const day = body.allDates ? '' : body.dateKey ? dateKey(body.dateKey) : '';
    const eventKey = text(body.eventKey, 220); let removed = 0;
    for (const file of await files()) {
      const doc = await read(file, null); if (!doc || task && doc.taskId !== task || day && doc.dateKey !== day) continue;
      if (!eventKey || body.allDates) { await fs.unlink(file); removed++; continue; }
      const target = (doc.events || []).find(event => event.eventKey === eventKey); if (!target) continue;
      const events = doc.events.filter(event => event.eventKey !== eventKey);
      const quotes = (doc.quotes || []).filter(row => !(target.quoteIds || []).includes(row.id));
      const nextSteps = (doc.nextSteps || []).filter(row => row.id !== target.nextStepId && row.eventKey !== eventKey);
      const sources = (doc.sources || []).filter(id => !(target.sourceIds || []).includes(id) || events.some(event => (event.sourceIds || []).includes(id)));
      if (!events.length) await fs.unlink(file); else await write(file, { ...doc, quotes, nextSteps, sources, events }); removed++;
    }
    return { cleared: removed > 0, removed };
  };
  return {
    status: async () => ({ enabled: (await settings()).enabled, count: (await files()).length }),
    settings,
    setEnabled: enabled => serial(async () => { const old = await settings(); await write(settingsFile, { enabled: enabled === true, epoch: old.epoch + 1 }); return { enabled: enabled === true }; }),
    clear: () => serial(async () => { const old = await settings(); await write(settingsFile, { ...old, epoch: old.epoch + 1 }); await fs.rm(root, { recursive: true, force: true }); return { cleared: true }; }),
    forget: body => serial(() => forget(body)),
    update: body => serial(async () => {
      if (body.forget) return forget(body);
      const date = dateKey(body.dateKey), taskId = text(body.taskId, 180) || 'unlinked', eventKey = text(body.eventKey, 220);
      if (!eventKey) throw new ServiceError('缺少记录标识。');
      const quotes = list(body.userQuotes, 8).map(item => text(item, 500)).filter(Boolean), nextStep = text(body.nextStep, 500);
      if (!quotes.length && !nextStep) return { stored: false };
      const key = taskId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || 'unlinked';
      // Read former directory names, then migrate only the matching document.
      const oldFile = (await files()).find(file => file.endsWith(`/${date}.json`) && path.basename(path.dirname(file)) === taskId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120));
      const file = path.join(root, key, `${date}.json`);
      let doc = await read(file, null) || (oldFile ? await read(oldFile, null) : null) || { version: 2, userId: 'local', taskId, dateKey: date, quotes: [], nextSteps: [], sources: [], inferences: [], events: [] };
      const fingerprint = createHash('sha256').update(JSON.stringify({ quotes, nextStep, sourceIds: body.sourceIds })).digest('hex');
      const prior = (doc.events || []).find(item => item.eventKey === eventKey);
      if (prior?.fingerprint === fingerprint) return { stored: false, duplicate: true };
      if (prior) {
        doc = { ...doc, quotes: doc.quotes.filter(item => !(prior.quoteIds || []).includes(item.id)), nextSteps: doc.nextSteps.filter(item => item.id !== prior.nextStepId), events: doc.events.filter(item => item.eventKey !== eventKey) };
      }
      const quoteIds = quotes.map((_, i) => `${eventKey}:quote:${i}`), nextStepId = nextStep ? `${eventKey}:next` : undefined;
      const sourceIds = list(body.sourceIds, 12).map(item => text(item, 180)).filter(Boolean);
      await write(file, { ...doc, version: 2, userId: 'local', inferences: [], quotes: [...doc.quotes, ...quotes.map((quote, i) => ({ id: quoteIds[i], text: quote, source: 'user' }))].slice(-80), nextSteps: [...doc.nextSteps, ...(nextStep ? [{ id: nextStepId, text: nextStep, source: 'user', createdAt: Date.now() }] : [])].slice(-40), sources: [...new Set([...doc.sources, ...sourceIds])].slice(-120), events: [...doc.events, { eventKey, fingerprint, quoteIds, nextStepId, sourceIds, createdAt: Date.now() }].slice(-120) });
      if (oldFile && oldFile !== file) await fs.unlink(oldFile);
      return { stored: true };
    }),
    context: async taskId => {
      const docs = []; for (const file of await files()) { const doc = await read(file, null); if (doc?.taskId === taskId) docs.push(doc); }
      docs.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
      return docs.slice(0, 3).map(doc => ({ dateKey: doc.dateKey, userQuotes: doc.quotes.slice(-4).map(row => row.text), nextStep: doc.nextSteps.at(-1)?.text || '' }));
    },
  };
}
