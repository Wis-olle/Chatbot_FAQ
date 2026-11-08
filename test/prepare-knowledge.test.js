import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { cleanChunk, normalizeRecord, prepareKnowledge, writePreparedKnowledge } from '../vinahost-faq/prepare-knowledge.js';

const url = 'https://vinahost.vn/windows-hosting/';
const source = { id: 'source1', url, title: 'Windows Hosting', category: 'hosting', fetched_at: '2026-11-07T05:00:00Z',
  text: 'Windows Hosting hỗ trợ ASP.NET. Các gói Windows Hosting hỗ trợ sao lưu 2 lần/ngày, lưu dữ liệu trong 1 tuần.' };
const faq = { id: 'backup1', source_id: source.id, source_url: url, question: 'Windows Hosting được sao lưu như thế nào?',
  answer: 'Các gói Windows Hosting hỗ trợ sao lưu 2 lần/ngày, lưu dữ liệu trong 1 tuần.', extraction_method: 'html-faq' };
const curation = { faqIds: [faq.id], documents: [], serviceLabels: { 'windows-hosting': 'Windows Hosting' } };
const digest = value => createHash('sha256').update(value).digest('hex');

test('normalization retains service-specific source metadata and honest review status', () => {
  const record = normalizeRecord(faq, source, curation);
  assert.equal(record.service, 'windows-hosting');
  assert.equal(record.serviceLabel, 'Windows Hosting');
  assert.equal(record.topic, 'backup');
  assert.equal(record.plan, null);
  assert.equal(record.sourceUrl, url);
  assert.equal(record.fetchedAt, source.fetched_at);
  assert.equal(record.reviewStatus, 'source_checked');
  assert.equal(record.reviewMethod, 'literal-source-consistency');
  assert.ok(record.contentHash);
});

test('selected FAQ whose answer is absent from the source remains pending', () => {
  const result = prepareKnowledge({ sources: [source], faqs: [{ ...faq, answer: 'Hoàn tiền 60 ngày vô điều kiện.' }], chunks: [], curation });
  assert.equal(result.entries.length, 0);
  assert.equal(result.reviewQueue[0].reason, 'answer-not-found-in-source');
});

test('changed FAQ answer remains quarantined even when updated source contains it until its pin is reviewed', () => {
  const originalHash = digest(faq.question + '\n' + faq.answer);
  const answer = 'Các gói Windows Hosting sao lưu mỗi giờ.';
  const updated = { ...faq, answer, content_hash: digest(faq.question + '\n' + answer) };
  const updatedSource = { ...source, text: updated.answer };
  const pinned = { ...curation, expectedFaqHashes: { [faq.id]: originalHash } };
  const stalePin = prepareKnowledge({ sources: [updatedSource], faqs: [updated], chunks: [], curation: pinned });
  assert.equal(stalePin.entries.length, 0);
  assert.equal(stalePin.reviewQueue[0].reason, 'source-content-changed-needs-review');
  const renewedPin = prepareKnowledge({ sources: [updatedSource], faqs: [updated], chunks: [],
    curation: { ...pinned, expectedFaqHashes: { [faq.id]: updated.content_hash } } });
  assert.equal(renewedPin.entries.length, 1);
});

test('unchanged FAQ hash activates; missing pin in an enabled pin set never activates silently', () => {
  const original = { ...faq, content_hash: digest(faq.question + '\n' + faq.answer) };
  const retained = prepareKnowledge({ sources: [source], faqs: [original], chunks: [],
    curation: { ...curation, expectedFaqHashes: { [faq.id]: original.content_hash } } });
  assert.equal(retained.entries.length, 1);
  const missing = prepareKnowledge({ sources: [source], faqs: [original], chunks: [],
    curation: { ...curation, expectedFaqHashes: {} } });
  assert.equal(missing.entries.length, 0);
  assert.equal(missing.reviewQueue[0].reason, 'source-content-changed-needs-review');
});

