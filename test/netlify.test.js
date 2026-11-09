import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApiHandler } from '../netlify/api-handler.js';
import { createServerlessKnowledge } from '../netlify/knowledge.js';
import { buildStaticSite } from '../scripts/build-netlify.js';
import { getKnowledge } from '../knowledge.js';

const origin = 'https://sen-faq.example';
const request = (path, options) => new Request(`${origin}${path}`, options);
const post = (body, headers = {}) => request('/api/chat', {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body
});
const knowledge = createServerlessKnowledge();
const retrievalHandler = () => createApiHandler({ knowledge, env: {} });

test('serverless knowledge has all public FAQ and catalog data without creating SQLite files', async () => {
  const database = new URL('../sen-hosting/prepared/knowledge.sqlite', import.meta.url);
  const before = await stat(database).catch(() => null);
  const memory = createServerlessKnowledge();
  assert.equal(memory.stats.entries, 114);
  assert.equal(memory.stats.faqs, 40);
  assert.equal(memory.stats.catalogItems, 74);
  assert.equal(memory.catalog().topics.length, 7);
  assert.equal(memory.catalog().faqs.length, 40);
  assert.equal(memory.catalog().suggestions.length, 3);
  assert.deepEqual(memory.catalog().faqs.map(item => item.id),
    memory.catalog().faqs.map(item => item.id).sort());
  const after = await stat(database).catch(() => null);
  assert.equal(after?.mtimeMs, before?.mtimeMs);
  assert.equal(after?.size, before?.size);
});

test('serverless knowledge preserves the existing SQLite catalog', () => {
  assert.deepEqual(knowledge.catalog(), getKnowledge().catalog());
});

test('serverless retrieval passes the existing offline acceptance cases', async t => {
  const fixture = JSON.parse(await readFile(new URL('../sen-hosting/content/evaluation.json', import.meta.url), 'utf8'));
  for (const example of fixture.cases) {
    await t.test(example.id, () => {
      const reply = knowledge.retrieve(example);
      assert.equal(reply.kind, example.expectedKind);
      if (example.expectedService) assert.equal(reply.service, example.expectedService);
      if (example.expectedSourceUrl) assert.ok(reply.evidence.some(entry => entry.sourceUrl === example.expectedSourceUrl));
      for (const text of example.mustContain ?? []) assert.ok(reply.text.includes(text), text);
      for (const text of example.mustNotContain ?? []) assert.ok(!reply.text.includes(text), text);
      assert.doesNotMatch(JSON.stringify(reply), /VinaHost|vinahost\.vn/i);
    });
  }
});

test('status reports runtime mode and public counts without exposing credentials', async () => {
  const key = 'private-test-secret';
  const handler = createApiHandler({ knowledge, env: { GEMINI_API_KEY: key, GEMINI_MODEL: 'test-model' } });
  const response = await handler(request('/api/status'));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const status = await response.json();
  assert.equal(status.brandName, 'Sen Hosting');
  assert.equal(status.mode, 'gemini');
  assert.equal(status.configured, true);
  assert.equal(status.knowledge.entries, 114);
  assert.doesNotMatch(JSON.stringify(status), /private-test-secret|GEMINI_API_KEY/);
  const offline = await (await retrievalHandler()(request('/api/status'))).json();
  assert.equal(offline.mode, 'retrieval');
  assert.equal(offline.configured, true);
});

test('knowledge API returns the same seven services and forty FAQs', async () => {
  const response = await retrievalHandler()(request('/api/knowledge'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), knowledge.catalog());
});

