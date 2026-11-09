import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { get } from 'node:http';

test('server rejects malformed URLs and private files then continues serving', { timeout: 10000 }, async () => {
  const child = spawn(process.execPath, ['server.js'], { cwd: new URL('../', import.meta.url), env: { ...process.env, PORT: '0', CHAT_MODE: 'gemini', GEMINI_API_KEY: '' }, windowsHide: true });
  try {
    const port = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', code => reject(new Error(`Server exited ${code}`)));
      child.stdout.on('data', chunk => {
        const match = chunk.toString().match(/localhost:(\d+)/);
        if (match) resolve(Number(match[1]));
      });
    });
    const request = path => new Promise((resolve, reject) => {
      get({ host: '127.0.0.1', port, path }, res => {
        res.resume();
        res.on('end', () => resolve(res));
      }).on('error', reject);
    });
    assert.equal((await request('//[')).statusCode, 400);
    assert.equal((await request('/package.json')).statusCode, 404);
    const response = await request('/');
    assert.equal(response.statusCode, 200);
    assert.ok(response.headers['content-security-policy'].includes("script-src 'self'"));
    const url = `http://127.0.0.1:${port}`;
    assert.equal((await request('/.env')).statusCode, 404);
    assert.equal((await request('/ai.js')).statusCode, 404);
    assert.equal((await request('/suggestions.js')).statusCode, 200);
    assert.equal((await request('/ui-shell.js')).statusCode, 200);
    const icons = await fetch(`${url}/icons.svg`);
    assert.equal(icons.status, 200);
    assert.match(icons.headers.get('content-type'), /^image\/svg\+xml/);
    const sprite = await icons.text();
    assert.match(sprite, /symbol id="calendar-event"/);
    assert.doesNotMatch(sprite, /<script|foreignObject|onload=/i);
    const status = await (await fetch(`${url}/api/status`)).json();
    assert.equal(status.mode, 'retrieval');
    assert.equal(status.configured, true);
    assert.ok(status.knowledge.faqs >= 30);
    for (const path of ['/faq.js', '/knowledge.js', '/faq/prepared/knowledge.sqlite', '/faq/prepared/review-queue.json']) {
      assert.equal((await request(path)).statusCode, 404);
    }
    const catalog = await (await fetch(`${url}/api/knowledge`)).json();
    assert.ok(catalog.faqs.length >= 30);
    assert.equal(catalog.suggestions.length, 3);
    assert.equal(catalog.brandName, 'Sen Hosting');
    assert.doesNotMatch(JSON.stringify(catalog), /VinaHost|vinahost\.vn/i);
    const sourcePage = await fetch(`${url}/knowledge/${catalog.faqs[0].id}`);
    assert.equal(sourcePage.status, 200);
    const sourceHtml = await sourcePage.text();
    assert.match(sourceHtml, /Sen Hosting/);
    assert.doesNotMatch(sourceHtml, /VinaHost|vinahost\.vn/i);
    assert.equal((await request('/knowledge/SEN-NOT-FOUND')).statusCode, 404);
    assert.equal((await request('/knowledge/%3Cscript%3E')).statusCode, 404);
    const post = (body, headers = {}) => fetch(`${url}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
    assert.equal((await post('{}')).status, 400);
    assert.equal((await post('{bad')).status, 400);
    assert.equal((await post('{"message":"hi"}', { Origin: 'https://other.example' })).status, 403);
    assert.equal((await post('{"message":"hi"}', { 'Content-Type': 'text/plain' })).status, 415);
    const greeting = await post('{"message":"xin chào"}');
    assert.equal(greeting.status, 200);
    assert.equal((await greeting.json()).source, 'knowledge');
    const ask = async message => (await post(JSON.stringify({ message }))).json();
    const definition = await ask('Hosting và tên miền khác nhau thế nào?');
    assert.equal(definition.kind, 'answer');
    assert.match(definition.text, /tên miền|địa chỉ/i);
    assert.doesNotMatch(JSON.stringify(definition), /VinaHost|vinahost\.vn/i);
    assert.ok(definition.sources.length > 0);
    assert.ok(definition.sources.every(source => source.url.startsWith('/knowledge/SEN-')));
    assert.equal(definition.suggestions.length, 3);
    const wordpress = await ask('WordPress Hosting sao lưu bao nhiêu lần?');
    assert.equal(wordpress.kind, 'fallback');
    assert.equal(wordpress.suggestions.length, 3);
    assert.doesNotMatch(JSON.stringify(wordpress), /VinaHost|vinahost\.vn|4 lần\/ngày|2 lần\/ngày|Starter|49\.000|99\.000/i);
    assert.equal((await ask('Hosting có backup không?')).kind, 'clarify');
    for (const message of ['Chính sách hoàn tiền của Sen Hosting?', 'Số điện thoại Sen Hosting là gì?', 'Thanh toán Sen Hosting vào ngân hàng nào?']) {
      const policy = await ask(message);
      assert.equal(policy.kind, 'fallback', message);
      assert.doesNotMatch(JSON.stringify(policy), /VinaHost|vinahost\.vn|1900\s*6046|Nơ Trang Long/i);
    }
    assert.equal((await ask('Đổi mật khẩu Facebook thế nào?')).kind, 'fallback');
    const price = await ask('Hosting giá rẻ có giá bao nhiêu?');
    assert.equal(price.kind, 'answer');
    assert.match(price.text, /Giá danh mục/);
    assert.match(price.text, /bản chụp|đối chiếu/);
    assert.ok(price.sources.every(source => source.url.startsWith('/knowledge/SEN-CATALOG-')));
    assert.equal((await post(JSON.stringify({ message: 'hello', faqId: '../invalid' }))).status, 400);
    let lastRead;
    for (let index = 0; index < 245; index++) lastRead = await fetch(`${url}/api/status`);
    assert.equal(lastRead.status, 429);
    assert.equal(lastRead.headers.get('retry-after'), '60');
  } finally { child.kill(); }
});
