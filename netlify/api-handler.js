import { generateReply, generateKnowledgeReply, validateChat } from '../ai.js';
import { renderKnowledgePage } from '../knowledge-page.js';

const bodyLimit = 192000;
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (status, body, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8',
    ...(status === 429 ? { 'Retry-After': '60' } : {}), ...extra }
});
const fail = (status, message) => Object.assign(new Error(message), { status });

async function readInput(request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw fail(415, 'Cần dữ liệu JSON.');
  }
  if (Number(request.headers.get('content-length')) > bodyLimit) throw fail(413, 'Nội dung quá dài.');
  const reader = request.body?.getReader();
  const chunks = [];
  let length = 0;
  if (reader) {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > bodyLimit) {
          await reader.cancel();
          throw fail(413, 'Nội dung quá dài.');
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  let input;
  try { input = JSON.parse(Buffer.concat(chunks, length).toString('utf8')); }
  catch { throw fail(400, 'JSON không hợp lệ.'); }
  return validateChat(input);
}

function sourcePage(request, path, knowledge) {
  const id = path.slice('/knowledge/'.length);
  const entry = /^SEN-[A-Z0-9-]+$/.test(id) ? knowledge.getEntry(id) : null;
  if (!entry) return json(404, { error: 'Không tìm thấy nội dung Sen Hosting.' });
  return new Response(request.method === 'HEAD' ? null : renderKnowledgePage(entry), {
    headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'self'; script-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'" }
  });
}

export function createApiHandler({ knowledge, env = {}, generate = generateReply } = {}) {
  const configured = Boolean(env.GEMINI_API_KEY?.trim());
  const mode = ['mock', 'retrieval'].includes(env.CHAT_MODE) || !configured ? 'retrieval' : 'gemini';
  return async request => {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      if (request.method === 'GET' && path === '/api/status') {
        return json(200, { brandName: 'Sen Hosting', mode,
          configured: mode === 'retrieval' || configured, knowledge: knowledge.stats });
      }
      if (request.method === 'GET' && path === '/api/knowledge') return json(200, knowledge.catalog());
      if (['GET', 'HEAD'].includes(request.method) && path.startsWith('/knowledge/')) {
        return sourcePage(request, path, knowledge);
      }
      if (path !== '/api/chat') return json(404, { error: 'Không tìm thấy nội dung.' });
      if (request.method !== 'POST') return json(405, { error: 'Cần sử dụng POST.' }, { Allow: 'POST' });
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) return json(403, { error: 'Nguồn yêu cầu không hợp lệ.' });
      const input = await readInput(request);
      const reply = mode === 'retrieval' ? generateKnowledgeReply(input, { knowledge })
        : await generate(input, { knowledge, key: env.GEMINI_API_KEY, model: env.GEMINI_MODEL });
      return json(200, reply);
    } catch (error) {
      const status = [400, 413, 415, 429, 502, 503].includes(error.status) ? error.status : 500;
      return json(status, { error: status === 500 ? 'Không thể xử lý câu hỏi. Vui lòng thử lại.' : error.message });
    }
  };
}
