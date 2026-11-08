import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openKnowledgeRepository } from './knowledge-repository.js';
import { normalize, sourceUrl, tokens, topicOf, topicTerms } from './knowledge-text.js';
import { classifyChat } from './chat-router.js';
import { buildConsultation } from './consultation.js';
import { catalogEntries } from './catalog-knowledge.js';

const serviceAliases = Object.freeze({
  'wordpress-hosting': ['wordpress hosting', 'hosting wordpress', 'wordpress'],
  'windows-hosting': ['windows hosting', 'hosting windows'],
  'hosting-gia-re': ['hosting gia re', 'host gia re'],
  'hosting-cao-cap': ['hosting cao cap', 'hosting nvme'],
  'hosting-doanh-nghiep': ['hosting doanh nghiep', 'hosting business'],
  'thue-vps-gia-re': ['vps gia re'],
  'email-hosting-chuyen-nghiep': ['email hosting', 'hosting email'],
  'dang-ky-ten-mien': ['dang ky ten mien', 'mua ten mien'],
  'mua-ssl-gia-re': ['mua ssl', 'ssl la gi', 'chung chi ssl la gi', 'wildcard', 'multi domain', 'kiem tra website cai dat ssl', 'ssl labs']
});

function scopeOf(message, entries) {
  const query = normalize(message);
  const services = [...new Set(entries.filter(e => e.kind !== 'document').map(entry => entry.service))];
  const matched = services.map(service => {
    const aliases = (serviceAliases[service] ?? []).filter(alias => (` ${query} `).includes(` ${alias} `));
    return { service, strength: aliases.some(alias => alias.includes(' ')) ? 2 : aliases.length ? 1 : 0 };
  }).filter(match => match.strength > 0).filter(match => !(match.service === 'hosting-gia-re' && /(?:windows|wordpress) hosting gia re/.test(query)));
  const strongest = matched.filter(match => match.strength === Math.max(0, ...matched.map(m => m.strength)));
  return strongest.length === 1 ? strongest[0].service : strongest.length > 1 ? 'ambiguous' : null;
}

function explicitFamily(message) {
  const query = normalize(message);
  return ['vps', 'email', 'hosting'].find(family => new RegExp(`\\b${family}\\b`).test(query)) ?? (/ten mien|domain/.test(query) ? 'domain' : null);
}

function familyOf(service) {
  return service?.includes('vps') ? 'vps' : service?.includes('email') ? 'email' : service?.includes('hosting') ? 'hosting' : service?.includes('ten-mien') ? 'domain' : null;
}

function historyScope(history, entries) {
  for (const turn of [...history].reverse()) {
    if (turn.role !== 'user') continue;
    const service = scopeOf(turn.text, entries);
    if (service === 'ambiguous') return null;
    if (service) return service;
    if (/\b(vps|hosting|email|ten mien|ssl)\b/.test(normalize(turn.text))) break;
  }
  return null;
}

function entryTopic(entry) {
  return entry.topic && entry.topic !== 'general' ? entry.topic : topicOf(`${entry.question} ${entry.heading ?? ''}`);
}

const incidentalWords = new Set(`hosting host wordpress windows vps email domain ten mien gia re mua thue web website trang
  du lieu su dung chay tich hop cai dat ma nguon ngon ngu lap trinh phan mem ho tro thoi gian thuong xuyen
  dinh ky may lan ngay tuan thang nam bao lau phi mien nen cua cho toi minh ban neu khach hang nha cung cap
  khac loai goi duoi theo dich vu lam sao cach nhu the nao dung chuan len duoc nao vao them nhu cau
  va ve sao khong co gi voi chi dong mot ngay sau da dang hoi xin dung tat ca nhan thong tin bat dau ket noi biet`.split(/\s+/));

function hasSpecificEvidence(entry, query, topic) {
  const topicWords = new Set((topicTerms[topic] ?? []).flatMap(term => term.split(' ')));
  const serviceWords = new Set(normalize(`${entry.serviceLabel ?? ''} ${entry.service}`).split(' '));
  const specific = tokens(query).filter(word => !incidentalWords.has(word) && !topicWords.has(word) && !serviceWords.has(word));
  const facts = new Set(tokens(`${entry.question} ${entry.answer} ${(entry.aliases ?? []).join(' ')}`));
  return specific.every(word => facts.has(word));
}

function rankEntry(entry, query, topic) {
  if (!hasSpecificEvidence(entry, query, topic)) return 0;
  const question = normalize(`${entry.question} ${(entry.aliases ?? []).join(' ')}`);
  const answer = normalize(entry.answer);
  const wanted = tokens(query);
  const topicMatch = topic !== 'general' && (entryTopic(entry) === topic || topicOf(entry.question) === topic || (topicTerms[topic] ?? []).some(term => question.includes(term)));
  if (topic !== 'general' && !topicMatch) return 0;
  const questionMatches = wanted.filter(word => question.split(' ').includes(word)).length;
  const answerMatches = wanted.filter(word => answer.split(' ').includes(word)).length;
  if (!topicMatch && !questionMatches) return 0;
  return (topicMatch ? 15 : 0) + questionMatches * 5 + answerMatches + (entry.kind === 'faq' ? 2 : 0);
}

