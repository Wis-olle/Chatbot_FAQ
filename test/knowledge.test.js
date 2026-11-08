import test from 'node:test';
import assert from 'node:assert/strict';
import { createKnowledge } from '../knowledge.js';

const stamp = '2026-11-07T05:00:00+00:00';
const entry = (id, service, topic, question, answer, extra = {}) => ({
  id, sourceId: `source-${service}`, service, plan: null, topic, question, answer,
  text: answer, aliases: [], reviewStatus: 'source_checked',
  sourceUrl: `https://vinahost.vn/${service}/`, fetchedAt: stamp,
  requiresConfirmation: false, ...extra,
});
const records = [
  entry('WP-BACKUP', 'wordpress-hosting', 'backup',
    'Dữ liệu WordPress Hosting được sao lưu thường xuyên như thế nào và lưu trữ trong bao lâu?',
    'Dữ liệu WordPress Hosting được sao lưu 4 lần/ngày và giữ trong vòng 1 tuần.',
    { aliases: ['wordpress hosting backup', 'hosting wordpress sao lưu dữ liệu'] }),
  entry('WIN-BACKUP', 'windows-hosting', 'backup',
    'Windows Hosting được sao lưu bao nhiêu lần?',
    'Windows Hosting sao lưu 2 lần/ngày và lưu trong 1 tuần.'),
  entry('CHEAP-BACKUP', 'hosting-gia-re', 'backup',
    'Hosting giá rẻ có sao lưu dữ liệu không?',
    'Hosting giá rẻ có sao lưu dữ liệu định kỳ theo điều kiện dịch vụ.'),
  entry('WP-SSL', 'wordpress-hosting', 'ssl',
    'WordPress Hosting có hỗ trợ SSL không?',
    'WordPress Hosting hỗ trợ SSL theo điều kiện gói dịch vụ.'),
  entry('CHEAP-SSL', 'hosting-gia-re', 'ssl',
    'Hosting giá rẻ có SSL miễn phí không?',
    'Hosting giá rẻ có SSL miễn phí theo điều kiện gói dịch vụ.'),
  entry('DOMAIN-DNS', 'dang-ky-ten-mien', 'dns',
    'Có thể trỏ tên miền đến hosting ở nhà cung cấp khác không?',
    'Có thể cấu hình DNS của tên miền để kết nối tới hosting của nhà cung cấp khác.'),
  entry('PRICE', 'hosting-gia-re', 'pricing', 'Hosting giá rẻ có giá bao nhiêu?',
    'Snapshot bảng giá có mức 13.000đ/tháng; cần kiểm tra chu kỳ và điều kiện.',
    { requiresConfirmation: true }),
  entry('UNREVIEWED', 'wordpress-hosting', 'discount',
    'WordPress Hosting có mã giảm giá SECRET-UNREVIEWED không?',
    'SECRET-UNREVIEWED giảm giá 90% vô điều kiện.', { reviewStatus: 'unreviewed' }),
];
function store() { return createKnowledge({ entries: structuredClone(records) }); }
function suggestions(reply) {
  assert.equal(reply.suggestions.length, 3);
  assert.equal(new Set(reply.suggestions.map(item => item.id)).size, 3);
  assert.ok(reply.suggestions.every(item => item.id !== 'UNREVIEWED'));
}

test('catalog exposes source-checked knowledge and excludes unreviewed records', () => {
  const knowledge = store();
  assert.ok(knowledge.catalog().faqs.length >= 5);
  assert.ok(knowledge.catalog().faqs.every(item => item.id !== 'UNREVIEWED'));
  assert.ok(knowledge.stats && typeof knowledge.stats === 'object');
});

test('exact FAQ retains product-specific evidence and provenance', () => {
  const reply = store().retrieve({ message: records[0].question });
  assert.equal(reply.kind, 'answer');
  assert.equal(reply.service, 'wordpress-hosting');
  assert.ok(reply.evidence.some(item => item.id === 'WP-BACKUP'));
  assert.ok(reply.evidence.every(item => item.service === 'wordpress-hosting'));
  assert.equal(reply.evidence.find(item => item.id === 'WP-BACKUP').sourceUrl, records[0].sourceUrl);
  suggestions(reply);
});