test('a changed FAQ cannot reuse its old content_hash field to pass the pinned-hash gate', () => {
  const originalHash = digest(faq.question + '\n' + faq.answer);
  const changed = { ...faq, answer: 'Windows Hosting sao lưu mỗi giờ.', content_hash: originalHash };
  const result = prepareKnowledge({ sources: [{ ...source, text: changed.answer }], faqs: [changed], chunks: [],
    curation: { ...curation, expectedFaqHashes: { [faq.id]: originalHash } } });
  assert.equal(result.entries.length, 0);
  assert.equal(result.reviewQueue[0].reason, 'source-content-changed-needs-review');
});

test('literal FAQ content present in matching saved raw HTML can verify a truncated text extraction', () => {
  const shortSource = { ...source, text: 'Trang chỉ trích được phần bảng giá.' };
  const rawBySource = new Map([[source.id, `${faq.question} ${faq.answer}`]]);
  const result = prepareKnowledge({ sources: [shortSource], faqs: [faq], chunks: [], curation, rawBySource });
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].reviewMethod, 'literal-raw-html-consistency');
});

test('same-service duplicates are grouped; another service remains distinct', () => {
  const otherSource = { ...source, id: 'source2', url: 'https://vinahost.vn/wordpress-hosting/', title: 'WordPress Hosting' };
  const other = { ...faq, id: 'backup2', source_id: otherSource.id, source_url: otherSource.url };
  const duplicate = { ...faq, id: 'backup3', question: '1. WINDOWS HOSTING được sao lưu như thế nào?' };
  const result = prepareKnowledge({ sources: [source, otherSource], faqs: [faq, duplicate, other], chunks: [],
    curation: { ...curation, faqIds: [faq.id, duplicate.id, other.id] } });
  assert.equal(result.entries.length, 2);
  assert.deepEqual(new Set(result.entries.map(e => e.service)), new Set(['windows-hosting', 'wordpress-hosting']));
  assert.equal(result.stats.duplicateFaqs, 1);
});

test('unselected records are placed in a review queue and never activated', () => {
  const result = prepareKnowledge({ sources: [source], faqs: [faq, { ...faq, id: 'not-selected' }], chunks: [], curation });
  assert.equal(result.entries.length, 1);
  assert.equal(result.reviewQueue.find(r => r.id === 'not-selected').reason, 'not-selected-for-source-check');
});

test('symbol-only, isolated table cells, short UI and numeric fragments are removed', () => {
  for (const text of ['|', 'Mua ngay', 'RAM | 4 GB | Gói 1', '123 456 789', 'SSL']) {
    assert.equal(cleanChunk({ text, heading: 'Thông số', source_url: url }), null, text);
  }
  const text = 'Dữ liệu website được sao lưu định kỳ để hỗ trợ khôi phục khi xảy ra sự cố. Người dùng cần kiểm tra bản sao lưu phù hợp và chủ động sao lưu độc lập cho dữ liệu quan trọng.';
  assert.equal(cleanChunk({ text, heading: 'Sao lưu', source_url: url }).text, text);
});

test('cleaned chunks are not silently enabled as chatbot knowledge', () => {
  const chunk = { id: 'chunk1', source_id: source.id, source_url: url, heading: 'Sao lưu', text: source.text.repeat(2) };
  const result = prepareKnowledge({ sources: [source], faqs: [], chunks: [chunk], curation: { faqIds: [], documents: [] } });
  assert.equal(result.entries.length, 0);
  assert.equal(result.cleanedChunks.length, 1);
  assert.equal(result.cleanedChunks[0].reviewStatus, 'pending_review');
  assert.equal(result.cleanedChunks[0].active, false);
});

test('official policy document preserves all selected conditions and is marked confirmation-required', () => {
  const policySource = { ...source, id: 'policy', url: 'https://vinahost.vn/chinh-sach-hoan-tien/',
    category: 'policy', text: 'Áp dụng Hosting tại Việt Nam. Không áp dụng cho khuyến mãi. Yêu cầu trong 5 ngày.' };
  const result = prepareKnowledge({ sources: [policySource], faqs: [], chunks: [], curation: { faqIds: [], documents: [
    { id: 'VH-REFUND', sourceUrl: policySource.url, question: 'Chính sách hoàn tiền áp dụng như thế nào?', topic: 'refund', requiresConfirmation: true }
  ] } });
  assert.equal(result.entries[0].answer, policySource.text);
  assert.equal(result.entries[0].kind, 'document');
  assert.equal(result.entries[0].requiresConfirmation, true);
});