function scopeClarification(topic, suggestions) {
  const label = ({ backup: 'sao lưu', ssl: 'SSL', features: 'cấu hình', renewal: 'gia hạn', upgrade: 'nâng cấp', migration: 'chuyển dữ liệu', pricing: 'giá' })[topic] ?? 'thông tin';
  return { kind: 'clarify', text: `Bạn muốn hỏi về ${label} của dịch vụ nào: Hosting giá rẻ, WordPress Hosting, Windows Hosting hay VPS? Mỗi dịch vụ có điều kiện riêng.`, evidence: [], suggestions, service: null, topic };
}

function isOffTopic(query) {
  return /facebook|instagram|tiktok|iphone|xe may|bao hiem|thoi tiet|troi mua|meo va cho|sao hoa|ve may bay|mat khau (gmail|facebook)/.test(query);
}

function wantsPrice(query, topic) {
  const withoutServiceQualifier = query.replace(/\bgia re\b/g, '');
  return topic === 'pricing' || /\b(gia bao nhieu|bao gia|bang gia|bao nhieu tien|chi phi)\b/.test(withoutServiceQualifier);
}

export function createKnowledge({ entries, stats = {}, findCandidates, brandName = 'Sen Hosting', businessProfile = null } = {}) {
  const trustedStatuses = ['source_checked', 'sen_published', 'sen_approved'];
  const active = (entries ?? []).filter(entry => trustedStatuses.includes(entry.reviewStatus) && sourceUrl(entry.sourceUrl) && entry.answer?.trim());
  const publicFaqs = active.filter(entry => entry.kind !== 'document' && entry.kind !== 'catalog');
  const suggestionsFor = (service, exclude) => {
    const sorted = [...publicFaqs.filter(e => e.service === service), ...publicFaqs].filter(e => e.id !== exclude);
    const selected = [...new Map(sorted.map(e => [e.id, e])).values()].slice(0, 3);
    return selected.map(({ id, question }) => ({ id, question }));
  };
  const summary = { ...stats, entries: active.length, faqs: publicFaqs.length, services: new Set(active.map(e => e.service)).size };

  function retrieve({ message, history = [], faqId, forceBusiness = false } = {}) {
    const query = normalize(message);
    const topic = topicOf(message);
    const suggestions = suggestionsFor();
    const companyQuestion = businessProfile && (forceBusiness || classifyChat({ message, history }).route === 'business');
    const available = companyQuestion ? active.filter(entry => entry.companySpecific === true && entry.reviewStatus === 'sen_approved') : active;
    const relevantSuggestions = businessProfile ? buildConsultation({ message, history }, { profile: businessProfile }).suggestions : null;
    const result = (kind, text, evidence = [], service = null) => ({ kind, text, evidence, suggestions: relevantSuggestions ?? suggestionsFor(service, evidence[0]?.id), service, topic });
    if (/\b(dat lich|gap nhan vien|nguoi that|hen tu van|noi chuyen voi nhan vien)\b/.test(query)) {
      return result('booking', 'Bạn có thể đặt lịch trao đổi với nhân viên qua form bên dưới. Lịch được lưu trên trình duyệt này.');
    }
    if (/^(xin chao|chao|hello|hi|alo)( ban| bot)?$/.test(query)) {
      return result('answer', `Chào bạn! Mình là trợ lý ${brandName}. Bạn cần mình hỗ trợ điều gì hôm nay?`);
    }
    if (companyQuestion && !available.length) {
      return result('fallback', `${brandName} chưa cập nhật thông tin đã xác nhận cho nội dung này. Bạn cho mình biết gói dịch vụ đang quan tâm nhé, hoặc đặt lịch để được tư vấn cụ thể.`);
    }
    if (!query || isOffTopic(query)) return result('fallback', `Mình chưa có thông tin phù hợp trong kho kiến thức ${brandName}. Bạn có thể mô tả thêm nhu cầu để mình hỗ trợ.`);
    if ((entries ?? []).some(entry => !trustedStatuses.includes(entry.reviewStatus) && normalize(entry.question) === query)) {
      return result('fallback', 'Nội dung này đang chờ kiểm tra trong kho kiến thức. Bạn vui lòng xem nguồn chính thức hoặc đặt lịch tư vấn.');
    }
    const selected = faqId && available.find(entry => entry.id === faqId && normalize(entry.question) === query);
    const exact = available.filter(entry => normalize(entry.question) === query || (entry.aliases ?? []).some(alias => normalize(alias) === query));
    const currentScope = scopeOf(message, active);
    if (currentScope === 'ambiguous' && !selected) return scopeClarification(topic, suggestions);
    const previousScope = currentScope ? null : historyScope(history, active);
    const family = explicitFamily(message);
    const inherited = previousScope && (!family || family === familyOf(previousScope)) ? previousScope : null;
    const globalTopic = ['refund', 'payment', 'contact'].includes(topic);
    let service = selected?.service ?? currentScope ?? (globalTopic ? null : inherited);
    if (!service && exact.length && new Set(exact.map(e => e.service)).size === 1) service = exact[0].service;
    const needsScope = /\b(hosting|host|vps|email)\b/.test(query) && ['backup', 'ssl', 'features', 'renewal', 'upgrade', 'migration', 'pricing', 'support'].includes(topic);
    if (!service && (needsScope || /^(hosting|host|vps|goi|gia han bao nhieu)$/.test(query))) return scopeClarification(topic, suggestions);
    const candidates = findCandidates ? findCandidates([...tokens(message), ...(topicTerms[topic] ?? [])], globalTopic ? null : service) : available;
    const checked = new Map(available.map(e => [e.id, e]));
    const eligible = [...new Map([...exact, ...candidates].map(e => [e.id, checked.get(e.id)])).values()].filter(Boolean)
      .filter(e => globalTopic || !service || e.service === service);
    const ranked = eligible.map(entry => ({ entry, score: rankEntry(entry, message, topic) + (selected?.id === entry.id ? 1000 : exact.some(e => e.id === entry.id) ? 100 : 0) }))
      .filter(item => item.score >= (topic === 'general' ? 7 : 15)).sort((a, b) => b.score - a.score);
    if (!ranked.length) return result('fallback', 'Mình chưa tìm thấy bằng chứng phù hợp cho câu hỏi này. Bạn có thể mô tả rõ dịch vụ hoặc đặt lịch tư vấn.', [], service);
    if (!service && !globalTopic && ['backup', 'ssl', 'features', 'renewal', 'upgrade', 'migration'].includes(topic) && new Set(ranked.map(r => r.entry.service)).size > 1) {
      return scopeClarification(topic, suggestions);
    }
    const best = ranked[0].entry;
    service ??= best.service;
    // One source answer preserves its full set of conditions in deterministic mode.
    const evidence = ranked.filter(r => globalTopic ? r.entry.sourceUrl === best.sourceUrl : r.entry.service === service).slice(0, 3).map(r => r.entry);
    if ((wantsPrice(query, topic) && best.reviewStatus !== 'sen_approved') || best.requiresConfirmation) {
      return result('fallback', `${brandName} chưa xác nhận giá hoặc điều kiện áp dụng cho ${best.serviceLabel ?? best.title ?? 'dịch vụ này'}. Bạn có thể đặt lịch để được tư vấn cụ thể.`, businessProfile ? [] : evidence, service);
    }
    return result('answer', best.answer, evidence, service);
  }

  function catalog() {
    const services = [...new Map(publicFaqs.map(entry => [entry.service, entry])).values()];
    const topics = services.slice(0, 6).map(entry => ({ id: entry.service, label: entry.serviceLabel ?? entry.title,
      description: `Tìm hiểu cùng ${brandName}`, question: entry.question, faqId: entry.id }));
    return { configured: true, brandName, stats: summary, suggestions: suggestionsFor(), topics,
      faqs: publicFaqs.map(({ id, question, category, service }) => ({ id, question, category, service })) };
  }
  return { retrieve, catalog, stats: summary, getEntry: id => active.find(entry => entry.id === id) ?? null,
    forConsultation: input => buildConsultation(input, { profile: businessProfile ?? {} }) };
}

let defaultKnowledge;
export function getKnowledge() {
  if (defaultKnowledge) return defaultKnowledge;
  const prepared = JSON.parse(readFileSync(new URL('./sen-hosting/prepared/knowledge.json', import.meta.url), 'utf8'));
  const profile = JSON.parse(readFileSync(new URL('./sen-hosting/content/business-profile.json', import.meta.url), 'utf8'));
  const importedCatalog = JSON.parse(readFileSync(new URL('./sen-hosting/content/catalog.json', import.meta.url), 'utf8'));
  const businessProfile = { ...profile, catalog: importedCatalog.items };
  const combined = [...prepared.entries, ...catalogEntries(importedCatalog.items)];
  const repository = openKnowledgeRepository({ path: fileURLToPath(new URL('./sen-hosting/prepared/knowledge.sqlite', import.meta.url)), entries: combined });
  defaultKnowledge = createKnowledge({ entries: repository.all(), stats: { ...prepared.stats, catalogItems: importedCatalog.items.length }, brandName: 'Sen Hosting', businessProfile,
    findCandidates: (terms, service) => repository.search(terms, service) });
  return defaultKnowledge;
}
