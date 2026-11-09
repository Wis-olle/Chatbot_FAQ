import { mountBooking, renderAdmin } from './booking.js';
import { relatedSuggestions } from './suggestions.js';
import { icon, closeSidebar, mountShell } from './ui-shell.js';

const byId = (id) => document.getElementById(id);
const conversation = byId('conversation');
const input = byId('message-input');
let busy = false;
let history = [];
let lastQuestion = '';
let catalog = { suggestions: [], topics: [], faqs: [], stats: {} };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safeSuggestions(items = catalog.suggestions) {
  return (Array.isArray(items) ? items : []).filter(item => item && typeof item.question === 'string' && item.question.trim()).slice(0, 3);
}

function openBooking(topic = lastQuestion) {
  closeSidebar(false);
  mountBooking(byId('booking-dialog'), topic, () => {
    if (location.hash === '#admin') renderAdmin(byId('admin-panel'));
    const toast = byId('toast');
    toast.textContent = 'Lịch tư vấn đã được lưu trên trình duyệt này. Bạn có thể xem tại mục Lịch hẹn.';
    toast.hidden = false;
    setTimeout(() => { toast.hidden = true; }, 5000);
  });
}

function appendSuggestions(container, items) {
  const suggestions = safeSuggestions(items);
  if (!suggestions.length) return;
  const group = element('div', 'suggestions');
  group.setAttribute('aria-label', 'Câu hỏi liên quan');
  for (const faq of suggestions) {
    const button = element('button', 'suggestion', faq.question);
    button.type = 'button';
    button.append(icon('arrow-up-right', 'suggestion-arrow'));
    button.addEventListener('click', () => { closeSidebar(false); ask(faq.question, faq.id); });
    group.append(button);
  }
  container.append(group);
}

function sourceUrl(value) {
  try {
    const url = new URL(value, location.origin);
    return url.origin === location.origin && /^\/knowledge\/[A-Za-z0-9_-]+$/.test(url.pathname) && !url.search && !url.hash && !url.username && !url.password ? url.pathname : null;
  } catch { return null; }
}

function appendSources(container, sources) {
  if (!Array.isArray(sources) || !sources.length) return;
  const details = element('details', 'answer-sources');
  details.append(element('summary', '', `Thông tin Sen Hosting · ${sources.length} tài liệu`));
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    const item = element('div', 'source-item');
    item.append(element('strong', '', source.question || source.heading || source.title || 'Nội dung nguồn'));
    if (source.answer || source.text) item.append(element('p', '', source.answer || source.text));
    const url = sourceUrl(source.url || source.sourceUrl);
    if (url) {
      const link = element('a', 'source-link', `${source.title || 'Xem trang nguồn'} ↗`);
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      item.append(link);
    }
    const fetched = source.updatedAt || source.fetchedAt || source.fetched_at;
    const stamp = fetched && new Date(fetched);
    const date = stamp && !Number.isNaN(stamp.getTime()) ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(stamp) : null;
    const label = [source.reviewStatus === 'sen_published' ? 'Nội dung Sen Hosting' : 'Tài liệu tham khảo', source.serviceLabel, date ? `Cập nhật: ${date}` : ''].filter(Boolean).join(' · ');
    if (label) item.append(element('small', 'source-meta', label));
    details.append(item);
  }
  container.append(details);
}

function appendRecommendations(container, reply) {
  const items = Array.isArray(reply.recommendations) ? reply.recommendations.slice(0, 4) : [];
  if (items.length) {
    const group = element('div', 'recommendation-cards');
    group.setAttribute('aria-label', 'Lựa chọn phù hợp trong danh mục');
    for (const item of items) {
      if (!item || typeof item.name !== 'string') continue;
      const card = element('article', 'recommendation-card');
      card.append(element('strong', '', item.name));
      if (item.description) card.append(element('p', '', item.description));
      for (const [label, value] of Object.entries(item.specs ?? {}).slice(0, 3)) card.append(element('small', '', `${label}: ${value}`));
      if (typeof item.price?.display === 'string') {
        card.append(element('p', 'catalog-price', item.price.display));
        if (item.price.billingPeriod) card.append(element('small', '', item.price.billingPeriod));
        card.append(element('small', 'catalog-price-note', 'Giá danh mục tham khảo; cần đối chiếu chu kỳ, thuế và ưu đãi trước khi thanh toán.'));
      }
      const url = sourceUrl(item.sourceUrl);
      if (url) {
        const link = element('a', 'source-link', 'Xem chi tiết ↗');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        card.append(link);
      }
      group.append(card);
    }
    container.append(group);
  }
  const ideas = Array.isArray(reply.domainIdeas) ? reply.domainIdeas.slice(0, 5) : [];
  if (ideas.length) {
    const group = element('div', 'domain-ideas');
    group.append(element('strong', '', 'Ý tưởng tên miền cho bạn'));
    for (const idea of ideas) if (typeof idea.name === 'string') group.append(element('p', '', `${idea.name}${idea.reason ? ` — ${idea.reason}` : ''}`));
    group.append(element('small', '', 'Chưa kiểm tra còn trống. Cần tra cứu trước khi đăng ký.'));
    container.append(group);
  }
}

