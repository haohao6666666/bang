import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { createService } from '../server/service.mjs';
import { startApi } from '../server/index.mjs';
import { normalizeSnapshot, validateDraft } from '../server/validation.mjs';

// Every model response below is an injected fixture. No real API key or provider request is used.
const DAY = '2026-10-03';
const FAKE_KEY = 'test-only-key-never-send-to-a-provider';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jIxoAAAAASUVORK5CYII=', 'base64');
const config = () => ({
  text: { provider: 'qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', apiKey: FAKE_KEY },
  image: { provider: 'wan', baseUrl: 'https://dashscope.aliyuncs.com/api/v1', model: 'wan2.2-t2i-flash', apiKey: FAKE_KEY },
});
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const chatResponse = value => json({ choices: [{ message: { content: JSON.stringify(value) } }] });
const bookmark = (patch = {}) => ({ id: 'bookmark-1', platform: 'zhihu', title: '把困难拆成一个小问题', url: 'https://www.zhihu.com/question/123/answer/456', excerpt: '先写下现在已经知道的内容，再挑一个最小的问题尝试，观察这一步是否让事情变得更清楚。', savedAt: 123456, authorized: true, ...patch });
function snapshot(day = DAY, bookmarks = []) {
  return {
    dateKey: day,
    tasks: [{ id: `task-${day}`, title: '读完论文摘要', subject: '科研阅读', plannedMinutes: 25, actualMinutes: 10, status: 'active' }],
    evidence: [
      { id: `task-${day}`, dateKey: day, kind: 'task', text: '计划读完摘要并写一个问题。' },
      { id: `focus-${day}`, dateKey: day, kind: 'focus', text: '当天真实投入了 10 分钟。' },
      { id: `diary-${day}`, dateKey: day, kind: 'diary', text: '今天先写出了已经理解的一部分。' },
      { id: `outcome-${day}`, dateKey: day, kind: 'outcome', text: '写下一个关于实验对照的问题。' },
    ], bookmarks,
  };
}
function draft(day = DAY, external = false) {
  return {
    status: 'confirmed', quiet: false,
    facts: [{ text: '今天留下了十分钟的真实投入。', evidenceRefs: [{ id: `focus-${day}` }] }],
    signals: [{ type: 'question', title: '已经找到一个问题', detail: '可以从这个具体问题接着读。', confidence: 0.8, needsExternal: external, evidenceRefs: [{ id: `outcome-${day}` }] }],
    sparkle: { text: '把不清楚的地方写成了一个问题。', evidenceRefs: [{ id: `outcome-${day}` }] },
    externalMatches: [],
    tomorrowExperiments: [{ title: '围绕这个问题再读一段', why: '先接上已经留下的线索。', stopCondition: '感到疲倦时先停下来。', evidenceRefs: [{ id: `outcome-${day}` }] }],
  };
}
async function fixture(t, fetcher = async () => { throw new Error('Unexpected model request'); }) {
  const prefix = path.resolve(os.tmpdir(), 'jixiang-ai-tests-');
  const dataDir = await fs.mkdtemp(prefix);
  t.after(async () => {
    const target = path.resolve(dataDir);
    assert.ok(target.startsWith(prefix) && target !== prefix, 'Cleanup stays inside the generated test directory');
    await fs.rm(target, { recursive: true, force: true });
  });
  const service = createService({ dataDir, fetcher, env: {}, pollDelay: 0 });
  return { service, dataDir };
}

