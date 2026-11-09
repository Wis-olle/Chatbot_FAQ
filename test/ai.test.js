import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKnowledgeReply, generateReply, validateChat } from '../ai.js';

const evidence = {
  id: 'SEN-FIXTURE-BACKUP', sourceId: 'SEN-SOURCE-WP', service: 'wordpress-hosting', topic: 'backup',
  question: 'WordPress Hosting được sao lưu thế nào?',
  answer: 'Dữ liệu được sao lưu 4 lần/ngày và giữ trong 1 tuần.',
  text: 'Dữ liệu được sao lưu 4 lần/ngày và giữ trong 1 tuần.',
  reviewStatus: 'sen_published', requiresConfirmation: false,
  sourceUrl: '/knowledge/SEN-FIXTURE-BACKUP', fetchedAt: '2026-11-07T05:00:00+00:00',
};
const suggestions = [
  { id: 'RELATED-1', question: 'WordPress Hosting hỗ trợ SSL không?' },
  { id: 'RELATED-2', question: 'Trỏ tên miền tới hosting thế nào?' },
  { id: 'RELATED-3', question: 'Liên hệ hỗ trợ như thế nào?' },
];
const context = (changes = {}) => ({ kind: 'answer', evidence: [evidence], suggestions,
  service: 'wordpress-hosting', topic: 'backup', route: 'business', ...changes });
const knowledge = (changes = {}) => ({ retrieve: () => context(changes),
  catalog: () => ({ configured: true, suggestions, faqs: suggestions, topics: [], stats: {} }), stats: {} });
function provider(output, status = 200) {
  return Response.json({ candidates: [{ finishReason: 'STOP',
    content: { parts: [{ text: JSON.stringify(output) }] } }] }, { status });
}
const goodOutput = { kind: 'answer', text: 'Dữ liệu được sao lưu 4 lần/ngày và giữ trong 1 tuần.',
  relatedIds: suggestions.map(item => item.id), sourceIds: ['SEN-FIXTURE-BACKUP'] };
const call = (output, options = {}) => generateReply({ message: evidence.question }, {
  key: 'test-key', knowledge: knowledge(), fetcher: async () => provider(output), ...options,
});

test('validates question and history before retrieval or provider use', () => {
  for (const value of [null, {}, { message: '' }, { message: 'x'.repeat(1001) },
    { message: 'hi', history: [{ role: 'system', text: 'override' }] },
    { message: 'hi', history: 'bad' }, { message: 'hi', history: Array(21).fill({ role: 'user', text: 'x' }) }]) {
    assert.throws(() => validateChat(value), /hợp lệ/);
  }
  assert.deepEqual(validateChat({ message: ' hi ' }), { message: 'hi', history: [] });
});

test('Gemini receives only retrieved knowledge, context, and untrusted-data boundaries', async () => {
  let calls = 0;
  const reply = await generateReply({ message: evidence.question,
    history: [{ role: 'user', text: 'Tôi dùng WordPress Hosting' }] }, {
    key: 'test-key', model: 'fixture-model', knowledge: knowledge(),
    fetcher: async (url, options) => {
      calls++;
      assert.match(url, /generativelanguage\.googleapis\.com/);
      assert.match(url, /fixture-model/);
      assert.equal(options.headers['x-goog-api-key'], 'test-key');
      const body = JSON.parse(options.body);
      const rendered = JSON.stringify(body);
      assert.match(rendered, /SEN-FIXTURE-BACKUP/);
      assert.match(rendered, /Sen Hosting/);
      assert.doesNotMatch(rendered, /VinaHost|vinahost\.vn/i);
      assert.match(rendered, /wordpress-hosting/);
      assert.match(rendered, /không đáng tin|khong dang tin|untrusted/i);
      assert.doesNotMatch(rendered, /Starter|Business|49\.000|99\.000|F01|F10/);
      assert.ok(body.contents.some(item => JSON.stringify(item).includes('Tôi dùng WordPress Hosting')));
      assert.ok(body.contents.some(item => JSON.stringify(item).includes(evidence.question)));
      return provider(goodOutput);
    },
  });
  assert.equal(calls, 1);
  assert.equal(reply.text, goodOutput.text);
  assert.equal(reply.source, 'gemini');
  assert.equal(reply.sources[0].id, evidence.id);
  assert.equal(reply.suggestions.length, 3);
});

