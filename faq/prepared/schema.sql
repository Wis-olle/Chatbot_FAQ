CREATE TABLE entries (id TEXT PRIMARY KEY, service TEXT NOT NULL, status TEXT NOT NULL, json TEXT NOT NULL);

CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE VIRTUAL TABLE search USING fts5(id UNINDEXED, question, answer, aliases, tokenize='unicode61');

CREATE INDEX entries_scope ON entries(service,status);
