import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderKnowledgePage } from '../knowledge-page.js';

const entry = { question:'SSL là gì?', answer:'SSL mã hóa kết nối tới website.', updatedAt:'2026-11-07T00:00:00Z', companySpecific:false };
test('published knowledge pages use the Sen brand and source update date', () => {
  const html = renderKnowledgePage(entry);
  assert.match(html, /SSL là gì\? — Sen Hosting/);
  assert.match(html, /0?7\/11\/2026/);
  assert.match(html, /Kiến thức tổng quát/);
  assert.doesNotMatch(html, /vinahost/i);
});
test('knowledge page treats malicious author text as text rather than executable markup', () => {
  const html = renderKnowledgePage({ ...entry, companySpecific:true, question:'<img src=x onerror=alert(1)>', answer:'<script>alert("x")</script> & <a href="javascript:x">click</a>' });
  assert.doesNotMatch(html, /<script>|<img|<a href="javascript:/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp;/);
  assert.match(html, /Thông tin dịch vụ Sen Hosting/);
});
