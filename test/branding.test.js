import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getKnowledge, createKnowledge } from '../knowledge.js';
import { generateKnowledgeReply } from '../ai.js';

const knowledge = getKnowledge();
const foreign = /VinaHost|vinahost\.vn|1900\s*6046|351\/31|Nơ Trang Long/i;

test('public Sen Hosting catalog uses authored brand data and internal source links', () => {
  const catalog = knowledge.catalog();
  assert.equal(catalog.brandName, 'Sen Hosting');
  assert.ok(catalog.faqs.length >= 30);
  assert.doesNotMatch(JSON.stringify(catalog), foreign);
  for (const faq of catalog.faqs) assert.match(faq.id, /^SEN-/);
});

test('service navigation comes from all seven product groups rather than FAQ headings', () => {
  const topics = knowledge.catalog().topics;
  assert.deepEqual(topics.map(topic => topic.label), [
    'Hosting giá rẻ', 'WordPress Hosting', 'Windows Hosting', 'Hosting doanh nghiệp',
    'VPS SSD', 'VPS n8n', 'Email Hosting'
  ]);
  assert.deepEqual(topics.map(topic => topic.description), [7, 5, 7, 4, 7, 6, 12].map(count => `${count} gói dịch vụ`));
  assert.equal(new Set(topics.map(topic => topic.id)).size, 7);
  for (const topic of topics) {
    assert.equal(topic.question, `Tư vấn các gói ${topic.label} của Sen Hosting`);
    assert.equal(topic.faqId, undefined);
  }
});

test('general education answers carry Sen Hosting internal knowledge provenance', () => {
  for (const message of ['Hosting và tên miền khác nhau thế nào?', 'SSL là gì?', 'DNS là gì?', 'VPS là gì?']) {
    const reply = generateKnowledgeReply({ message }, { knowledge });
    assert.equal(reply.kind, 'answer', message);
    assert.doesNotMatch(JSON.stringify(reply), foreign);
    assert.ok(reply.sources.length > 0, message);
    assert.ok(reply.sources.every(item => item.url?.startsWith('/knowledge/SEN-')));
    assert.ok(reply.sources.every(item => item.reviewStatus === 'sen_published'));
  }
});

test('unconfirmed business claims are not inherited from an external provider', () => {
  const questions = [
    'WordPress Hosting sao lưu bao nhiêu lần?',
    'Sen Hosting có hoàn tiền trong 30 ngày không?',
    'Số điện thoại và địa chỉ Sen Hosting là gì?',
    'Sen Hosting cam kết uptime bao nhiêu?',
    'Thanh toán Sen Hosting bằng tài khoản ngân hàng nào?'
  ];
  for (const message of questions) {
    const reply = generateKnowledgeReply({ message }, { knowledge });
    assert.equal(reply.kind, 'fallback', message);
    assert.doesNotMatch(JSON.stringify(reply), foreign);
    assert.doesNotMatch(reply.text, /4 lần\/ngày|2 lần\/ngày|49[.,]?000|99[.,]?000|13[.,]?000/);
  }
});

test('imported catalog is available for recommendations while prices remain snapshot-qualified', () => {
  const consultation = knowledge.forConsultation({ message:'Sen Hosting có tên miền nào phù hợp cho shop của mình?' });
  assert.equal(consultation.catalog.status, 'ready');
  assert.ok(consultation.catalog.items.some(item => item.name === '.com'));
  assert.ok(consultation.catalog.items.some(item => item.name === '.vn'));
  assert.ok(consultation.catalog.items.every(item => item.price.verifiedCurrent === false));
  assert.equal(consultation.availability.checked, false);
});

test('greeting and suggestions consistently introduce Sen Hosting', () => {
  const reply = generateKnowledgeReply({ message: 'Xin chào!' }, { knowledge });
  assert.equal(reply.kind, 'answer');
  assert.match(reply.text, /Sen Hosting/);
  assert.doesNotMatch(JSON.stringify(reply), foreign);
  assert.equal(reply.suggestions.length, 3);
});

const companyEntry = (id, topic, question, answer, extra = {}) => ({
  id, kind: 'faq', topic, question, answer, aliases: [],
  service: 'hosting-gia-re', serviceLabel: 'Hosting', title: 'Sen Hosting — kiểm thử',
  sourceUrl: '/knowledge/' + id, fetchedAt: '2026-11-07T05:00:00Z',
  reviewStatus: 'sen_approved', companySpecific: true, requiresConfirmation: false, ...extra
});

test('one approved company record cannot authorize unrelated general or pending business evidence', () => {
  const contact = companyEntry('SEN-TEST-CONTACT', 'contact', 'Liên hệ Sen Hosting như thế nào?',
    'Liên hệ qua địa chỉ trong hồ sơ kiểm thử.');
  const general = companyEntry('SEN-TEST-GENERAL-BACKUP', 'backup', 'WordPress Hosting có backup không?',
    'Backup là bản sao dữ liệu phục vụ khôi phục.', { reviewStatus: 'sen_published', companySpecific: false, service: 'wordpress-hosting' });
  const pending = companyEntry('SEN-TEST-PENDING-BACKUP', 'backup', 'WordPress Hosting backup mấy lần mỗi ngày?',
    'UNAPPROVED-BACKUP-PROMISE', { reviewStatus: 'sen_published', service: 'wordpress-hosting' });
  const store = createKnowledge({ entries: [contact, general, pending], businessProfile: { brandName: 'Sen Hosting' } });
  for (const message of [general.question, pending.question, 'Sen Hosting có hoàn tiền không?']) {
    const reply = store.retrieve({ message });
    assert.equal(reply.kind, 'fallback', message);
    assert.equal(reply.evidence.length, 0, message);
    assert.doesNotMatch(reply.text, /UNAPPROVED-BACKUP-PROMISE/);
  }
});

test('a specifically approved Sen Hosting price can be answered from its own record', () => {
  const price = companyEntry('SEN-TEST-APPROVED-PRICE', 'pricing', 'Sen Hosting có giá bao nhiêu?',
    'Giá trong bộ kiểm thử là 777.000đ/tháng; đây là dữ liệu fixture đã phê duyệt.');
  const unrelated = companyEntry('SEN-TEST-UNRELATED', 'general', 'Hosting là gì?', 'Hosting lưu trữ website.',
    { reviewStatus: 'sen_published', companySpecific: false });
  const store = createKnowledge({ entries: [price, unrelated], businessProfile: { brandName: 'Sen Hosting' } });
  const reply = store.retrieve({ message: price.question });
  assert.equal(reply.kind, 'answer');
  assert.match(reply.text, /777\.000đ\/tháng/);
  assert.deepEqual(reply.evidence.map(item => item.id), [price.id]);
});