test('curated document pin covers the normalized selected answer and blocks newly changed source content', () => {
  const definition = { id: 'DOC', sourceUrl: source.url, question: 'Windows Hosting là gì?', topic: 'general' };
  const expected = digest(source.text);
  const pinned = { faqIds: [], documents: [definition], expectedDocumentHashes: { DOC: expected } };
  const unchanged = prepareKnowledge({ sources: [{ ...source, text: source.text.replaceAll(' ', '  ') }], faqs: [], chunks: [], curation: pinned });
  assert.equal(unchanged.entries.length, 1);
  const changedSource = { ...source, text: source.text + ' Tính năng mới chưa được kiểm tra.' };
  const changed = prepareKnowledge({ sources: [changedSource], faqs: [], chunks: [], curation: pinned });
  assert.equal(changed.entries.length, 0);
  assert.equal(changed.reviewQueue[0].kind, 'document');
  assert.equal(changed.reviewQueue[0].reason, 'source-content-changed-needs-review');
  assert.equal(changed.stats.pendingDocuments, 1);
  assert.equal(changed.stats.pendingFaqs, 0);
  const renewed = prepareKnowledge({ sources: [changedSource], faqs: [], chunks: [],
    curation: { ...pinned, expectedDocumentHashes: { DOC: digest(changedSource.text) } } });
  assert.equal(renewed.entries.length, 1);
});

test('curated section boundaries distinguish repeated inline text from a heading and preserve complete sentences', () => {
  const text = 'Hướng dẫn thanh toán\nVINAHOST hỗ trợ Chuyển khoản / Thanh toán trực tuyến / Thanh toán thẻ / Thanh toán trực tiếp tại văn phòng.\nThanh toán trực tiếp\nĐến văn phòng để thanh toán.';
  const paymentSource = { ...source, url: 'https://vinahost.vn/thanh-toan/', text };
  const result = prepareKnowledge({ sources: [paymentSource], faqs: [], chunks: [], curation: { faqIds: [], documents: [
    { id: 'PAYMENT', sourceUrl: paymentSource.url, question: 'Thanh toán bằng cách nào?', topic: 'payment',
      start: 'VINAHOST hỗ trợ', end: '\nThanh toán trực tiếp\n' }
  ] } });
  assert.match(result.entries[0].answer, /Thanh toán trực tiếp tại văn phòng\.$/);
  assert.doesNotMatch(result.entries[0].answer, /Đến văn phòng/);
});

test('money amounts and pricing intent require confirmation instead of old demo prices', () => {
  const priced = { ...faq, question: 'Hosting giá bao nhiêu?', answer: 'Gói hosting giá 13.000đ/tháng khi áp dụng điều kiện.' };
  const value = normalizeRecord(priced, { ...source, text: priced.answer }, curation);
  assert.equal(value.topic, 'pricing');
  assert.equal(value.requiresConfirmation, true);
});

test('invalid source linkage and unsafe sources fail validation', () => {
  assert.throws(() => normalizeRecord(faq, { ...source, url: 'https://evil.example/' }, curation), /source/i);
  assert.throws(() => prepareKnowledge({ sources: [source], faqs: [{ ...faq, source_id: 'missing' }], chunks: [], curation }), /source/i);
});

test('exports carry snapshot provenance and preserve the old files on invalid input', async () => {
  const path = await mkdtemp(join(tmpdir(), 'vinahost-prepared-'));
  try {
    const prepared = prepareKnowledge({ sources: [source], faqs: [faq], chunks: [], curation });
    await writePreparedKnowledge(prepared, path);
    const original = await readFile(join(path, 'knowledge.json'), 'utf8');
    assert.equal(JSON.parse(original).entries[0].sourceUrl, url);
    assert.ok((await readFile(join(path, 'review-queue.csv'), 'utf8')).includes('reason'));
    await assert.rejects(writePreparedKnowledge({ entries: null }, path));
    assert.equal(await readFile(join(path, 'knowledge.json'), 'utf8'), original);
  } finally { await rm(path, { recursive: true, force: true }); }
});
