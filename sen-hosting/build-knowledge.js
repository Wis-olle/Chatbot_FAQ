import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile, mkdtemp, rename, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const digest = value => createHash('sha256').update(value).digest('hex');
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();

function prepareEntry(entry, updatedAt, ids) {
  if (!/^SEN-[A-Z0-9-]+$/.test(entry.id ?? '') || ids.has(entry.id)) throw new Error('Invalid or duplicate Sen knowledge ID');
  if (!clean(entry.question) || !clean(entry.answer) || !entry.service || !entry.serviceLabel) throw new Error('Invalid or empty Sen FAQ');
  if (entry.sourceUrl && entry.sourceUrl !== '/knowledge/' + entry.id) throw new Error('Invalid Sen source URL');
  if (entry.companySpecific === true || entry.requiresConfirmation === true) throw new Error('Unconfirmed business/company claims cannot be published');
  if (/vina\s*host|1900\s*6046|support@vinahost|https?:\/\//i.test(entry.question + entry.answer)) throw new Error('Foreign brand or external source cannot be published as Sen content');
  ids.add(entry.id);
  const question = clean(entry.question);
  const answer = clean(entry.answer);
  return { ...entry, question, answer, kind:'faq', title:`Sen Hosting · ${entry.serviceLabel}`,
    heading:question, plan:null, knowledgeType:'general', companySpecific:false,
    reviewStatus:'sen_published', reviewMethod:'authored-general-knowledge',
    sourceUrl:'/knowledge/' + entry.id, sourceId:entry.id, updatedAt, fetchedAt:updatedAt,
    requiresConfirmation:false, aliases:[...new Set([question, ...(entry.aliases ?? []).map(clean)])],
    contentHash:digest(question + '\n' + answer) };
}

export function isOwnerApproved(entry) {
  return entry.ownerConfirmed === true && entry.reviewStatus === 'sen_approved' && entry.companySpecific === true;
}

function prepareBusinessEntry(entry, updatedAt, ids) {
  if (!/^SEN-[A-Z0-9-]+$/.test(entry.id ?? '') || ids.has(entry.id)) throw new Error('Invalid or duplicate business ID');
  if (entry.sourceUrl !== '/knowledge/' + entry.id) throw new Error('Invalid business source URL');
  if (!clean(entry.question) || !clean(entry.answer) || !entry.service || !entry.serviceLabel) throw new Error('Invalid or empty business FAQ');
  if (!Number.isFinite(Date.parse(entry.updatedAt ?? updatedAt))) throw new Error('Invalid business timestamp');
  if (/vina\s*host|1900\s*6046|support@vinahost/i.test(entry.question + entry.answer)) throw new Error('Foreign brand cannot be approved as Sen content');
  ids.add(entry.id);
  const question=clean(entry.question), answer=clean(entry.answer), stamp=entry.updatedAt ?? updatedAt;
  return {...entry,question,answer,kind:'faq',title:`Sen Hosting · ${entry.serviceLabel}`,heading:question,
    plan:entry.plan ?? null,knowledgeType:'business',companySpecific:true,ownerConfirmed:true,
    reviewStatus:'sen_approved',reviewMethod:'owner-confirmed-content',sourceId:entry.id,
    updatedAt:stamp,fetchedAt:stamp,requiresConfirmation:false,
    aliases:[...new Set([question,...(entry.aliases ?? []).map(clean)])],contentHash:digest(question+'\n'+answer)};
}

export function prepareSenKnowledge(content, {profile}={}) {
  if (content?.brandName !== 'Sen Hosting' || !Array.isArray(content.entries) || !content.entries.length ||
      !Number.isFinite(Date.parse(content.updatedAt))) throw new Error('Invalid Sen content');
  if (profile && (profile.brandName !== 'Sen Hosting' || !Array.isArray(profile.entries))) throw new Error('Invalid business profile');
  const ids = new Set();
  const general = content.entries.map(entry => prepareEntry(entry, content.updatedAt, ids));
  const candidates=profile?.entries ?? [];
  const business=candidates.filter(isOwnerApproved).map(entry=>prepareBusinessEntry(entry,content.updatedAt,ids));
  const entries=[...general,...business];
  return { version:content.version ?? 1, brandName:'Sen Hosting', generatedAt:new Date().toISOString(), entries,
    stats:{ entries:entries.length, faqs:entries.length, services:new Set(entries.map(e=>e.service)).size,
      publishedEntries:entries.length, generalEntries:general.length, companyClaimsPublished:business.length,
      businessEntries:business.length,pendingBusinessEntries:candidates.length-business.length,
      businessPoliciesConfirmed:false, reviewMeaning:'Nội dung kiến thức chung được biên soạn cho Sen Hosting; không xác nhận bảng giá hoặc cam kết dịch vụ chưa được chủ dự án cung cấp.' } };
}

async function draftReferences() {
  const source = JSON.parse(await readFile(join(root, '..', 'faq', 'prepared', 'knowledge.json'), 'utf8'));
  return { generatedAt:new Date().toISOString(), status:'needs_owner_input', published:false,
    note:'Tài liệu tham khảo riêng để chủ Sen Hosting đối chiếu. Không phải chính sách hoặc cam kết của Sen Hosting.',
    entries:source.entries.map(entry=>({ id:'SEN-DRAFT-' + entry.id, status:'needs_owner_input', published:false,
      service:entry.service, questionTemplate:entry.question.replace(/vina\s*host/gi,'Sen Hosting'),
      referenceAnswer:entry.answer, originalProvenance:{id:entry.id,url:entry.sourceUrl,fetchedAt:entry.fetchedAt,contentHash:entry.contentHash} })) };
}

export async function buildSenKnowledge({ outputDir=join(root,'prepared'), contentPath=join(root,'content','faqs.json'), profilePath=join(root,'content','business-profile.json') }={}) {
  const content = JSON.parse(await readFile(contentPath,'utf8'));
  const profile = JSON.parse(await readFile(profilePath,'utf8'));
  const knowledge = prepareSenKnowledge(content,{profile});
  const drafts = await draftReferences();
  const report = { ...knowledge.stats, brandName:knowledge.brandName, generatedAt:knowledge.generatedAt,
    draftReferenceEntries:drafts.entries.length, businessProfileStatus:profile.status,
    businessPoliciesConfirmed:false, originalCrawlPreserved:true };
  await mkdir(outputDir,{recursive:true});
  const stage = await mkdtemp(join(outputDir,'.stage-'));
  try {
    const pendingBusiness={status:'needs_owner_input',published:false,entries:profile.entries.filter(entry=>!isOwnerApproved(entry))};
    const outputs = { 'knowledge.json':knowledge, 'preparation-report.json':report, 'pending-sen-review.json':drafts,
      'pending-business-review.json':pendingBusiness };
    for (const [name,value] of Object.entries(outputs)) await writeFile(join(stage,name),JSON.stringify(value,null,2)+'\n');
    for (const name of Object.keys(outputs)) await rename(join(stage,name),join(outputDir,name));
    return report;
  } finally { await rm(stage,{recursive:true,force:true}); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  buildSenKnowledge().then(report=>console.log(JSON.stringify(report,null,2)))
    .catch(error=>{ console.error(error.message); process.exitCode=1; });
}
