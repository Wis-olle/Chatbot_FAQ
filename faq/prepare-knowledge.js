import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { readFile, writeFile, mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
const clean = value => String(value ?? '').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
const fold = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
const literal = value => fold(value).replace(/[^a-z0-9]/g, '');
const questionKey = value => fold(value).replace(/^\d+[.)]\s*/, '').replace(/[^a-z0-9]/g, '');

function verifySource(source) {
  let url;
  try { url = new URL(source?.url); } catch { throw new Error('Invalid source URL'); }
  if (url.origin !== 'https://vinahost.vn' || url.search || url.username || url.password ||
      !source.id || !source.title || !source.text || !Number.isFinite(Date.parse(source.fetched_at))) {
    throw new Error('Invalid source metadata');
  }
  return url;
}

export function inferTopic(question) {
  const text = fold(question);
  const rules = [
    ['refund', /hoan tien|refund/], ['backup', /sao luu|backup|khoi phuc/],
    ['pricing', /gia bao nhieu|chi phi|bang gia|muc gia|tinh gia|phi bao nhieu|gia cua|dung thu|trial/],
    ['payment', /thanh toan|chuyen khoan|hoa don/], ['renewal', /gia han|het han/],
    ['migration', /chuyen (?:du lieu|website|domain|ten mien)|migration|doi nha dang ky/],
    ['upgrade', /nang cap|ha goi|dung luong luu tru/], ['ssl', /ssl|https|tls/],
    ['contact', /dia chi(?! ip)|van phong|gio lam viec|so dien thoai/],
    ['support', /ho tro ky thuat|gap loi|lien he ai|ticket|qua trinh su dung/],
    ['domain', /ten mien|domain|dns|icann|vnnic|whois|registry/],
    ['features', /ma nguon|bang thong|control panel|cau hinh|tinh nang|he dieu hanh|ip rieng|iso|template|outlook|webmail/]
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] ?? 'general';
}

function makeAliases(question, serviceLabel, topic) {
  const stripped = clean(question).replace(/^\d+[.)]\s*/, '');
  const seeds = {
    backup: ['backup', 'sao lưu dữ liệu', 'khôi phục dữ liệu'], migration: ['chuyển website', 'migration'],
    ssl: ['SSL miễn phí', 'chứng chỉ SSL', 'HTTPS'], upgrade: ['nâng cấp gói', 'upgrade'],
    features: ['tính năng', 'thông số', 'cấu hình'], renewal: ['gia hạn', 'hết hạn'],
    pricing: ['chi phí', 'bảng giá'], support: ['hỗ trợ kỹ thuật', 'liên hệ hỗ trợ']
  };
  return [...new Set([stripped, ...(seeds[topic] ?? []).map(text => `${serviceLabel} ${text}`)])];
}

export function normalizeRecord(record, source, curation = {}) {
  const url = verifySource(source);
  if (record.source_id !== source.id || record.source_url !== source.url ||
      !record.id || !clean(record.question) || !clean(record.answer)) throw new Error('Invalid FAQ source linkage');
  const service = url.pathname.split('/').filter(Boolean).join('-') || 'vinahost';
  const serviceLabel = curation.serviceLabels?.[service] ?? source.title;
  const question = clean(record.question).replace(/^\d+[.)]\s*/, '');
  const answer = clean(record.answer);
  const topic = inferTopic(question);
  const sensitive = /\d[\d.,]*\s*(?:đ(?:ồng)?|vnd|vnđ|₫|usd|\$)(?=$|[\s/.,;)])/i;
  return {
    id: `VH-${record.id.slice(0, 16)}`, originalId: record.id, sourceId: source.id, kind: 'faq',
    question, answer, title: source.title, heading: question, service, serviceLabel,
    category: source.category ?? 'general', topic, plan: null, sourceUrl: source.url,
    fetchedAt: source.fetched_at, reviewStatus: 'source_checked', reviewMethod: 'literal-source-consistency',
    reviewer: 'source-consistency-check', contentHash: hash(question + '\n' + answer),
    aliases: makeAliases(question, serviceLabel, topic),
    requiresConfirmation: topic === 'pricing' || topic === 'refund' || sensitive.test(answer) ||
      /\b(?:nghin|trieu|ty)\s+(?:dong|do la)\b/.test(fold(answer)) ||
      /\b(khuyen mai|hoan tien|cam ket|an toan tuyet doi|bao dam tuyet doi)\b/.test(fold(answer))
  };
}