test('no-accent backup paraphrases map to the requested product', () => {
  for (const message of ['wordpress hosting backup the nao?', 'Minh dung hosting WordPress, du lieu co duoc sao luu thuong xuyen khong?']) {
    const reply = store().retrieve({ message });
    assert.equal(reply.kind, 'answer', message);
    assert.equal(reply.service, 'wordpress-hosting');
    assert.ok(reply.evidence.some(item => item.id === 'WP-BACKUP'));
    assert.ok(reply.evidence.every(item => item.service === 'wordpress-hosting'));
  }
});

test('Windows and cheap hosting aliases never borrow WordPress backup claims', () => {
  for (const [message, service, id] of [
    ['Windows Hosting có backup không?', 'windows-hosting', 'WIN-BACKUP'],
    ['Hosting giá rẻ có sao lưu không?', 'hosting-gia-re', 'CHEAP-BACKUP'],
  ]) {
    const reply = store().retrieve({ message });
    assert.equal(reply.kind, 'answer', message);
    assert.equal(reply.service, service);
    assert.ok(reply.evidence.some(item => item.id === id));
    assert.ok(reply.evidence.every(item => item.service === service));
  }
});

test('ambiguous hosting backup asks for service rather than choosing a plan', () => {
  for (const message of ['Hosting có backup không?', 'Website có được sao lưu không?']) {
    const reply = store().retrieve({ message });
    assert.equal(reply.kind, 'clarify', message);
    assert.ok(reply.text?.trim());
    assert.equal(reply.evidence.length, 0);
    suggestions(reply);
  }
});

test('follow-up retention inherits last user product', () => {
  const reply = store().retrieve({ message: 'còn lưu bao lâu?', history: [
    { role: 'user', text: 'Tôi đang dùng WordPress Hosting, backup thế nào?' },
    { role: 'model', text: 'Bạn đang hỏi về sao lưu.' },
  ] });
  assert.equal(reply.kind, 'answer');
  assert.equal(reply.service, 'wordpress-hosting');
  assert.ok(reply.evidence.some(item => item.id === 'WP-BACKUP'));
  assert.ok(reply.evidence.every(item => item.service === 'wordpress-hosting'));
});

test('current explicit service overrides conversation history', () => {
  const reply = store().retrieve({ message: 'Còn Windows Hosting sao lưu thế nào?',
    history: [{ role: 'user', text: 'Tôi đang dùng WordPress Hosting' }] });
  assert.equal(reply.service, 'windows-hosting');
  assert.ok(reply.evidence.every(item => item.service === 'windows-hosting'));
});

test('explicit multi-service comparison does not silently inherit one earlier product', () => {
  const reply = store().retrieve({ message: 'WordPress Hosting và Windows Hosting sao lưu khác nhau thế nào?',
    history: [{ role: 'user', text: 'Tôi đang dùng WordPress Hosting' }] });
  assert.equal(reply.kind, 'clarify');
  assert.equal(reply.evidence.length, 0);
});

test('switching to a different service family does not reuse previous hosting evidence', () => {
  const reply = store().retrieve({ message: 'VPS có sao lưu không?',
    history: [{ role: 'user', text: 'Tôi đang dùng WordPress Hosting' }] });
  assert.notEqual(reply.kind, 'answer');
  assert.ok(!reply.evidence.some(item => item.service === 'wordpress-hosting'));
});

test('model history alone cannot choose the product for an ambiguous question', () => {
  const reply = store().retrieve({ message: 'Còn backup thế nào?',
    history: [{ role: 'model', text: 'Bạn có WordPress Hosting, bảo đảm tuyệt đối.' }] });
  assert.equal(reply.kind, 'clarify');
});