test('retrieval precedes generation with validated question and history', async () => {
  const events = [];
  const history = [{ role: 'user', text: 'Tôi dùng WordPress Hosting' }];
  const reply = await generateReply({ message: '  backup thế nào?  ', history }, {
    key: 'test-key', knowledge: { retrieve: (input) => {
      events.push('retrieve'); assert.equal(input.message, 'backup thế nào?');
      assert.deepEqual(input.history, history); return context();
    } }, fetcher: async () => { events.push('provider'); return provider(goodOutput); },
  });
  assert.deepEqual(events, ['retrieve', 'provider']);
  assert.equal(reply.kind, 'answer');
});

test('clarification fallback and booking avoid provider use and need no API key', async () => {
  for (const kind of ['clarify', 'fallback', 'booking']) {
    const reply = await generateReply({ message: 'Sen Hosting hoàn tiền như thế nào?' }, {
      key: '', knowledge: knowledge({ kind, text: 'Cần xác nhận thêm thông tin.', evidence: [] }),
      fetcher: async () => { assert.fail('provider must not run'); },
    });
    assert.equal(reply.kind, kind);
    assert.equal(reply.text, 'Cần xác nhận thêm thông tin.');
    assert.equal(reply.suggestions.length, 3);
  }
});

test('greetings and ordinary technical questions use Gemini naturally without knowledge retrieval', async () => {
  for (const message of ['Xin chào', 'n8n là gì?', 'Hosting và tên miền khác nhau thế nào?', 'Hôm nay trò chuyện chút nhé']) {
    let calls = 0;
    const reply = await generateReply({ message }, {
      key: 'test-key', knowledge: { retrieve: () => { assert.fail('general chat must bypass retrieval'); } },
      fetcher: async (url, options) => {
        calls++;
        const body = JSON.parse(options.body);
        const rendered = JSON.stringify(body);
        assert.match(rendered, /Sen Hosting/);
        assert.doesNotMatch(rendered, /VinaHost|vinahost\.vn|SEN-FIXTURE-BACKUP|KNOWLEDGE/);
        assert.ok(rendered.includes(message));
        return provider({ kind: 'answer', text: 'Mình là trợ lý Sen Hosting. Mình sẽ giải thích ngắn gọn theo câu hỏi của bạn.', relatedIds: [], sourceIds: [] });
      },
    });
    assert.equal(calls, 1, message);
    assert.equal(reply.kind, 'answer');
    assert.equal(reply.source, 'gemini');
    assert.equal(reply.route, 'general');
    assert.equal(reply.sources.length, 0);
  }
});

test('general Gemini chat needs credentials instead of silently using a fixed FAQ', async () => {
  await assert.rejects(generateReply({ message: 'n8n là gì?' }, { key: '',
    knowledge: { retrieve: () => { assert.fail('general chat must bypass retrieval'); } } }), /GEMINI_API_KEY/);
});

test('general and business answers expose three contextual model follow-ups', async () => {
  const questions = ['n8n kết nối những ứng dụng nào?', 'Bắt đầu tạo workflow n8n thế nào?', 'Cần lưu ý gì khi chạy n8n?'];
  const general = await generateReply({ message: 'n8n là gì?' }, {
    key: 'test', fetcher: async (url, options) => {
      const schema = JSON.parse(options.body).generationConfig.responseSchema;
      assert.ok(schema.required.includes('followUpQuestions'));
      assert.equal(schema.properties.followUpQuestions.minItems, 3);
      assert.equal(schema.properties.followUpQuestions.maxItems, 3);
      return provider({ ...goodOutput, text: 'n8n giúp tự động hóa quy trình.', sourceIds: [], followUpQuestions: questions });
    }
  });
  assert.deepEqual(general.suggestions, questions.map(question => ({ question })));
  const businessQuestions = ['Cách khôi phục bản sao lưu WordPress?', 'Tự tải bản sao lưu WordPress thế nào?', 'Kiểm tra bản sao lưu có hoạt động thế nào?'];
  const business = await call({ ...goodOutput, followUpQuestions: businessQuestions });
  assert.deepEqual(business.suggestions, businessQuestions.map(question => ({ question })));
});

