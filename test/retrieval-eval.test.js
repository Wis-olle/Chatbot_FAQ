import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { getKnowledge } from '../knowledge.js';

const fixture = JSON.parse(readFileSync(new URL('../sen-hosting/content/evaluation.json', import.meta.url), 'utf8'));
const knowledge = getKnowledge();
const results = [];
for (const example of fixture.cases) {
  test(`retrieval acceptance: ${example.id}`, () => {
    const reply = knowledge.retrieve(example);
    const problems = [];
    if (/VinaHost|vinahost\.vn/i.test(JSON.stringify(reply))) problems.push('foreign provider branding leaked');
    if (reply.kind !== example.expectedKind) problems.push(`kind ${reply.kind}, expected ${example.expectedKind}`);
    if (example.expectedService && reply.service !== example.expectedService) problems.push(`service ${reply.service}, expected ${example.expectedService}`);
    if (example.expectedSourceUrl && !reply.evidence.some(e => e.sourceUrl === example.expectedSourceUrl)) problems.push('expected source not retrieved');
    for (const text of example.mustContain ?? []) if (!reply.text.includes(text)) problems.push(`missing: ${text}`);
    for (const text of example.mustNotContain ?? []) if (reply.text.includes(text)) problems.push(`forbidden: ${text}`);
    results.push({ id: example.id, passed: problems.length === 0, problems, kind: reply.kind, service: reply.service,
      sourceUrls: [...new Set(reply.evidence.map(e => e.sourceUrl))] });
    assert.deepEqual(problems, [], example.message);
  });
}
after(() => {
  writeFileSync(new URL('../sen-hosting/prepared/evaluation-report.json', import.meta.url), JSON.stringify({
    evaluatedAt: new Date().toISOString(), scope: 'Offline Sen Hosting knowledge and business boundaries; general Gemini is tested separately and no paid calls occur',
    total: results.length, passed: results.filter(r => r.passed).length, results
  }, null, 2) + '\n');
});