test('configuration status never discloses keys and omission preserves only the same provider endpoint', async t => {
  const { service, dataDir } = await fixture(t);
  assert.equal((await service.status()).text.configured, false);
  const status = await service.configure(config());
  assert.equal(status.text.configured, true);
  assert.equal(status.image.configured, true);
  assert.equal(JSON.stringify(status).includes(FAKE_KEY), false);
  assert.equal(Object.hasOwn(status.text, 'apiKey'), false);
  const stored = JSON.parse(await fs.readFile(path.join(dataDir, 'model-config.json'), 'utf8'));
  assert.equal(stored.text.apiKey, FAKE_KEY);
  const keep = config(); delete keep.text.apiKey; delete keep.image.apiKey;
  assert.equal((await service.configure(keep)).text.configured, true);
  const changed = { ...keep, text: { provider: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' } };
  assert.equal((await service.configure(changed)).text.configured, false);
  assert.equal(JSON.stringify(await service.status()).includes(FAKE_KEY), false);
  await assert.rejects(() => service.configure({ ...config(), text: { ...config().text, baseUrl: 'https://attacker.example/api' } }), /官方 API 地址/);
});

test('daily, weekly and image calls require explicit request consent before contacting any provider', async t => {
  let requests = 0;
  const { service } = await fixture(t, async () => { requests += 1; return chatResponse(draft()); });
  await service.configure(config());
  await assert.rejects(() => service.echo({ snapshot: snapshot() }), error => error.status === 403);
  await assert.rejects(() => service.weekly({ snapshots: [], rangeStart: '2026-10-01', rangeEnd: DAY }), error => error.status === 403);
  await assert.rejects(() => service.stamp({ dateKey: DAY, brief: '安静的阅读与一枚新芽', evidenceIds: [`focus-${DAY}`], snapshot: snapshot() }), error => error.status === 403);
  assert.equal(requests, 0);
});

test('switching away from environment configuration never reuses another provider key', async t => {
  const { dataDir } = await fixture(t);
  const service = createService({ dataDir, env: { DASHSCOPE_API_KEY: FAKE_KEY, JIXIANG_TEXT_PROVIDER: 'qwen' }, fetcher: async () => { throw new Error('No provider should be called'); } });
  assert.equal((await service.status()).text.configured, true);
  await service.configure({ text: { provider: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash' }, image: config().image });
  const status = await service.status();
  assert.equal(status.text.provider, 'deepseek');
  assert.equal(status.text.configured, false);
  assert.equal(status.text.baseUrl, 'https://api.deepseek.com');
  await assert.rejects(() => service.echo({ consent: true, snapshot: snapshot() }), /尚未配置/);
});

test('quiet days can consult authorized collections and a C2 failure preserves the local draft', async t => {
  const calls = [];
  const c1 = { ...draft(), quiet: true, signals: [] };
  const { service } = await fixture(t, async (_url, options) => {
    const stage = JSON.parse(JSON.parse(options.body).messages[1].content).stage; calls.push(stage);
    return stage === 'C1' ? chatResponse(c1) : json({ error: 'temporary failure' }, 503);
  });
  await service.configure(config());
  const result = await service.echo({ consent: true, collectionConsent: true, snapshot: snapshot(DAY, [bookmark()]) });
  assert.deepEqual(calls, ['C1', 'C2']);
  assert.equal(result.draft.facts[0].text, c1.facts[0].text);
  assert.deepEqual(result.draft.externalMatches, []);
  assert.match(result.draft.sourceNote, /已保留/);
});

test('local normalization excludes unauthorized, mismatched and unsafe bookmark inputs', () => {
  const good = bookmark();
  const normalized = normalizeSnapshot(snapshot(DAY, [
    good,
    bookmark({ id: 'not-authorized', authorized: false }),
    bookmark({ id: 'fake-host', url: 'https://zhihu.com.attacker.example/source' }),
    bookmark({ id: 'mismatched-platform', platform: 'xiaohongshu' }),
    bookmark({ id: 'not-https', url: 'http://www.zhihu.com/question/123' }),
    bookmark({ id: 'no-original', excerpt: '只有标题' }),
  ]));
  assert.deepEqual(normalized.bookmarks.map(item => item.id), [good.id]);
  const crossDate = snapshot(); crossDate.evidence.push({ id: 'wrong-day', kind: 'note', dateKey: '2026-09-30', text: '不属于这一天' });
  assert.equal(normalizeSnapshot(crossDate).evidence.some(item => item.id === 'wrong-day'), false);
});

test('C1 sees only local records and C2 runs only for a supported need with authorized excerpts', async t => {
  const calls = [];
  const c1 = draft(DAY, true);
  const c2 = draft(DAY, true);
  c2.facts[0].text = '模型第二阶段试图改写本地事实。';
  c2.externalMatches = [{ bookmarkId: 'bookmark-1', whyRelevant: '记录里已经出现一个具体问题。', excerpt: '先写下现在已经知道的内容', url: 'https://attacker.example/model-link', savedAt: 0, usefulPart: '先列出已知，再确定一件小事。', applicableWhen: '不知道从哪里开始时。', limitation: '只是个人经验，需要看看是否适合你。', evidenceRefs: [{ id: `outcome-${DAY}` }] }];
  c2.tomorrowExperiments = [{ title: '列出已知与一个小问题', why: '把收藏的方法改成一次小尝试。', stopCondition: '不适合就停下调整。', evidenceRefs: [{ id: `outcome-${DAY}` }, { id: 'bookmark-1' }] }];
  const { service } = await fixture(t, async (_url, options) => {
    const body = JSON.parse(options.body); const input = JSON.parse(body.messages[1].content);
    calls.push(input);
    return chatResponse(input.stage === 'C1' ? c1 : c2);
  });
  await service.configure(config());
  const source = snapshot(DAY, [bookmark(), bookmark({ id: 'private-bookmark', authorized: false })]);
  const unchanged = structuredClone(source);
  const result = await service.echo({ consent: true, collectionConsent: true, snapshot: source });
  assert.deepEqual(calls.map(item => item.stage), ['C1', 'C2']);
  assert.deepEqual(calls[0].snapshot.bookmarks, []);
  assert.deepEqual(calls[1].snapshot.bookmarks.map(item => item.id), ['bookmark-1']);
  assert.equal(result.draft.status, 'draft');
  assert.equal(result.draft.facts[0].text, c1.facts[0].text);
  assert.equal(result.draft.sparkle.text, c1.sparkle.text);
  const matched = result.draft.externalMatches[0];
  assert.equal(matched.url, bookmark().url);
  assert.equal(matched.savedAt, bookmark().savedAt);
  assert.ok(bookmark().excerpt.includes(matched.excerpt));
  assert.equal(matched.usefulPart, c2.externalMatches[0].usefulPart);
  assert.equal(matched.applicableWhen, c2.externalMatches[0].applicableWhen);
  assert.equal(matched.limitation, c2.externalMatches[0].limitation);
  assert.deepEqual(matched.evidenceRefs.map(item => item.kind), ['outcome', 'bookmark']);
  assert.deepEqual(source, unchanged, 'Reflection never mutates the client snapshot');
});

test('C1 does not enrich when no external help is needed or no bookmark is authorized', async t => {
  const stages = [];
  let needsExternal = false;
  const { service } = await fixture(t, async (_url, options) => { const input = JSON.parse(JSON.parse(options.body).messages[1].content); stages.push(input.stage); return chatResponse(draft(DAY, needsExternal)); });
  await service.configure(config());
  await service.echo({ consent: true, snapshot: snapshot(DAY, [bookmark()]) });
  needsExternal = true;
  await service.echo({ consent: true, snapshot: snapshot(DAY, [bookmark({ authorized: false })]) });
  assert.deepEqual(stages, ['C1', 'C1']);
});

test('fabricated evidence invalidates a whole claim, and invented external quotes cannot support an experiment', () => {
  const source = normalizeSnapshot(snapshot(DAY, [bookmark()]));
  const raw = draft();
  raw.facts.push({ text: '一真一假的来源也不能成为事实。', evidenceRefs: [{ id: `focus-${DAY}` }, { id: 'invented-source' }] });
  raw.externalMatches = [
    { bookmarkId: 'bookmark-1', excerpt: '这是模型编造的原文。', whyRelevant: '解释', evidenceRefs: [{ id: `outcome-${DAY}` }] },
    { bookmarkId: 'unauthorized-id', excerpt: '先写下现在已经知道的内容', whyRelevant: '解释', evidenceRefs: [{ id: `outcome-${DAY}` }] },
  ];
  raw.tomorrowExperiments.push({ title: '建立在伪造引文上的尝试', why: '不应保留', evidenceRefs: [{ id: `outcome-${DAY}` }, { id: 'bookmark-1' }] });
  const validated = validateDraft(raw, source, true);
  assert.equal(validated.facts.length, 1);
  assert.deepEqual(validated.externalMatches, []);
  assert.equal(validated.tomorrowExperiments.length, 1);
  const invented = { ...raw, facts: [{ text: '假事实', evidenceRefs: ['invented-source'] }], signals: [], sparkle: null };
  assert.throws(() => validateDraft(invented, source), error => error.status === 502);
});

test('provider failures are actionable without echoing secret-bearing upstream content', async t => {
  const { service } = await fixture(t, async () => json({ error: `secret ${FAKE_KEY}` }, 401));
  await service.configure(config());
  await assert.rejects(() => service.echo({ consent: true, snapshot: snapshot() }), error => error.status === 502 && /鉴权失败/.test(error.message) && !error.message.includes(FAKE_KEY));
});

test('weekly reflection needs three distinct diary dates before model access', async t => {
  let calls = 0;
  const { service } = await fixture(t, async () => { calls += 1; throw new Error('Must not call'); });
  await service.configure(config());
  const body = { consent: true, rangeStart: '2026-10-01', rangeEnd: DAY };
  await assert.rejects(() => service.weekly({ ...body, snapshots: [snapshot('2026-10-01'), snapshot('2026-10-02'), snapshot('2026-10-02')] }), /三个不同日期/);
  const noDiary = snapshot(DAY); noDiary.evidence = noDiary.evidence.filter(item => item.kind !== 'diary');
  await assert.rejects(() => service.weekly({ ...body, snapshots: [snapshot('2026-10-01'), snapshot('2026-10-02'), noDiary] }), /三个不同日期/);
  assert.equal(calls, 0);
});

test('weekly observations derive dates from known evidence and reject unsupported trends', async t => {
  const calls = [];
  let validResponse = true;
  const { service } = await fixture(t, async (_url, options) => {
    calls.push(JSON.parse(JSON.parse(options.body).messages[1].content));
    return chatResponse({ observations: validResponse ? [
      { text: '在两个日期，都先写下一个问题。', evidenceIds: ['diary-2026-10-01', 'diary-2026-10-03'], evidenceDates: ['2099-01-01', '2099-01-02'] },
      { text: '一个日期不能证明趋势。', evidenceIds: ['diary-2026-10-01', 'focus-2026-10-01'], evidenceDates: ['2026-10-01', '2026-10-02'] },
      { text: '不认识的来源不能证明趋势。', evidenceIds: ['diary-2026-10-02', 'invented'], evidenceDates: ['2026-10-02', '2026-10-03'] },
    ] : [{ text: '来源不足', evidenceIds: ['diary-2026-10-01'] }] });
  });
  await service.configure(config());
  const body = { consent: true, rangeStart: '2026-10-01', rangeEnd: DAY, snapshots: ['2026-10-01', '2026-10-02', DAY].map(day => snapshot(day, [bookmark()])) };
  const { draft: result } = await service.weekly(body);
  assert.equal(result.status, 'draft');
  assert.equal(result.observations.length, 1);
  assert.deepEqual(result.observations[0].evidenceDates, ['2026-10-01', DAY]);
  assert.ok(calls[0].days.every(day => day.bookmarks.length === 0));
  validResponse = false;
  await assert.rejects(() => service.weekly(body), error => error.status === 502 && /跨日期证据/.test(error.message));
});

test('one daily stamp is stored locally, survives service restart, and reuses the saved image', async t => {
  let submissions = 0;
  const { service, dataDir } = await fixture(t, async url => {
    if (String(url).endsWith('/image-synthesis')) { submissions += 1; return json({ output: { task_id: 'job-one' } }); }
    if (String(url).endsWith('/tasks/job-one')) return json({ output: { task_status: 'SUCCEEDED', results: [{ url: 'https://test-images.oss-cn-beijing.aliyuncs.com/stamp.png' }] } });
    return new Response(PNG, { headers: { 'Content-Type': 'image/png' } });
  });
  await service.configure(config());
  const body = { consent: true, dateKey: DAY, brief: '阅读后长出一片小小的新芽', evidenceIds: [`focus-${DAY}`], snapshot: snapshot() };
  const first = await service.stamp(body);
  const second = await service.stamp({ ...body, brief: '想换一个画面，也应保留同一枚' });
  assert.deepEqual(second, first);
  assert.equal(submissions, 1);
  assert.match(first.stamp.imageUrl, /^\/api\/ai\/stamp-assets\/2026-10-03-[a-f0-9]{24}\.png$/);
  assert.deepEqual(first.stamp.evidenceIds, body.evidenceIds);
  const fileName = first.stamp.imageUrl.split('/').at(-1);
  const asset = await service.asset(fileName);
  assert.equal(asset.mime, 'image/png'); assert.deepEqual(asset.bytes, PNG);
  assert.deepEqual(await fs.readFile(path.join(dataDir, 'stamps', fileName)), PNG);
  const restarted = createService({ dataDir, env: {}, fetcher: async () => { throw new Error('Saved stamps must not resubmit'); } });
  assert.deepEqual(await restarted.stamp(body), first);
  assert.deepEqual((await restarted.stamps()).stamps, [first.stamp]);
  await assert.rejects(() => service.asset('../model-config.json'), error => error.status === 404);
});

test('unfinished Wan image jobs resume the same task without another paid submission', async t => {
  let submissions = 0; let polls = 0;
  const { service, dataDir } = await fixture(t, async url => {
    if (String(url).endsWith('/image-synthesis')) { submissions += 1; return json({ output: { task_id: 'resume-job' } }); }
    if (String(url).endsWith('/tasks/resume-job')) { polls += 1; return polls === 1 ? json({ error: 'temporary outage' }, 503) : json({ output: { task_status: 'SUCCEEDED', results: [{ b64_json: PNG.toString('base64') }] } }); }
    throw new Error('Unexpected endpoint');
  });
  await service.configure(config());
  const body = { consent: true, dateKey: DAY, brief: '书页和一片草木新芽', evidenceIds: [`focus-${DAY}`], snapshot: snapshot() };
  await assert.rejects(() => service.stamp(body), error => error.status === 502);
  const job = JSON.parse(await fs.readFile(path.join(dataDir, 'stamps', `${DAY}.job.json`), 'utf8'));
  assert.equal(job.jobId, 'resume-job'); assert.equal(JSON.stringify(job).includes(FAKE_KEY), false);
  const result = await service.stamp(body);
  assert.equal(result.stamp.dateKey, DAY); assert.equal(submissions, 1); assert.equal(polls, 2);
});

test('stamp requests require same-day non-task evidence and reject untrusted image downloads', async t => {
  let calls = 0;
  const { service } = await fixture(t, async url => {
    calls += 1;
    if (String(url).endsWith('/image-synthesis')) return json({ output: { task_id: 'untrusted-image' } });
    return json({ output: { task_status: 'SUCCEEDED', results: [{ url: 'https://attacker.example/stamp.png' }] } });
  });
  await service.configure(config());
  const body = { consent: true, dateKey: DAY, brief: '一本正在阅读的书', snapshot: snapshot() };
  await assert.rejects(() => service.stamp({ ...body, evidenceIds: [`task-${DAY}`] }), /作为依据/);
  await assert.rejects(() => service.stamp({ ...body, evidenceIds: ['invented'] }), /作为依据/);
  await assert.rejects(() => service.stamp({ ...body, snapshot: snapshot('2026-10-02'), evidenceIds: ['focus-2026-10-02'] }), /日期不一致/);
  assert.equal(calls, 0);
  await assert.rejects(() => service.stamp({ ...body, evidenceIds: [`focus-${DAY}`] }), /非受信/);
  assert.equal(calls, 2, 'An untrusted URL is never fetched');
  assert.deepEqual((await service.stamps()).stamps, []);
});

test('HTTP API rejects cross-site, forged-host and headerless mutations before dispatch', async t => {
  const calls = [];
  const service = {
    status: async () => ({ text: { configured: false }, image: { configured: false } }),
    stamps: async () => ({ stamps: [] }),
    configure: async body => { calls.push(body); return { saved: true }; },
    echo: async () => { throw new Error(`Never expose ${FAKE_KEY}`); },
  };
  const server = await startApi({ port: 0, service });
  t.after(() => new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { 'Content-Type': 'application/json', 'X-Jixiang-Request': '1', Origin: 'http://127.0.0.1:4173' };
  // Node fetch normalizes Host; raw HTTP is necessary to exercise host validation.
  const post = (overrides = {}) => new Promise((resolve, reject) => {
    const request = http.request(`${base}/api/ai/config`, { method: 'POST', headers: { ...headers, ...overrides } }, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: response.statusCode, headers: response.headers })));
    });
    request.on('error', reject); request.end('{}');
  });
  assert.equal((await post({ Origin: 'https://attacker.example' })).status, 403);
  assert.equal((await post({ Host: 'attacker.example:4175' })).status, 403);
  assert.equal((await post({ 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await post({ 'X-Jixiang-Request': '' })).status, 403);
  assert.equal((await post({ 'Content-Type': 'text/plain' })).status, 403);
  assert.deepEqual(calls, []);
  const good = await post(); assert.equal(good.status, 200); assert.deepEqual(await good.json(), { saved: true });
  assert.deepEqual(calls, [{}]);
  const status = await fetch(`${base}/api/ai/status`, { headers: { Origin: 'http://127.0.0.1:4173' } });
  assert.equal(status.headers.get('cache-control'), 'no-store');
  assert.equal(status.headers.get('x-content-type-options'), 'nosniff');
  const bad = await fetch(`${base}/api/ai/echo`, { method: 'POST', headers, body: '{}' });
  assert.equal(bad.status, 500); assert.equal((await bad.text()).includes(FAKE_KEY), false);
});

test('companion asks for concrete details without calling the model when the user has not said anything', async t => {
  let calls = 0;
  const { service } = await fixture(t, async () => { calls += 1; return chatResponse({ reply: '模型不应被调用。' }); });
  await service.configure(config());
  const result = await service.companion({ consent: true, task: { id: 'task-1', title: '复习', actualMinutes: 25 }, messages: [] });
  assert.match(result.reply, /具体完成了哪一步/);
  assert.equal(result.memoryDraft, undefined);
  assert.equal(calls, 0);
});

test('companion memory suggestions require exact user quotes and remain compact', async t => {
  const { service } = await fixture(t, async () => chatResponse({
    reply: '你已经把一个难点写成了可继续的问题。',
    memoryDraft: { summary: '用户说自己完成了实验', nextStep: '继续', evidenceQuotes: ['模型臆想的实验'] },
  }));
  await service.configure(config());
  const result = await service.companion({ consent: true, task: { id: 'task-1', title: '阅读', actualMinutes: 10 }, messages: [{ role: 'user', content: '我先写下了一个问题。' }] });
  assert.equal(result.memoryDraft, undefined);
  assert.ok(result.reply.length <= 320);
});

test('text outcome analysis keeps only source-backed quotes and rejects fabricated observations', async t => {
  const { service } = await fixture(t, async () => chatResponse({
    summary: '文档里记录了一个待验证问题。',
    observations: [
      { text: '文档提出了一个问题。', quote: '待验证问题' },
      { text: '文档显示已经完成全部实验。', quote: '模型编造的句子' },
    ],
    uncertainties: ['无法从文档确认实验是否完成。'],
    nextStep: '补充验证记录',
  }));
  await service.configure(config());
  const result = await service.analyze({ consent: true, task: { id: 'task-1', title: '实验', actualMinutes: 20 }, file: { name: 'result.txt', mime: 'text/plain', text: '今天记录：待验证问题。' } });
  assert.deepEqual(result.observations, [{ text: '文档提出了一个问题。', quote: '待验证问题' }]);
  assert.deepEqual(result.uncertainties, ['无法从文档确认实验是否完成。']);
});

test('companion forwards cancellation and does not return a fabricated fallback', async t => {
  const { service } = await fixture(t, async (_url, options) => await new Promise((resolve, reject) => {
    if (options.signal.aborted) return reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
  }));
  await service.configure(config());
  const controller = new AbortController();
  const pending = service.companion({ consent: true, task: { id: 'task-1', title: '阅读', actualMinutes: 15 }, messages: [{ role: 'user', content: '我读到了第二段。' }] }, controller.signal);
  controller.abort();
  await assert.rejects(pending, error => error.status === 504);
});

test('background memory stores exact user wording, deduplicates events, and forgets one event cleanly', async t => {
  const { service, dataDir } = await fixture(t);
  const event = { eventKey: 'companion:task-1:2026-10-03:1', taskId: 'task-1', dateKey: DAY, userQuotes: ['我读到第二段，先把问题写下来。'], nextStep: '下次从第三段接着读。', sourceIds: ['outcome-1'] };
  assert.deepEqual(await service.memory(event), { stored: true });
  assert.deepEqual(await service.memory(event), { stored: false, duplicate: true });
  assert.deepEqual(await service.memoryStatus(), { enabled: true, count: 1 });
  const document = JSON.parse(await fs.readFile(path.join(dataDir, 'memory', 'task-1', `${DAY}.json`), 'utf8'));
  assert.deepEqual(document.quotes.map(item => ({ text: item.text, source: item.source })), [{ text: event.userQuotes[0], source: 'user' }]);
  assert.deepEqual(document.inferences, []);
  assert.equal(document.nextSteps[0].text, event.nextStep);
  assert.equal((await service.memory({ forget: true, taskId: 'task-1', dateKey: DAY, eventKey: event.eventKey })).cleared, true);
  assert.deepEqual(await service.memoryStatus(), { enabled: true, count: 0 });
});

test('automatic stamps require a concrete same-day record and reuse one result per day', async t => {
  let submissions = 0;
  const { service } = await fixture(t, async url => {
    if (String(url).endsWith('/image-synthesis')) { submissions += 1; return json({ output: { task_id: 'automatic-job' } }); }
    if (String(url).endsWith('/tasks/automatic-job')) return json({ output: { task_status: 'SUCCEEDED', results: [{ b64_json: PNG.toString('base64') }] } });
    throw new Error('Unexpected endpoint');
  });
  await service.configure(config());
  const base = { automatic: true, dateKey: DAY, brief: '留下一个具体问题的阅读记录', snapshot: snapshot(), eventKey: 'work:1' };
  await assert.rejects(() => service.stamp({ ...base, evidenceIds: [`focus-${DAY}`] }), /具体作品或经历/);
  const first = await service.stamp({ ...base, evidenceIds: [`outcome-${DAY}`] });
  const second = await service.stamp({ ...base, evidenceIds: [`outcome-${DAY}`], brief: '同一天的第二次请求' });
  assert.deepEqual(second, first);
  assert.equal(submissions, 1);
  assert.equal(first.stamp.prompt, undefined);
  assert.equal(first.stamp.model, undefined);
});