export function cleanChunk(chunk) {
  const text = clean(chunk?.text);
  const words = text.split(/\s+/);
  if (text.length < 120 || words.length < 20 || text.includes('|') ||
      !/[\p{L}]{3}/u.test(text) || /^\d[\d\s.,%-]*$/.test(text) ||
      /^(?:mua ngay|dang ky ngay|xem them|lien he zalo|tong luot truy cap)/.test(fold(text))) return null;
  return { ...chunk, text, active: false, reviewStatus: 'pending_review', reviewReason: 'requires-context-and-business-review' };
}

function documentEntry(document, source, curation) {
  const url = verifySource(source);
  let text = source.text;
  if (document.start) {
    const start = text.indexOf(document.start);
    if (start < 0) throw new Error('Document section start absent from source');
    text = text.slice(start);
  }
  if (document.end) {
    const end = text.indexOf(document.end);
    if (end < 0) throw new Error('Document section end absent from source');
    text = text.slice(0, end);
  }
  const answer = clean(text);
  if (!answer || !literal(source.text).includes(literal(answer))) throw new Error('Document not supported by source');
  const service = url.pathname.split('/').filter(Boolean).join('-') || 'vinahost';
  return {
    id: document.id, kind: 'document', originalId: document.id, sourceId: source.id,
    question: document.question, answer, title: source.title, heading: document.question,
    service, serviceLabel: curation.serviceLabels?.[service] ?? source.title,
    category: source.category ?? 'general', topic: document.topic, plan: null, sourceUrl: source.url,
    fetchedAt: source.fetched_at, reviewStatus: 'source_checked', reviewMethod: 'literal-source-consistency',
    reviewer: 'source-consistency-check', contentHash: hash(document.question + '\n' + answer),
    aliases: document.aliases ?? [], requiresConfirmation: Boolean(document.requiresConfirmation)
  };
}

export function prepareKnowledge({ sources, faqs, chunks = [], curation, rawBySource } = {}) {
  if (!Array.isArray(sources) || !Array.isArray(faqs) || !Array.isArray(chunks) || !Array.isArray(curation?.faqIds)) {
    throw new Error('Invalid preparation input');
  }
  const sourceMap = new Map(sources.map(source => [source.id, source]));
  const sourceUrls = new Map(sources.map(source => [source.url, source]));
  const selected = new Set(curation.faqIds);
  const entries = [], reviewQueue = [], seen = new Map();
  for (const faq of faqs) {
    const source = sourceMap.get(faq.source_id);
    if (!source || source.url !== faq.source_url) throw new Error('Missing or mismatched FAQ source');
    if (!selected.has(faq.id)) {
      reviewQueue.push({ ...faq, reason: curation.excludedReasons?.[faq.id] ?? 'not-selected-for-source-check' });
      continue;
    }
    if (curation.expectedFaqHashes && (curation.expectedFaqHashes[faq.id] !== faq.content_hash ||
        faq.content_hash !== hash(faq.question + '\n' + faq.answer))) {
      reviewQueue.push({ ...faq, reason: 'source-content-changed-needs-review' });
      continue;
    }
    const answerLiteral = literal(faq.answer);
    const sourceMatched = answerLiteral.length > 15 && literal(source.text).includes(answerLiteral);
    const rawText = rawBySource?.has(source.id) ? literal(rawBySource.get(source.id)) : null;
    const rawMatched = !rawBySource || (rawText?.includes(answerLiteral) && rawText.includes(literal(faq.question)));
    if ((!sourceMatched && !rawText) || !rawMatched) {
      reviewQueue.push({ ...faq, reason: 'answer-not-found-in-source' });
      continue;
    }
    const normalized = normalizeRecord(faq, source, curation);
    const entry = sourceMatched ? normalized : { ...normalized, reviewMethod: 'literal-raw-html-consistency' };
    const key = `${entry.service}:${questionKey(entry.question)}`;
    const previous = seen.get(key);
    if (previous) {
      reviewQueue.push({ ...faq, reason: previous.contentHash === entry.contentHash ? 'duplicate-within-service' : 'same-question-conflicting-answer' });
      continue;
    }
    seen.set(key, entry);
    entries.push(entry);
  }
  for (const document of curation.documents ?? []) {
    const source = sourceUrls.get(document.sourceUrl);
    if (!source) throw new Error('Missing curated document source');
    const entry = documentEntry(document, source, curation);
    if (curation.expectedDocumentHashes && curation.expectedDocumentHashes[document.id] !== hash(entry.answer)) {
      reviewQueue.push({ id: entry.id, kind: 'document', source_url: entry.sourceUrl, question: entry.question,
        answer: entry.answer, reason: 'source-content-changed-needs-review' });
      continue;
    }
    entries.push(entry);
  }
  const cleanedChunks = chunks.map(cleanChunk).filter(Boolean);
  const stats = {
    sources: sources.length, inputFaqs: faqs.length, selectedCandidates: selected.size,
    sourceCheckedFaqs: entries.filter(e => e.kind === 'faq').length,
    sourceCheckedDocuments: entries.filter(e => e.kind === 'document').length,
    activeEntries: entries.length, pendingFaqs: reviewQueue.filter(record => record.kind !== 'document').length,
    pendingDocuments: reviewQueue.filter(record => record.kind === 'document').length,
    inputChunks: chunks.length, cleanedChunks: cleanedChunks.length, droppedChunks: chunks.length - cleanedChunks.length,
    duplicateFaqs: reviewQueue.filter(r => /duplicate-within-service|same-question-conflicting-answer/.test(r.reason)).length,
    confirmationRequired: entries.filter(e => e.requiresConfirmation).length,
    reviewMeaning: 'Source-checked means literal consistency with the saved source, not human/business approval or a guarantee of present-day correctness.'
  };
  return { version: 1, generatedAt: new Date().toISOString(), entries, stats, reviewQueue, cleanedChunks };
}

