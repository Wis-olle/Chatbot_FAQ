import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSenKnowledge, prepareSenKnowledge } from '../sen-hosting/build-knowledge.js';

test('Sen knowledge publishes authored general FAQ with internal provenance only', async t => {
  const outputDir = await mkdtemp(join(tmpdir(), 'sen-knowledge-'));
  t.after(() => rm(outputDir, { recursive: true, force: true }));
  const report = await buildSenKnowledge({ outputDir });
  const knowledge = JSON.parse(await readFile(join(outputDir, 'knowledge.json'), 'utf8'));
  assert.equal(knowledge.brandName, 'Sen Hosting');
  assert.ok(knowledge.entries.length >= 35 && knowledge.entries.length <= 45);
  assert.equal(report.publishedEntries, knowledge.entries.length);
  assert.equal(new Set(knowledge.entries.map(e => e.id)).size, knowledge.entries.length);
  assert.equal(new Set(knowledge.entries.map(e => e.service)).size, 7);
  for (const entry of knowledge.entries) {
    assert.match(entry.id, /^SEN-[A-Z0-9-]+$/);
    assert.equal(entry.sourceUrl, '/knowledge/' + entry.id);
    assert.equal(entry.reviewStatus, 'sen_published');
    assert.equal(entry.reviewMethod, 'authored-general-knowledge');
    assert.equal(entry.companySpecific, false);
    assert.equal(entry.knowledgeType, 'general');
    assert.equal(entry.requiresConfirmation, false);
    assert.ok(entry.question.trim() && entry.answer.trim() && entry.contentHash);
    assert.ok(Number.isFinite(Date.parse(entry.fetchedAt)));
  }
  assert.doesNotMatch(JSON.stringify(knowledge), /vinahost|vina host|1900\s*6046|4 lần\/ngày|49[.,]000|99[.,]000|\d+[.,]?\d*\s*(?:đ\/|vnd)/i);
});

test('unconfirmed Sen business profile and old provider claims are quarantined', async t => {
  const outputDir = await mkdtemp(join(tmpdir(), 'sen-business-'));
  t.after(() => rm(outputDir, { recursive: true, force: true }));
  const report = await buildSenKnowledge({ outputDir });
  const profile = JSON.parse(await readFile(new URL('../sen-hosting/content/business-profile.json', import.meta.url), 'utf8'));
  for (const key of ['prices', 'refundPolicy', 'backupPolicy', 'sla', 'contact']) assert.equal(profile[key], null);
  assert.equal(profile.status, 'needs_owner_input');
  assert.equal(report.businessPoliciesConfirmed, false);
  const drafts = JSON.parse(await readFile(join(outputDir, 'pending-sen-review.json'), 'utf8'));
  assert.ok(drafts.entries.length >= 50);
  assert.ok(drafts.entries.every(entry => entry.status === 'needs_owner_input' && entry.published === false));
  const active = JSON.parse(await readFile(join(outputDir, 'knowledge.json'), 'utf8'));
  assert.ok(active.entries.every(entry => !drafts.entries.some(d => d.id === entry.id)));
});

test('content metadata and hashes are stable across repeat preparation', async t => {
  const outputDir = await mkdtemp(join(tmpdir(), 'sen-repeat-'));
  t.after(() => rm(outputDir, { recursive: true, force: true }));
  await buildSenKnowledge({ outputDir });
  const first = JSON.parse(await readFile(join(outputDir, 'knowledge.json'), 'utf8'));
  await buildSenKnowledge({ outputDir });
  const second = JSON.parse(await readFile(join(outputDir, 'knowledge.json'), 'utf8'));
  assert.deepEqual(first.entries, second.entries);
});

test('builder rejects foreign brand references, unsafe links and business-specific assertions', () => {
  const base = { id:'SEN-TEST', question:'SSL là gì?', answer:'SSL mã hóa kết nối HTTPS.', service:'mua-ssl-gia-re', serviceLabel:'SSL', category:'ssl', topic:'ssl', aliases:[] };
  const source = entries => ({ version:1, brandName:'Sen Hosting', updatedAt:'2026-11-07T00:00:00Z', entries });
  assert.throws(() => prepareSenKnowledge(source([{...base, answer:'VinaHost hỗ trợ SSL.'}])), /brand|foreign/i);
  assert.throws(() => prepareSenKnowledge(source([{...base, sourceUrl:'javascript:alert(1)'}])), /URL|source/i);
  assert.throws(() => prepareSenKnowledge(source([{...base, companySpecific:true}])), /business|company/i);
  assert.throws(() => prepareSenKnowledge(source([base,base])), /duplicate/i);
  assert.throws(() => prepareSenKnowledge(source([{...base, answer:''}])), /empty|invalid/i);
});

