PRAGMA foreign_keys = ON;
CREATE TABLE sources (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    language TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    text TEXT NOT NULL,
    metadata_json TEXT NOT NULL
);
CREATE TABLE faqs (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources(id),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    extraction_method TEXT NOT NULL,
    review_status TEXT NOT NULL,
    content_hash TEXT NOT NULL
);
CREATE TABLE chunks (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources(id),
    position INTEGER NOT NULL,
    heading TEXT NOT NULL,
    text TEXT NOT NULL,
    content_hash TEXT NOT NULL
);
CREATE INDEX sources_category ON sources(category);
CREATE INDEX faqs_source ON faqs(source_id);
CREATE INDEX chunks_source ON chunks(source_id);
CREATE VIRTUAL TABLE knowledge_fts USING fts5(
    item_id UNINDEXED, source_id UNINDEXED, kind UNINDEXED,
    title, heading, body, tokenize='unicode61 remove_diacritics 2'
);
