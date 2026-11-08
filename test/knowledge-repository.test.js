import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openKnowledgeRepository } from '../knowledge-repository.js';

const entries = [
  { id: 'wp-backup', kind: 'faq', question: 'WordPress có sao lưu không?', answer: 'Sao lưu dữ liệu 4 lần mỗi ngày.',
    service: 'wordpress-hosting', topic: 'backup', reviewStatus: 'source_checked', sourceUrl: 'https://vinahost.vn/wordpress-hosting/', fetchedAt: '2026-11-07T05:00:00Z', title: 'WordPress Hosting' },
  { id: 'windows-backup', kind: 'faq', question: 'Windows có backup không?', answer: 'Sao lưu 2 lần mỗi ngày.',
    service: 'windows-hosting', topic: 'backup', reviewStatus: 'unreviewed', sourceUrl: 'https://vinahost.vn/windows-hosting/', fetchedAt: '2026-11-07T05:00:00Z', title: 'Windows Hosting' }
];

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'vinahost-knowledge-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return join(dir, 'knowledge.sqlite');
}

test('repository persists linked source metadata and retrieves accentless scoped evidence', t => {
  const path = fixture(t);
  const repo = openKnowledgeRepository({ path, entries });
  try {
    assert.equal(repo.all().length, 2);
    const hits = repo.search(['sao', 'luu'], 'wordpress-hosting');
    assert.equal(hits[0].id, 'wp-backup');
    assert.equal(hits[0].sourceUrl, entries[0].sourceUrl);
    assert.deepEqual(repo.search(['sao', 'luu'], 'windows-hosting'), []);
  } finally { repo.close(); }
});

test('repeat build is idempotent and changed snapshot removes stale entries', t => {
  const path = fixture(t);
  let repo = openKnowledgeRepository({ path, entries });
  repo.close();
  repo = openKnowledgeRepository({ path, entries });
  assert.equal(repo.all().length, 2);
  repo.close();
  repo = openKnowledgeRepository({ path, entries: [entries[0]] });
  assert.equal(repo.all().length, 1);
  repo.close();
});

test('invalid source import preserves existing database', t => {
  const path = fixture(t);
  const repo = openKnowledgeRepository({ path, entries });
  repo.close();
  const before = readFileSync(path);
  assert.throws(() => openKnowledgeRepository({ path, entries: [{ ...entries[0], sourceUrl: 'javascript:alert(1)' }] }), /source|URL|invalid/i);
  assert.deepEqual(readFileSync(path), before);
});

test('search treats FTS punctuation and SQL payloads as data', t => {
  const repo = openKnowledgeRepository({ path: fixture(t), entries });
  try {
    assert.doesNotThrow(() => repo.search(['" OR 1=1; DROP TABLE entries; --']));
    assert.equal(repo.all().length, 2);
    assert.deepEqual(repo.search(['nonexistentxyz']), []);
    assert.deepEqual(repo.search([]), []);
  } finally { repo.close(); }
});
