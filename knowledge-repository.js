import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { normalize, sourceUrl } from './knowledge-text.js';

function validateEntries(entries) {
  if (!Array.isArray(entries) || !entries.length) throw new Error('Invalid knowledge entries');
  const ids = new Set();
  for (const entry of entries) {
    if (!entry.id || ids.has(entry.id) || !sourceUrl(entry.sourceUrl) || !entry.answer?.trim() ||
        !entry.service || !entry.reviewStatus || !Number.isFinite(Date.parse(entry.fetchedAt))) {
      throw new Error('Invalid knowledge source, URL or entry');
    }
    ids.add(entry.id);
  }
}

function hashEntries(entries) { return createHash('sha256').update(JSON.stringify(entries)).digest('hex'); }

function existingMatches(path, hash) {
  let database;
  try {
    database = new DatabaseSync(path, { readOnly: true });
    return database.prepare("SELECT value FROM metadata WHERE key='hash'").get()?.value === hash;
  } catch { return false; }
  finally { database?.close(); }
}

function buildDatabase(path, entries, hash) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  let database;
  try {
    database = new DatabaseSync(temporary);
    database.exec(`CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE entries (id TEXT PRIMARY KEY, service TEXT NOT NULL, status TEXT NOT NULL, json TEXT NOT NULL);
      CREATE INDEX entries_scope ON entries(service,status);
      CREATE VIRTUAL TABLE search USING fts5(id UNINDEXED, question, answer, aliases, tokenize='unicode61');`);
    database.exec('BEGIN');
    const insert = database.prepare('INSERT INTO entries VALUES(?,?,?,?)');
    const index = database.prepare('INSERT INTO search VALUES(?,?,?,?)');
    for (const entry of entries) {
      insert.run(entry.id, entry.service, entry.reviewStatus, JSON.stringify(entry));
      index.run(entry.id, normalize(entry.question ?? entry.heading), normalize(entry.answer), normalize((entry.aliases ?? []).join(' ')));
    }
    database.prepare('INSERT INTO metadata VALUES(?,?)').run('hash', hash);
    database.exec('COMMIT');
    database.close();
    database = null;
    renameSync(temporary, path);
  } finally {
    database?.close();
    rmSync(temporary, { force: true });
  }
}

export function openKnowledgeRepository({ path, entries }) {
  validateEntries(entries);
  const hash = hashEntries(entries);
  if (!existingMatches(path, hash)) buildDatabase(path, entries, hash);
  const database = new DatabaseSync(path, { readOnly: true });
  return {
    all() { return database.prepare('SELECT json FROM entries ORDER BY id').all().map(row => JSON.parse(row.json)); },
    search(terms, service) {
      const words = [...new Set(terms.flatMap(term => normalize(term).split(' ')).filter(Boolean))].slice(0, 32);
      if (!words.length) return [];
      const match = words.map(word => `"${word}"`).join(' OR ');
      const statement = `SELECT e.json FROM search s JOIN entries e ON s.id=e.id
        WHERE search MATCH ? AND e.status IN ('source_checked','sen_published','sen_approved') ${service ? 'AND e.service=?' : ''}
        ORDER BY bm25(search,0,5,1,3) LIMIT 120`;
      return database.prepare(statement).all(...(service ? [match, service] : [match])).map(row => JSON.parse(row.json));
    },
    close() { database.close(); }
  };
}
