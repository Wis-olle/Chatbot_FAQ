import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateReply } from '../ai.js';
import { createServerlessKnowledge } from '../netlify/knowledge.js';

const knowledge = createServerlessKnowledge();
const provider = output => Response.json({ candidates: [{ finishReason: 'STOP',
  content: { parts: [{ text: JSON.stringify(output) }] } }] });
const followUpQuestions = ['Tên miền kết nối với hosting thế nào?', 'Bắt đầu tạo website cần gì?', 'Chọn dung lượng hosting theo nhu cầu thế nào?'];

test('known FAQ questions, aliases and selected FAQ buttons give Gemini retrieved answers before paraphrasing', async () => {
  const faq = knowledge.getEntry('SEN-HOSTING-DEFINITION');
  for (const input of [{ message: faq.question }, { message: faq.aliases[1] },
    { message: faq.question, faqId: faq.id }]) {
    let calls = 0;
    const reply = await generateReply(input, { knowledge, key: 'test-key', fetcher: async (url, options) => {
      calls++;
      const request = JSON.parse(options.body);
      const payload = JSON.parse(request.contents.at(-1).parts[0].text);
      assert.equal(payload.route, 'business');
      assert.ok(payload.EVIDENCE.some(entry => entry.id === faq.id && entry.answer === faq.answer));
      return provider({ kind: 'answer', text: 'Hosting cung cấp không gian lưu trữ để website hoạt động trên Internet.',
        sourceIds: [faq.id], relatedIds: [], followUpQuestions });
    } });
    assert.equal(calls, 1);
    assert.equal(reply.source, 'gemini');
    assert.notEqual(reply.text, faq.answer);
    assert.equal(reply.sources[0].id, faq.id);
    assert.deepEqual(reply.suggestions, followUpQuestions.map(question => ({ question })));
  }
});

test('all eight video FAQ questions retain retrieved sources throughout the same conversation', async () => {
  const ids = ['SEN-HOSTING-DEFINITION', 'SEN-HOSTING-DOMAIN', 'SEN-SHARED-HOSTING', 'SEN-STORAGE-BANDWIDTH',
    'SEN-WP-DEFINITION', 'SEN-DOMAIN-DNS', 'SEN-VPS-DEFINITION', 'SEN-SSL-DEFINITION'];
  let history = [];
  for (const id of ids) {
    const faq = knowledge.getEntry(id);
    const reply = await generateReply({ message: faq.question, history }, { knowledge, key: 'test-key',
      fetcher: async (url, options) => {
        const payload = JSON.parse(JSON.parse(options.body).contents.at(-1).parts[0].text);
        assert.equal(payload.route, 'business', id);
        assert.ok(payload.EVIDENCE.some(entry => entry.id === id), id);
        return provider({ kind: 'answer', text: `Nói đơn giản, ${faq.answer}`, sourceIds: [id], relatedIds: [], followUpQuestions });
      }
    });
    assert.equal(reply.source, 'gemini', id);
    assert.equal(reply.sources[0].id, id);
    assert.equal(reply.suggestions.length, 3);
    history = [...history, { role: 'user', text: faq.question }, { role: 'model', text: reply.text }];
  }
});

test('an unrelated question cannot use a supplied FAQ ID to authorize retrieved evidence', async () => {
  const reply = await generateReply({ message: 'n8n là gì?', faqId: 'SEN-HOSTING-DEFINITION' }, {
    knowledge, key: 'test-key', fetcher: async (url, options) => {
      const payload = JSON.parse(JSON.parse(options.body).contents.at(-1).parts[0].text);
      assert.equal(payload.route, 'general');
      assert.deepEqual(payload.EVIDENCE, []);
      return provider({ kind: 'answer', text: 'n8n giúp tự động hóa quy trình.', sourceIds: [], relatedIds: [], followUpQuestions });
    }
  });
  assert.equal(reply.route, 'general');
  assert.deepEqual(reply.sources, []);
});

test('business questions still require approved company data even when supplied a published general FAQ ID', async () => {
  const reply = await generateReply({ message: 'Sen Hosting cam kết bồi thường bao nhiêu nếu website ngừng hoạt động 3 giờ?',
    faqId: 'SEN-HOSTING-DEFINITION' }, {
    knowledge, key: 'test-key', fetcher: async () => { assert.fail('unapproved company claim must not call Gemini'); }
  });
  assert.equal(reply.kind, 'fallback');
  assert.equal(reply.source, 'knowledge');
  assert.deepEqual(reply.sources, []);
});