const csvCell = value => {
  const text = String(value ?? '');
  const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return '"' + safe.replaceAll('"', '""') + '"';
};

export async function writePreparedKnowledge(prepared, outputDir) {
  if (!Array.isArray(prepared?.entries) || !Array.isArray(prepared.reviewQueue) || !prepared.stats) throw new Error('Invalid prepared knowledge');
  await mkdir(outputDir, { recursive: true });
  const staging = await mkdtemp(join(outputDir, '.stage-'));
  try {
    const { reviewQueue, cleanedChunks, ...knowledge } = prepared;
    const fields = ['id', 'source_url', 'question', 'answer', 'reason'];
    const reviewCsv = '\uFEFF' + fields.join(',') + '\n' + reviewQueue.map(record => fields.map(k => csvCell(record[k])).join(',')).join('\n');
    const report = { ...prepared.stats, version: prepared.version, generatedAt: prepared.generatedAt,
      rawSnapshotsRetained: true, activeFaqsAreHumanApproved: false,
      reviewReasons: Object.fromEntries([...new Set(reviewQueue.map(r => r.reason))].map(reason => [reason, reviewQueue.filter(r => r.reason === reason).length])) };
    const outputs = {
      'knowledge.json': JSON.stringify(knowledge, null, 2) + '\n',
      'preparation-report.json': JSON.stringify(report, null, 2) + '\n',
      'review-queue.csv': reviewCsv,
      'review-queue.json': JSON.stringify(reviewQueue, null, 2) + '\n',
      'cleaned-chunks.jsonl': (cleanedChunks ?? []).map(chunk => JSON.stringify(chunk)).join('\n') + '\n'
    };
    for (const [name, value] of Object.entries(outputs)) await writeFile(join(staging, name), value, 'utf8');
    for (const name of Object.keys(outputs)) await rename(join(staging, name), join(outputDir, name));
    return report;
  } finally { await rm(staging, { recursive: true, force: true }); }
}

function decodeHtml(html) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…' };
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
      if (code.startsWith('#')) return String.fromCodePoint(parseInt(code.slice(code[1]?.toLowerCase() === 'x' ? 2 : 1), code[1]?.toLowerCase() === 'x' ? 16 : 10));
      return entities[code.toLowerCase()] ?? match;
    });
}

export async function buildPreparedKnowledge({ dataDir = join(root, 'data'), outputDir = join(root, 'prepared'),
  curationPath = join(root, 'curation', 'selection.json') } = {}) {
  const loadJsonl = async name => (await readFile(join(dataDir, name), 'utf8')).split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  const [sources, faqs, chunks, curation] = await Promise.all([
    loadJsonl('sources.jsonl'), loadJsonl('faqs.jsonl'), loadJsonl('chunks.jsonl'), readFile(curationPath, 'utf8').then(JSON.parse)
  ]);
  const selectedSources = new Set(faqs.filter(f => curation.faqIds.includes(f.id)).map(f => f.source_id));
  const rawBySource = new Map();
  for (const source of sources.filter(s => selectedSources.has(s.id))) {
    const path = resolve(dataDir, source.raw_path ?? '');
    const local = relative(resolve(dataDir, 'raw'), path);
    if (!source.raw_path || local.startsWith('..') || isAbsolute(local)) throw new Error('Invalid raw source snapshot path');
    const html = gunzipSync(await readFile(path)).toString('utf8');
    rawBySource.set(source.id, decodeHtml(html));
  }
  const prepared = prepareKnowledge({ sources, faqs, chunks, curation, rawBySource });
  return writePreparedKnowledge(prepared, outputDir);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  buildPreparedKnowledge().then(report => console.log(JSON.stringify(report, null, 2)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
