import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { generateReply, generateKnowledgeReply, validateChat } from './ai.js';
import { getKnowledge } from './knowledge.js';
import { renderKnowledgePage } from './knowledge-page.js';

const envFile = new URL('.env', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);
const knowledge = getKnowledge();
const configured = Boolean(process.env.GEMINI_API_KEY?.trim());
const mode = ['mock', 'retrieval'].includes(process.env.CHAT_MODE) || !configured ? 'retrieval' : 'gemini';
let requestCount = 0;
let windowStart = Date.now();
let readCount = 0;
let readWindowStart = Date.now();
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(status === 429 ? { 'Retry-After': '60' } : {}) });
  res.end(JSON.stringify(body));
}
async function chat(req, res) {
  if (req.headers.origin && ![`http://${req.headers.host}`].includes(req.headers.origin)) return json(res, 403, { error: 'Nguồn yêu cầu không hợp lệ.' });
  if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'Cần dữ liệu JSON.' });
  if (Date.now() - windowStart > 60000) { windowStart = Date.now(); requestCount = 0; }
  // ponytail: bounded local-demo limiter; use per-user limits when deploying publicly.
  if (++requestCount > 20) return json(res, 429, { error: 'Bạn gửi quá nhiều yêu cầu. Vui lòng đợi một phút.' });
  let body = '';
  try {
    req.setEncoding('utf8');
    for await (const chunk of req) {
      body += chunk.toString();
      if (Buffer.byteLength(body) > 192000) return json(res, 413, { error: 'Nội dung quá dài.' });
    }
    let input;
    try { input = JSON.parse(body); } catch { return json(res, 400, { error: 'JSON không hợp lệ.' }); }
    const validated = validateChat(input);
    const reply = mode === 'retrieval' ? generateKnowledgeReply(validated, { knowledge }) : await generateReply(validated, { knowledge });
    json(res, 200, reply);
  } catch (error) { json(res, error.status || 500, { error: error.status ? error.message : 'Không thể xử lý câu hỏi. Vui lòng thử lại.' }); }
}

const files = { '/': 'index.html', '/index.html': 'index.html', '/styles.css': 'styles.css', '/app.js': 'app.js', '/appointments.js': 'appointments.js', '/booking.js': 'booking.js' };
const types = { html: 'text/html', css: 'text/css', js: 'text/javascript' };
const port = Number(process.env.PORT || 5173);
const server = createServer(async (req, res) => {
  let file;
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path.startsWith('/knowledge/') && req.method === 'GET') {
      const id = path.slice('/knowledge/'.length);
      const entry = /^SEN-[A-Z0-9-]+$/.test(id) ? knowledge.getEntry(id) : null;
      if (!entry) return json(res, 404, { error: 'Không tìm thấy nội dung Sen Hosting.' });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control':'no-store',
        'Content-Security-Policy': "default-src 'self'; script-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'" });
      res.end(renderKnowledgePage(entry));
      return;
    }
    if (req.method === 'GET' && path.startsWith('/api/')) {
      if (Date.now() - readWindowStart > 60000) { readWindowStart = Date.now(); readCount = 0; }
      if (++readCount > 240) return json(res, 429, { error: 'Bạn tra cứu quá nhiều lần. Vui lòng đợi một phút.' });
    }
    if (path === '/api/status' && req.method === 'GET') return json(res, 200, { brandName:'Sen Hosting', mode, configured: mode === 'retrieval' || configured, knowledge: knowledge.stats });
    if (path === '/api/knowledge' && req.method === 'GET') return json(res, 200, knowledge.catalog());
    if (path === '/api/chat' && req.method === 'POST') return await chat(req, res);
    file = files[path];
  }
  catch { res.writeHead(400); res.end('Invalid URL'); return; }
  if (!file || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const body = await readFile(new URL(file, import.meta.url));
    res.writeHead(200, { 'Content-Type': `${types[file.split('.').at(-1)]}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(500); res.end('Unable to load file'); }
}).listen(port, '127.0.0.1', () => console.log(`Sen Hosting: http://localhost:${server.address().port}`));