test('explicitly known brand is Sen Hosting while commercial profile stays pending', () => {
  const content = {version:1,brandName:'Sen Hosting',updatedAt:'2026-11-07T00:00:00Z',entries:[{
    id:'SEN-GENERAL',question:'Hosting là gì?',answer:'Hosting là tài nguyên lưu trữ để website hoạt động.',
    service:'hosting-gia-re',serviceLabel:'Hosting',category:'hosting',topic:'general',aliases:[]
  }]};
  const prepared = prepareSenKnowledge(content);
  assert.equal(prepared.brandName, 'Sen Hosting');
  assert.equal(prepared.stats.companyClaimsPublished, 0);
  assert.equal(prepared.entries[0].title, 'Sen Hosting · Hosting');
});

const generalContent = () => ({version:1,brandName:'Sen Hosting',updatedAt:'2026-11-07T00:00:00Z',entries:[{
  id:'SEN-GENERAL',question:'Hosting là gì?',answer:'Hosting là tài nguyên lưu trữ website.',
  service:'hosting-gia-re',serviceLabel:'Hosting',category:'hosting',topic:'general',aliases:[]
}]});
const approvedPrice = () => ({id:'SEN-OWNER-PRICE',question:'Gói do chủ dự án xác nhận có giá bao nhiêu?',
  answer:'Giá được chủ dự án xác nhận cho gói thử nghiệm là 120.000đ/tháng, chưa bao gồm VAT.',
  service:'hosting-gia-re',serviceLabel:'Gói thử nghiệm',category:'hosting',topic:'pricing',
  sourceUrl:'/knowledge/SEN-OWNER-PRICE',ownerConfirmed:true,reviewStatus:'sen_approved',companySpecific:true});
const profileWith = entries => ({brandName:'Sen Hosting',status:'partially_confirmed',entries});

test('only owner-confirmed approved business entries supplement general knowledge', () => {
  const business = approvedPrice();
  const prepared = prepareSenKnowledge(generalContent(), {profile:profileWith([business])});
  assert.equal(prepared.entries.length, 2);
  const active = prepared.entries.find(e=>e.id===business.id);
  assert.equal(active.reviewStatus, 'sen_approved');
  assert.equal(active.ownerConfirmed, true);
  assert.equal(active.companySpecific, true);
  assert.equal(active.knowledgeType, 'business');
  assert.equal(active.requiresConfirmation, false);
  assert.equal(active.sourceUrl, business.sourceUrl);
  assert.match(active.answer, /120\.000/);
  assert.equal(prepared.stats.businessEntries, 1);
  assert.equal(prepared.stats.generalEntries, 1);
  assert.equal(prepared.entries.find(e=>e.id==='SEN-GENERAL').companySpecific, false);
});

test('missing approval flags keep proposed company data out of active knowledge', () => {
  for (const overrides of [{ownerConfirmed:false},{reviewStatus:'draft'},{companySpecific:false}]) {
    const prepared = prepareSenKnowledge(generalContent(),{profile:profileWith([{...approvedPrice(),...overrides}])});
    assert.equal(prepared.entries.length, 1);
    assert.equal(prepared.stats.businessEntries, 0);
    assert.equal(prepared.stats.pendingBusinessEntries, 1);
    assert.equal(prepared.entries[0].knowledgeType, 'general');
  }
});

test('approved company entries still require valid local provenance and unique IDs', () => {
  for (const sourceUrl of ['https://other.example/pricing','javascript:alert(1)','/knowledge/OTHER']) {
    assert.throws(()=>prepareSenKnowledge(generalContent(),{profile:profileWith([{...approvedPrice(),sourceUrl}])}), /source|URL/i);
  }
  assert.throws(()=>prepareSenKnowledge(generalContent(),{profile:profileWith([{...approvedPrice(),id:'SEN-GENERAL',sourceUrl:'/knowledge/SEN-GENERAL'}])}), /duplicate/i);
  assert.throws(()=>prepareSenKnowledge(generalContent(),{profile:profileWith([{...approvedPrice(),answer:''}])}), /empty|invalid/i);
});