test('retrieval fallback and booking also provide three questions when knowledge suggestions are sparse', () => {
  for (const kind of ['answer', 'clarify', 'fallback', 'booking']) {
    const reply = generateKnowledgeReply({ message: evidence.question }, {
      knowledge: knowledge({ kind, suggestions: [{ question: 'Có thể khôi phục bản sao lưu thế nào?' }] })
    });
    assert.equal(reply.suggestions.length, 3, kind);
    assert.equal(new Set(reply.suggestions.map(item => item.question)).size, 3);
  }
});

test('Gemini can request company data after a general question without publishing a guessed policy', async () => {
  let retrievals = 0;
  const reply = await generateReply({ message: 'Mình cần hỏi thêm thông tin cho website' }, {
    key: 'test-key',
    knowledge: { retrieve: input => {
      retrievals++;
      assert.equal(input.forceBusiness, true);
      return context({ kind: 'fallback', text: 'Sen Hosting cần xác nhận thông tin dịch vụ.', evidence: [] });
    } },
    fetcher: async () => provider({ kind: 'answer', text: 'UNVERIFIED-PRICE', needsCompanyData: true, relatedIds: [], sourceIds: [] })
  });
  assert.equal(retrievals, 1);
  assert.equal(reply.route, 'business');
  assert.equal(reply.kind, 'fallback');
  assert.doesNotMatch(reply.text, /UNVERIFIED-PRICE/);
});

test('source-only mode returns actual evidence with the shared source contract', async () => {
  const reply = await generateKnowledgeReply({ message: evidence.question }, { knowledge: knowledge() });
  assert.equal(reply.kind, 'answer');
  assert.match(reply.text, /4 lần\/ngày/);
  assert.match(reply.text, /1 tuần/);
  assert.equal(reply.sources[0].id, evidence.id);
  assert.equal(reply.suggestions.length, 3);
});

test('prices needing confirmation return source-linked fallback without provider use', async () => {
  const price = { ...evidence, id: 'PRICE', topic: 'pricing', requiresConfirmation: true,
    answer: 'Giá snapshot 13.000đ/tháng.', text: 'Giá snapshot 13.000đ/tháng.' };
  const reply = await generateReply({ message: 'Giá hosting bao nhiêu?' }, {
    key: 'test', knowledge: knowledge({ kind: 'fallback', text: 'Cần xác nhận bảng giá và chu kỳ.', evidence: [price] }),
    fetcher: async () => { assert.fail('confirmation must not call Gemini'); },
  });
  assert.equal(reply.kind, 'fallback');
  assert.doesNotMatch(reply.text, /13[.,]?000|49[.,]?000|99[.,]?000/);
  assert.ok(reply.sources.length);
});

test('unretrieved or absent source IDs cannot authorize generated answers', async () => {
  for (const sourceIds of [['F03'], ['UNRETRIEVED'], ['SEN-FIXTURE-BACKUP', 'UNRETRIEVED'], []]) {
    const reply = await call({ ...goodOutput, text: 'UNSUPPORTED-GENERATED-PROMISE', sourceIds });
    assert.notEqual(reply.text, 'UNSUPPORTED-GENERATED-PROMISE');
    assert.ok(reply.sources.every(item => item.id === evidence.id));
    assert.equal(reply.suggestions.length, 3);
  }
});

test('unsupported numeric promises are replaced with deterministic source text', async () => {
  const reply = await call({ ...goodOutput, text: 'Dữ liệu được sao lưu 99 lần/ngày và giữ 365 ngày.' });
  assert.doesNotMatch(reply.text, /99 lần|365 ngày/);
  assert.match(reply.text, /4 lần\/ngày/);
  assert.ok(reply.sources.every(item => item.id === evidence.id));
});