function appendAssistant(reply, welcome = false, topic = lastQuestion) {
  const message = element('div', `message assistant-message${welcome ? ' welcome-message' : ''}`);
  const body = element('div', 'message-content');
  body.append(element('span', 'message-author', 'Trợ lý Sen Hosting'));
  const bubble = element('div', 'bubble assistant-bubble');
  if (welcome) {
    const emblem = element('span', 'welcome-emblem');
    emblem.setAttribute('aria-hidden', 'true');
    body.append(emblem, element('p', 'welcome-kicker', 'Xin chào, mình là Sen.'));
    bubble.append(element('h3', '', 'Bạn đang cần giải pháp nào?'));
  }
  bubble.append(element('p', '', reply.text));
  body.append(bubble);
  appendRecommendations(body, reply);
  appendSources(body, reply.sources);
  if (reply.kind === 'fallback' || reply.kind === 'booking') {
    const action = element('button', 'fallback-booking', 'Đặt lịch tư vấn ↗');
    action.type = 'button';
    action.addEventListener('click', () => openBooking(topic));
    body.append(action);
  }
  const suggestions = relatedSuggestions(reply.suggestions, { message: welcome ? '' : topic });
  body.append(element('p', 'suggestions-label', welcome ? 'Bắt đầu với một câu hỏi' : '3 câu hỏi liên quan'));
  appendSuggestions(body, suggestions);
  message.append(body);
  conversation.append(message);
}

async function ask(question, faqId) {
  const value = question.trim();
  if (busy || !value || value.length > 1000) return;
  if (location.hash === '#admin') { location.hash = '#chat'; navigate(); }
  busy = true;
  byId('chat-page').dataset.state = 'conversation';
  input.disabled = true;
  byId('chat-form').querySelector('button').disabled = true;
  byId('reset-chat').disabled = true;
  byId('sidebar-new-chat').disabled = true;
  lastQuestion = value;
  const user = element('div', 'message user-message');
  user.append(element('div', 'bubble user-bubble', value));
  conversation.append(user);
  input.value = '';
  input.style.height = 'auto';
  const pending = element('p', 'notice', 'Đang suy nghĩ…');
  pending.setAttribute('role', 'status');
  conversation.append(pending);
  conversation.scrollTop = conversation.scrollHeight;
  try {
    const response = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: value, history, ...(faqId ? { faqId } : {}) }), signal: AbortSignal.timeout(35000)
    });
    const reply = await response.json();
    if (!response.ok) throw new Error(reply.error || 'Chưa nhận được phản hồi từ máy chủ.');
    if (typeof reply.text !== 'string') throw new Error('Phản hồi chưa hợp lệ. Vui lòng thử lại.');
    pending.remove();
    appendAssistant(reply);
    history = [...history, { role: 'user', text: value }, { role: 'model', text: reply.text }].slice(-20);
    if (reply.kind === 'booking' && !byId('booking-dialog').open && location.hash !== '#admin') openBooking(value);
  } catch (error) {
    pending.remove();
    appendAssistant({ kind: 'error', text: error.name === 'TimeoutError' ? 'Máy chủ phản hồi quá lâu. Vui lòng gửi lại câu hỏi.' : error.message, suggestions: catalog.suggestions });
    input.value = value;
  } finally {
    busy = false;
    input.disabled = false;
    byId('chat-form').querySelector('button').disabled = false;
    byId('reset-chat').disabled = false;
    byId('sidebar-new-chat').disabled = false;
    conversation.scrollTop = conversation.scrollHeight;
    if (!byId('booking-dialog').open) input.focus({ preventScroll: true });
  }
}

function resetChat() {
  history = [];
  lastQuestion = '';
  byId('chat-page').dataset.state = 'welcome';
  byId('topic-list').querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', 'false'));
  conversation.replaceChildren(element('div', 'conversation-date', 'HÔM NAY · MỘT KHỞI ĐẦU MỚI'));
  const starters = ['SEN-HOSTING-DEFINITION', 'SEN-DOMAIN-DEFINITION', 'SEN-VPS-DEFINITION']
    .map(id => catalog.faqs.find(faq => faq.id === id)).filter(Boolean);
  appendAssistant({ text: 'Từ tên miền đầu tiên đến một website sẵn sàng hoạt động. Cùng tìm lựa chọn phù hợp với bạn.',
    kind: 'answer', suggestions: relatedSuggestions(starters, { fallback: catalog.suggestions }) }, true);
  input.value = '';
  input.style.height = 'auto';
  conversation.scrollTop = 0;
}

