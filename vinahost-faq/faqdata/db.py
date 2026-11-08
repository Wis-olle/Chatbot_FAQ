"""Atomic snapshot imports and parameterized local full-text retrieval."""
import json
import os
from contextlib import closing
from pathlib import Path
import re
import sqlite3
import tempfile
from .extract import digest, fold

SCHEMA = Path(__file__).resolve().parents[1] / 'schema.sql'


def connect_readonly(path):
    connection = sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def insert_page(connection, page):
    values = [page[k] for k in ('id', 'url', 'title', 'category', 'language', 'fetched_at', 'content_hash', 'text')]
    if not all(isinstance(v, str) and v.strip() for v in values):
        raise ValueError('Invalid source')
    metadata = {k: v for k, v in page.items() if k not in ('text', 'faqs', 'chunks')}
    connection.execute('INSERT INTO sources VALUES (?,?,?,?,?,?,?,?,?)', values + [json.dumps(metadata, ensure_ascii=False)])
    for faq in page['faqs']:
        if not faq['question'].strip() or not faq['answer'].strip():
            raise ValueError('Empty FAQ')
        connection.execute('INSERT INTO faqs VALUES (?,?,?,?,?,?,?)',
                           (faq['id'], page['id'], faq['question'], faq['answer'], faq['extraction_method'],
                            faq['review_status'], faq.get('content_hash', digest(faq['question'] + faq['answer']))))
        connection.execute('INSERT INTO knowledge_fts VALUES (?,?,?,?,?,?)',
                           (faq['id'], page['id'], 'faq', fold(page['title']), fold(faq['question']), fold(faq['answer'])))
    for chunk in page['chunks']:
        connection.execute('INSERT INTO chunks VALUES (?,?,?,?,?,?)',
                           (chunk['id'], page['id'], chunk['position'], chunk['heading'], chunk['text'],
                            chunk.get('content_hash', digest(chunk['text']))))
        connection.execute('INSERT INTO knowledge_fts VALUES (?,?,?,?,?,?)',
                           (chunk['id'], page['id'], 'chunk', fold(page['title']), fold(chunk['heading']), fold(chunk['text'])))


def build_database(pages, path):
    """Replace the whole snapshot only after successful validation/import."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=path.name, suffix='.tmp', dir=path.parent)
    os.close(handle)
    try:
        with closing(sqlite3.connect(temporary)) as connection:
            with connection:
                connection.executescript(SCHEMA.read_text(encoding='utf-8'))
                for page in pages:
                    insert_page(connection, page)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def search_database(path, query, limit=5):
    if not isinstance(query, str) or not query.strip() or len(query) > 500:
        raise ValueError('q must contain 1–500 characters')
    if not isinstance(limit, int) or not 1 <= limit <= 20:
        raise ValueError('limit must be 1–20')
    terms = list(dict.fromkeys(re.findall(r'\w+', fold(query))))[:32]
    if not terms:
        return []
    match = ' AND '.join('"' + term + '"' for term in terms)
    sql = '''SELECT k.item_id AS id, k.kind, s.url AS source_url, s.title, s.category,
                    s.fetched_at, bm25(knowledge_fts,0,0,0,2,5,1) AS score,
                    COALESCE(f.question,c.heading) AS heading,
                    COALESCE(f.answer,c.text) AS text, f.review_status
             FROM knowledge_fts k JOIN sources s ON s.id=k.source_id
             LEFT JOIN faqs f ON f.id=k.item_id AND k.kind='faq'
             LEFT JOIN chunks c ON c.id=k.item_id AND k.kind='chunk'
             WHERE knowledge_fts MATCH ? ORDER BY score LIMIT ?'''
    with closing(connect_readonly(path)) as connection:
        return [dict(row) for row in connection.execute(sql, (match, limit))]


def list_faqs(path, limit=20, offset=0, category=None):
    if not 1 <= limit <= 100 or not 0 <= offset <= 100000:
        raise ValueError('Invalid pagination')
    where, params = ('WHERE s.category=?', [category]) if category else ('', [])
    with closing(connect_readonly(path)) as connection:
        total = connection.execute('SELECT count(*) FROM faqs f JOIN sources s ON s.id=f.source_id ' + where, params).fetchone()[0]
        rows = connection.execute('''SELECT f.*, s.url AS source_url, s.title, s.category, s.fetched_at
            FROM faqs f JOIN sources s ON s.id=f.source_id ''' + where + ' ORDER BY s.url,f.id LIMIT ? OFFSET ?', params + [limit, offset])
        return {'items': [dict(row) for row in rows], 'total': total, 'limit': limit, 'offset': offset}