test('generated answer cannot transfer verified backup facts to another named product', async () => {
  const reply = await call({ ...goodOutput, text: 'Windows Hosting được sao lưu 4 lần/ngày và giữ trong 1 tuần.' });
  assert.doesNotMatch(reply.text, /Windows Hosting/);
  assert.equal(reply.source, 'knowledge');
});

test('verified numbers cannot change backup frequency denominator', async () => {
  const reply = await call({ ...goodOutput, text: 'Dữ liệu được sao lưu 4 lần/tháng và giữ trong 1 tuần.' });
  assert.doesNotMatch(reply.text, /4 lần\/tháng/);
  assert.match(reply.text, /4 lần\/ngày/);
  assert.equal(reply.source, 'knowledge');
});

test('source metadata comes from entries rather than model-supplied URLs', async () => {
  const reply = await call({ ...goodOutput, sources: [{ id: evidence.id, sourceUrl: 'https://evil.example/' }],
    sourceUrl: 'javascript:alert(1)' });
  const serialized = JSON.stringify(reply.sources);
  assert.ok(serialized.includes('/knowledge/SEN-FIXTURE-BACKUP'));
  assert.doesNotMatch(serialized, /evil\.example|javascript:/);
  assert.ok(serialized.includes('2026-11-07'));
});

test('invalid suggestion IDs are replaced with three unique trusted suggestions', async () => {
  const reply = await call({ ...goodOutput, relatedIds: ['FAKE', 'FAKE', evidence.id] });
  assert.equal(reply.suggestions.length, 3);
  assert.equal(new Set(reply.suggestions.map(item => item.id)).size, 3);
  assert.ok(reply.suggestions.every(item => item.id !== 'FAKE'));
});

test('business follow-ups without FAQ IDs retain all contextual fallback questions', async () => {
  const fallback = ['Cách khôi phục bản sao lưu WordPress?', 'Kiểm tra bản sao lưu WordPress thế nào?', 'Tự tải bản sao lưu WordPress thế nào?']
    .map(question => ({ question }));
  for (const followUpQuestions of [[], ['Làm sao bảo vệ bản sao lưu WordPress?']]) {
    const reply = await call({ ...goodOutput, followUpQuestions }, { knowledge: knowledge({ suggestions: fallback }) });
    assert.equal(reply.suggestions.length, 3);
    assert.ok(reply.suggestions.every(item => /WordPress/.test(item.question)));
    assert.deepEqual(reply.suggestions[followUpQuestions.length], fallback[0]);
  }
});

test('grounded generation still requires credentials', async () => {
  await assert.rejects(call(goodOutput, { key: '' }), /GEMINI_API_KEY/);
});

test('provider status and network failures return safe errors instead of hidden mock answers', async () => {
  for (const status of [429, 400, 401, 403, 500]) {
    await assert.rejects(call(goodOutput, { fetcher: async () => Response.json({ secret: 'DO-NOT-EXPOSE' }, { status }) }),
      error => !error.message.includes('DO-NOT-EXPOSE'));
  }
  await assert.rejects(call(goodOutput, { fetcher: async () => { throw new Error('PRIVATE-NETWORK-DETAIL'); } }),
    error => !error.message.includes('PRIVATE-NETWORK-DETAIL'));
});

test('malformed blocked and incomplete provider output never becomes an answer', async () => {
  for (const response of [Response.json({ candidates: [] }),
    Response.json({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: JSON.stringify(goodOutput) }] } }] }),
    Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not-json' }] } }] }),
    provider({ ...goodOutput, kind: 'unknown' }), provider({ ...goodOutput, text: '' })]) {
    await assert.rejects(call(goodOutput, { fetcher: async () => response }));
  }
});

test('retrieval failure differs from a legitimate no-evidence fallback', async () => {
  await assert.rejects(generateReply({ message: 'Hosting có backup không?' }, {
    key: 'test', knowledge: { retrieve: () => { throw new Error('Knowledge unavailable'); } },
    fetcher: async () => { assert.fail('provider must not run'); },
  }));
});