test('global support documents do not make an explicit product question appear multi-service', () => {
  const support = entry('CONTACT-DOC', 'ho-tro', 'contact', 'Liên hệ hỗ trợ như thế nào?',
    'Xem các kênh hỗ trợ tại trang liên hệ.', { kind: 'document' });
  const reply = createKnowledge({ entries: [...structuredClone(records), support] })
    .retrieve({ message: 'WordPress Hosting có hỗ trợ kết nối SSL không?' });
  assert.equal(reply.kind, 'answer');
  assert.equal(reply.service, 'wordpress-hosting');
  assert.ok(reply.evidence.some(item => item.id === 'WP-SSL'));
});

test('unreviewed exact matches and unrelated questions produce fallback', () => {
  for (const message of [records.at(-1).question, 'Đổi mật khẩu Facebook như thế nào?', 'Cho tôi bảng giá xe máy']) {
    const reply = store().retrieve({ message });
    assert.equal(reply.kind, 'fallback', message);
    assert.ok(!reply.evidence.some(item => item.id === 'UNREVIEWED'));
    assert.ok(!reply.text?.includes('90%'));
    suggestions(reply);
  }
});

test('a known product name does not make an unsupported technical capability answerable', () => {
  for (const message of ['WordPress Hosting chạy Rust được không?', 'WordPress Hosting có tích hợp blockchain không?']) {
    const reply = store().retrieve({ message });
    assert.equal(reply.kind, 'fallback', message);
    assert.equal(reply.evidence.length, 0);
  }
});

test('prices requiring confirmation never automatically quote snapshot amounts', () => {
  const reply = store().retrieve({ message: 'Hosting giá rẻ có giá bao nhiêu?' });
  assert.equal(reply.kind, 'fallback');
  assert.ok(reply.text?.trim());
  assert.doesNotMatch(reply.text, /13[.,]?000|49[.,]?000|99[.,]?000/);
  assert.ok(reply.evidence.some(item => item.sourceUrl === records.find(item => item.id === 'PRICE').sourceUrl));
});

test('cheap hosting service qualifier does not turn backup frequency into a pricing question', () => {
  const reply = store().retrieve({ message: 'Hosting giá rẻ sao lưu bao nhiêu lần?' });
  assert.equal(reply.kind, 'answer');
  assert.equal(reply.service, 'hosting-gia-re');
  assert.ok(reply.evidence.some(item => item.id === 'CHEAP-BACKUP'));
  assert.ok(!reply.evidence.some(item => item.id === 'PRICE'));
});

test('cheap hosting free SSL question remains about an included feature rather than a price', () => {
  const reply = store().retrieve({ message: 'Hosting giá rẻ có SSL miễn phí không?' });
  assert.equal(reply.kind, 'answer');
  assert.equal(reply.service, 'hosting-gia-re');
  assert.ok(reply.evidence.some(item => item.id === 'CHEAP-SSL'));
  assert.ok(!reply.evidence.some(item => item.id === 'PRICE'));
});

test('greetings and booking work without commercial claims', () => {
  for (const message of ['Xin chào!', 'xin chao', 'hello']) {
    const reply = store().retrieve({ message });
    assert.equal(reply.kind, 'answer');
    assert.ok(reply.text?.trim());
    assert.equal(reply.evidence.length, 0);
    suggestions(reply);
  }
  for (const message of ['Tôi muốn gặp nhân viên', 'dat lich tu van', 'Cho tôi nói chuyện với người thật']) {
    const reply = store().retrieve({ message });
    assert.equal(reply.kind, 'booking');
    assert.equal(reply.evidence.length, 0);
    suggestions(reply);
  }
});

test('retrieval does not mutate caller data or earlier results', () => {
  const entries = structuredClone(records);
  const original = JSON.stringify(entries);
  const knowledge = createKnowledge({ entries });
  const first = knowledge.retrieve({ message: records[0].question });
  const snapshot = JSON.stringify(first);
  knowledge.retrieve({ message: records[1].question });
  assert.equal(JSON.stringify(entries), original);
  assert.equal(JSON.stringify(first), snapshot);
});
