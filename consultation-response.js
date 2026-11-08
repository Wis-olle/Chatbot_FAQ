import { normalize } from './knowledge-text.js';

function assertsAvailability(value) {
  const text = normalize(value);
  return /dang ky ngay|chac chan.*con trong|da (kiem tra|xac nhan).*con trong/.test(text) ||
    (/con trong|\bavailable\b|co the dang ky duoc/.test(text) && !/chua|can kiem tra|can xac nhan|phai kiem tra|truoc khi|khong (chac|dam bao)/.test(text));
}

function unstructuredCommercialFacts(value) {
  const text = String(value);
  const money = /\d[\d.,]*\s*(?:đ(?:ồng)?|vnd|₫|k\b|nghìn|ngàn|triệu)/i.test(text);
  const quantities = /\b\d+(?:[.,]\d+)?\s*(?:gb|tb|mb|vcpu|cpu|cores?|lần\s*(?:\/|mỗi)|%)/i.test(text);
  const policyPromise = /(?:cam ket|dam bao).*(?:uptime|sla|hoan tien)|(?:hoan tien|uptime|\bsla\b).*\d/.test(normalize(text));
  return money || quantities || policyPromise;
}

function usefulText(context, ideas, recommendations) {
  const purpose = context.needs.purpose;
  const opening = purpose ? `Với nhu cầu bạn đã chia sẻ (${purpose}), mình sẽ ưu tiên lựa chọn dễ sử dụng và phù hợp hướng phát triển của bạn.` : 'Mình sẽ giúp bạn thu hẹp lựa chọn theo mục đích sử dụng và ngân sách.';
  const offered = recommendations.length ? ` Các lựa chọn trong danh mục để cân nhắc là ${recommendations.map(item => item.name).join(', ')}.` : '';
  const names = ideas.length ? ` Một vài ý tưởng tên miền: ${ideas.map(idea => idea.name).join(', ')}; các tên này chưa được kiểm tra còn trống.` : '';
  return opening + offered + names + ' Bạn có thể chọn một hướng bên dưới để mình tư vấn tiếp.';
}

export function consultationResponse(output, context) {
  const items = new Map(context.catalog.items.map(item => [item.id, item]));
  const requested = Array.isArray(output.recommendedItemIds) ? [...new Set(output.recommendedItemIds)] : [];
  const invalidIds = requested.some(id => !items.has(id));
  const chosen = requested.length ? requested.filter(id => items.has(id)).map(id => items.get(id)) : context.catalog.items.slice(0, 3);
  const recommendations = chosen.slice(0, 4).map(item => structuredClone(item));
  const domainIdeas = (Array.isArray(output.domainIdeas) ? output.domainIdeas : []).filter(idea =>
    idea && typeof idea.name === 'string' && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i.test(idea.name)
  ).slice(0, 5).map(idea => ({ name: idea.name.toLowerCase(), reason: assertsAvailability(idea.reason) || unstructuredCommercialFacts(idea.reason)
    ? 'Ý tưởng theo nhu cầu của bạn; chưa kiểm tra còn trống.' : String(idea.reason ?? '').slice(0, 240), availability: 'unchecked' }));
  const rejected = invalidIds || assertsAvailability(output.text) || unstructuredCommercialFacts(output.text);
  // Quantified commercial facts are displayed from selected records, never model prose.
  let text = rejected ? usefulText(context, domainIdeas, recommendations) : output.text.trim();
  if (domainIdeas.length && !/chưa|cần kiểm tra|kiểm tra.*(khả dụng|còn trống)/i.test(text)) text += '\nCác tên miền trên là ý tưởng chưa kiểm tra còn trống.';
  const followUps = Array.isArray(output.followUpQuestions) ? [...new Set(output.followUpQuestions.filter(q => typeof q === 'string' && q.trim() && q.length <= 180))] : [];
  return {
    kind: 'answer', text, source: rejected ? 'knowledge' : 'gemini', route: 'consultation',
    suggestions: followUps.length ? followUps.slice(0, 3).map(question => ({ question })) : context.suggestions,
    sources: recommendations.filter(item => item.sourceUrl).map(item => ({ id: item.id, title: `Sen Hosting · ${item.name}`,
      question: item.name, answer: item.description, url: item.sourceUrl, fetchedAt: item.snapshotAt, reviewStatus: 'sen_approved' })),
    recommendations, domainIdeas, availability: { checked: false },
    retrieval: { service: context.needs.serviceType, catalogCount: context.catalog.items.length, evidenceCount: recommendations.length }
  };
}
