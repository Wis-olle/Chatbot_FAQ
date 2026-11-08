const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);

export function renderKnowledgePage(entry) {
  const updated = new Intl.DateTimeFormat('vi-VN', { timeZone:'Asia/Ho_Chi_Minh' }).format(new Date(entry.updatedAt ?? entry.fetchedAt));
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(entry.question)} — Sen Hosting</title><link rel="stylesheet" href="/styles.css"></head>
  <body><header class="site-header"><a class="brand" href="/">Sen Hosting</a><a href="/">← Về trò chuyện</a></header>
  <main class="knowledge-reader"><p class="eyebrow">KIẾN THỨC SEN HOSTING</p><h1>${escape(entry.question)}</h1><p>${escape(entry.answer)}</p>
  <small>${escape(entry.companySpecific ? 'Thông tin dịch vụ Sen Hosting' : 'Kiến thức tổng quát')} · Cập nhật ${escape(updated)}</small></main></body></html>`;
}