function navigate() {
  const admin = location.hash === '#admin';
  byId('chat-page').hidden = admin;
  byId('admin-page').hidden = !admin;
  byId('current-page-label').textContent = admin ? 'Lịch hẹn của bạn' : 'Trợ lý Sen';
  byId('reset-chat').hidden = admin;
  closeSidebar(false);
  for (const [id, active] of [['chat-nav', !admin], ['admin-nav', admin]]) {
    byId(id).classList.toggle('active', active);
    if (active) byId(id).setAttribute('aria-current', 'page');
    else byId(id).removeAttribute('aria-current');
  }
  if (admin) renderAdmin(byId('admin-panel'));
}

function renderCatalog() {
  const serviceIcons = { 'hosting-gia-re': 'server', 'wordpress-hosting': 'brand-wordpress', 'windows-hosting': 'brand-windows',
    'hosting-doanh-nghiep': 'building', 'thue-vps-gia-re': 'cpu', 'vps-n8n': 'hierarchy', 'email-hosting-chuyen-nghiep': 'mail' };
  byId('topic-list').replaceChildren();
  for (const topic of catalog.topics) {
    if (typeof topic.question !== 'string') continue;
    const button = element('button', 'topic-button');
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    button.append(icon(serviceIcons[topic.id] ?? 'server'));
    const text = element('span', 'topic-copy');
    text.append(element('strong', '', topic.label), element('small', '', topic.description));
    button.append(text, icon('chevron-right', 'topic-arrow'));
    button.addEventListener('click', () => {
      if (busy) return;
      byId('topic-list').querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      closeSidebar(false);
      ask(topic.question, topic.faqId);
    });
    byId('topic-list').append(button);
  }
  byId('all-faq-list').replaceChildren();
  for (const faq of catalog.faqs) {
    if (typeof faq.question !== 'string') continue;
    const button = element('button', '', faq.question);
    button.type = 'button';
    button.addEventListener('click', () => { closeSidebar(false); ask(faq.question, faq.id); });
    byId('all-faq-list').append(button);
  }
  byId('all-faq-button').replaceChildren(icon('book-2'), document.createTextNode(`${catalog.faqs.length} câu hỏi thường gặp`));
  byId('knowledge-description').textContent = `${catalog.stats.entries || catalog.faqs.length} mục kiến thức của Sen Hosting giúp bạn tìm hiểu và lựa chọn dịch vụ. Thông tin gói, giá và điều kiện áp dụng sẽ được nhân viên xác nhận.`;
}

async function loadKnowledge() {
  try {
    const response = await fetch('/api/knowledge');
    if (!response.ok) throw new Error('Knowledge unavailable');
    const data = await response.json();
    if (!data || !Array.isArray(data.faqs) || !Array.isArray(data.topics) || !Array.isArray(data.suggestions)) throw new Error('Invalid catalog');
    catalog = { faqs: data.faqs, topics: data.topics, suggestions: safeSuggestions(data.suggestions), stats: data.stats || {} };
    renderCatalog();
    if (!lastQuestion) resetChat();
  } catch {
    byId('all-faq-button').textContent = 'Danh mục kiến thức tạm chưa khả dụng';
    byId('all-faq-button').disabled = true;
    byId('knowledge-description').textContent = 'Chưa tải được danh mục kiến thức. Bạn có thể thử gửi câu hỏi hoặc tải lại trang.';
  }
  try {
    const response = await fetch('/api/status');
    if (!response.ok) throw new Error('Status unavailable');
    const status = await response.json();
    const available = status.knowledge?.entries > 0 || catalog.stats.entries > 0;
    byId('ai-status').textContent = !available ? 'Chưa kết nối được Sen Hosting' : 'FAQ & tư vấn · Sen Hosting';
  } catch { byId('ai-status').textContent = 'Chưa kết nối được máy chủ tra cứu'; }
}

byId('all-faq-button').addEventListener('click', () => {
  const expanded = byId('all-faq-button').getAttribute('aria-expanded') === 'true';
  byId('all-faq-button').setAttribute('aria-expanded', String(!expanded));
  byId('all-faq-list').hidden = expanded;
});
byId('chat-form').addEventListener('submit', (event) => { event.preventDefault(); ask(input.value); });
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    ask(input.value);
  }
});
function startNewChat() {
  if (busy) return;
  location.hash = '#chat';
  closeSidebar(false);
  resetChat();
  input.focus({ preventScroll: true });
}
byId('reset-chat').addEventListener('click', startNewChat);
byId('sidebar-new-chat').addEventListener('click', startNewChat);
input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 150)}px`; });
for (const id of ['inline-booking', 'book-consultation', 'admin-booking']) byId(id).addEventListener('click', () => openBooking());
byId('booking-dialog').addEventListener('close', () => {
  if (location.hash === '#admin') byId('admin-booking').focus({ preventScroll: true });
  else input.focus({ preventScroll: true });
});
window.addEventListener('hashchange', navigate);
window.addEventListener('storage', () => { if (location.hash === '#admin') renderAdmin(byId('admin-panel')); });
mountShell();
resetChat();
navigate();
loadKnowledge();
