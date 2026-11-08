"""Read-only loopback evidence API; local development, no LLM required."""
import argparse
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import logging
from pathlib import Path
import re
import threading
import time
from urllib.parse import parse_qs, urlsplit
from .db import connect_readonly, list_faqs, search_database


def counts(path):
    with closing(connect_readonly(path)) as connection:
        return {table: connection.execute('SELECT count(*) FROM ' + table).fetchone()[0]
                for table in ('sources', 'faqs', 'chunks')}


class Handler(BaseHTTPRequestHandler):
    server_version = 'FAQEvidence/1.0'

    def log_message(self, format, *args):
        # Avoid persisting user questions in access logs.
        return

    def reply(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Security-Policy', "default-src 'none'")
        if status == 429:
            self.send_header('Retry-After', '60')
        self.end_headers()
        self.wfile.write(body)

    def allowed(self):
        with self.server.rate_lock:
            stamp = time.monotonic()
            if stamp - self.server.rate_started >= 60:
                self.server.rate_started, self.server.rate_count = stamp, 0
            self.server.rate_count += 1
            ok = self.server.rate_count <= self.server.rate_limit
        if not ok:
            self.reply(429, {'success': False, 'error': 'Too many requests'})
        return ok

    def do_GET(self):
        if not self.allowed():
            return
        try:
            if len(self.path) > 3000 or re.search(r'%(?![0-9a-fA-F]{2})', self.path):
                raise ValueError('Malformed URL')
            parsed = urlsplit(self.path)
            query = parse_qs(parsed.query, keep_blank_values=True, encoding='utf-8', errors='strict', max_num_fields=10)
            if any(len(values) != 1 for values in query.values()):
                raise ValueError('Repeated query parameters')
            get = lambda key, default: query.get(key, [default])[0]
            if parsed.path == '/health':
                data, meta = counts(self.server.db_path), {}
            elif parsed.path == '/api/search':
                data = search_database(self.server.db_path, get('q', ''), int(get('limit', '5')))
                meta = {'retrieval_only': True, 'empty_result': 'Không tìm thấy bằng chứng phù hợp' if not data else None}
            elif parsed.path == '/api/faqs':
                category = get('category', None)
                if category and not re.fullmatch(r'[a-z-]{1,40}', category):
                    raise ValueError('Invalid category')
                data = list_faqs(self.server.db_path, int(get('limit', '20')), int(get('offset', '0')), category)
                meta = {}
            else:
                self.reply(404, {'success': False, 'error': 'Not found'})
                return
            self.reply(200, {'success': True, 'data': data, 'meta': meta})
        except (ValueError, UnicodeError):
            self.reply(400, {'success': False, 'error': 'Invalid query parameters'})
        except Exception:
            logging.exception('Evidence API request failed')
            self.reply(500, {'success': False, 'error': 'Unable to retrieve evidence'})

    def reject_write(self):
        if self.allowed():
            # Drain small bodies so Windows does not reset the socket before JSON is read.
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if 0 < length <= 16384:
                    self.connection.settimeout(3)
                    self.rfile.read(length)
            except (ValueError, OSError):
                self.close_connection = True
            self.reply(405, {'success': False, 'error': 'Read-only API; GET required'})

    do_POST = reject_write
    do_PUT = reject_write
    do_PATCH = reject_write
    do_DELETE = reject_write
    do_OPTIONS = reject_write
    do_HEAD = reject_write


def create_server(db_path, port=0):
    counts(db_path)  # Fail at startup if no valid database exists.
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    server.db_path = Path(db_path)
    server.rate_limit = 120
    server.rate_lock = threading.Lock()
    server.rate_started, server.rate_count = time.monotonic(), 0
    return server


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', default='data/vinahost.sqlite')
    parser.add_argument('--port', type=int, default=8010)
    args = parser.parse_args()
    server = create_server(args.db, args.port)
    print(f'FAQ evidence API: http://127.0.0.1:{server.server_address[1]}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