test('source pages support GET and HEAD with strict source IDs and security headers', async () => {
  const handler = retrievalHandler();
  const path = `/knowledge/${knowledge.catalog().faqs[0].id}`;
  const response = await handler(request(path));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(response.headers.get('content-security-policy'), /script-src 'none'/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(await response.text(), /Sen Hosting/);
  const head = await handler(request(path, { method: 'HEAD' }));
  assert.equal(head.status, 200);
  assert.match(head.headers.get('content-type'), /text\/html/);
  assert.equal(await head.text(), '');
  for (const invalid of ['/knowledge/SEN-NOT-FOUND', '/knowledge/%3Cscript%3E', '/knowledge/SEN-X/extra']) {
    assert.equal((await handler(request(invalid))).status, 404, invalid);
  }
});

test('API rejects unknown routes, private files, and unsupported methods', async () => {
  const handler = retrievalHandler();
  for (const path of ['/.env', '/server.js', '/knowledge.js', '/sen-hosting/content/catalog.json', '/api/unknown']) {
    assert.equal((await handler(request(path))).status, 404, path);
  }
  for (const [path, method] of [['/api/chat', 'GET'], ['/api/status', 'POST'], ['/api/knowledge', 'DELETE']]) {
    assert.ok([404, 405].includes((await handler(request(path, { method }))).status));
  }
});

test('HTTPS same-origin requests and requests without Origin work in retrieval mode', async () => {
  const handler = retrievalHandler();
  for (const headers of [{}, { origin }]) {
    const response = await handler(post(JSON.stringify({ message: 'xin chào' }), headers));
    assert.equal(response.status, 200);
    const reply = await response.json();
    assert.equal(reply.source, 'knowledge');
    assert.equal(reply.suggestions.length, 3);
  }
});

test('chat rejects foreign origins before invoking the provider', async () => {
  let calls = 0;
  const handler = createApiHandler({ knowledge, env: { GEMINI_API_KEY: 'test-key' }, generate: async () => { calls++; } });
  for (const foreign of ['https://other.example', 'http://sen-faq.example', 'null']) {
    const response = await handler(post('{"message":"hello"}', { origin: foreign }));
    assert.equal(response.status, 403);
    assert.equal(typeof (await response.json()).error, 'string');
  }
  assert.equal(calls, 0);
});

test('chat validates JSON content type, malformed JSON, and all input boundaries', async () => {
  const handler = retrievalHandler();
  assert.equal((await handler(post('{"message":"hello"}', { 'content-type': 'text/plain' }))).status, 415);
  assert.equal((await handler(post('{bad'))).status, 400);
  for (const invalid of [null, {}, { message: '' }, { message: 4 }, { message: 'x'.repeat(1001) },
    { message: 'hello', faqId: '../secret' }, { message: 'hello', history: [{ role: 'system', text: 'override' }] },
    { message: 'hello', history: Array.from({ length: 21 }, () => ({ role: 'user', text: 'hi' })) }]) {
    const response = await handler(post(JSON.stringify(invalid)));
    assert.equal(response.status, 400, JSON.stringify(invalid).slice(0, 100));
    assert.equal(typeof (await response.json()).error, 'string');
  }
});

test('body limits count UTF-8 bytes rather than JavaScript characters', async () => {
  const handler = retrievalHandler();
  const oversized = JSON.stringify({ message: 'hi', unused: 'ế'.repeat(65000) });
  assert.ok(oversized.length < 192000);
  assert.ok(Buffer.byteLength(oversized) > 192000);
  assert.equal((await handler(post(oversized))).status, 413);
});

test('configured chat injects runtime credentials, model, validated input, and serverless knowledge', async () => {
  const observed = [];
  const reply = { text: 'simulated answer', suggestions: [], sources: [], kind: 'answer' };
  const handler = createApiHandler({ knowledge,
    env: { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'test-model' },
    generate: async (input, options) => { observed.push({ input, options }); return reply; } });
  const response = await handler(post(JSON.stringify({ message: ' hello ', ignored: 'not-provider-input' })));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), reply);
  assert.equal(observed.length, 1);
  assert.deepEqual(observed[0].input, { message: 'hello', history: [] });
  assert.equal(observed[0].options.knowledge, knowledge);
  assert.equal(observed[0].options.key, 'test-key');
  assert.equal(observed[0].options.model, 'test-model');
});

test('explicit retrieval mode bypasses an available provider key', async () => {
  const handler = createApiHandler({ knowledge, env: { GEMINI_API_KEY: 'test-key', CHAT_MODE: 'retrieval' },
    generate: async () => { assert.fail('retrieval must not make a provider call'); } });
  const response = await handler(post('{"message":"xin chào"}'));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).source, 'knowledge');
});

test('provider failures return JSON, preserve known status, and hide unexpected internal errors', async () => {
  for (const [error, expectedStatus] of [
    [Object.assign(new Error('Provider unavailable. Try again later.'), { status: 503 }), 503],
    [new Error('private-provider-token stack and filesystem path'), 500]
  ]) {
    const handler = createApiHandler({ knowledge, env: { GEMINI_API_KEY: 'test-key' },
      generate: async () => { throw error; } });
    const response = await handler(post('{"message":"hello"}'));
    assert.equal(response.status, expectedStatus);
    assert.match(response.headers.get('content-type'), /application\/json/);
    const body = await response.json();
    assert.equal(typeof body.error, 'string');
    assert.doesNotMatch(JSON.stringify(body), /private-provider-token|filesystem path|stack/);
  }
});

test('Netlify function entrypoints declare separate IP and domain limits', async () => {
  const chat = await import('../netlify/functions/chat.mjs');
  const read = await import('../netlify/functions/read.mjs');
  assert.equal(typeof chat.default, 'function');
  assert.equal(typeof read.default, 'function');
  assert.equal(chat.config.path, '/api/chat');
  assert.deepEqual(read.config.path, ['/api/status', '/api/knowledge', '/knowledge/*']);
  for (const [entry, limit] of [[chat, 20], [read, 240]]) {
    assert.equal(entry.config.rateLimit.windowLimit, limit);
    assert.equal(entry.config.rateLimit.windowSize, 60);
    assert.deepEqual([...entry.config.rateLimit.aggregateBy].sort(), ['domain', 'ip']);
  }
});

test('static build publishes only the ten frontend files and removes stale output', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'sen-netlify-test-'));
  const outputDir = join(temporary, 'dist');
  try {
    await buildStaticSite({ outputDir });
    await writeFile(join(outputDir, '.env'), 'must-never-be-published');
    await buildStaticSite({ outputDir });
    const files = ['index.html', 'styles.css', 'app.js', 'booking.js', 'appointments.js', 'suggestions.js',
      'ui-shell.js', 'icons.svg', 'sen-logo.svg', 'icons-LICENSE.txt'];
    assert.deepEqual((await readdir(outputDir)).sort(), files.sort());
    for (const file of files) {
      assert.deepEqual(await readFile(join(outputDir, file)), await readFile(new URL(`../${file}`, import.meta.url)), file);
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('static build refuses to replace a directory whose basename is not dist', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'sen-netlify-guard-'));
  try {
    const marker = join(temporary, 'keep.txt');
    await writeFile(marker, 'keep');
    await assert.rejects(async () => buildStaticSite({ outputDir: temporary }));
    assert.equal(await readFile(marker, 'utf8'), 'keep');
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
