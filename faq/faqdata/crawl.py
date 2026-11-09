"""Polite same-domain crawl, resumable raw snapshots, transparent exports."""
import argparse
from collections import Counter
import csv
from datetime import datetime, timezone
import gzip
import json
import os
from pathlib import Path
import re
import time
import tempfile
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser
import xml.etree.ElementTree as ET
import requests
from bs4 import BeautifulSoup
from .db import build_database
from .extract import category, digest, extract_page
from .urls import BASE, normalize_url

USER_AGENT = 'VinaHostFAQDataset/1.0 (public FAQ research; single worker)'
POLICIES = ['chinh-sach-hoan-tien', 'quy-dinh-su-dung-dich-vu', 'privacy-policy',
            'chinh-sach-bao-ve-du-lieu-ca-nhan', 'chinh-sach-dung-thu-vps',
            'quy-dinh-su-dung-ten-mien-viet-nam', 'thoa-thuan-su-dung-ten-mien-quoc-te']
CORE = ['hosting-gia-re', 'dang-ky-ten-mien', 'thue-vps-gia-re', 'lien-he', 'thanh-toan',
        'ho-tro', 'hosting-cao-cap', 'wordpress-hosting', 'email-hosting-chuyen-nghiep',
        'mua-ssl-gia-re', 'server/thue-cloud-server'] + POLICIES


def now():
    return datetime.now(timezone.utc).isoformat()


def scope_url(url):
    value = normalize_url(url)
    if not value:
        return False
    path = urlsplit(value).path.lower()
    if any(x in path for x in ('/blog/', '/category/', 'khuyen-mai', 'tuyen-dung', 'ra-mat', 'vinahost-ra-', 'tang-gia', '-la-gi', '/cach-', '/vnnic-', '/alibaba-cloud-partner/')):
        return False
    return value == BASE or category(value) != 'company' or path in ('/dnssec/', '/snapshot-file-backup/')


class Fetcher:
    def __init__(self, delay=1.0):
        self.session = requests.Session()
        self.session.headers.update({'User-Agent': USER_AGENT})
        self.delay, self.last_request = delay, 0.0
        self.robots = None

    def get(self, url):
        for attempt in range(3):
            current = url
            for _ in range(6):
                parsed = urlsplit(current)
                if parsed.scheme != 'https' or parsed.netloc != 'vinahost.vn' or parsed.query:
                    raise ValueError('Redirect outside permitted HTTPS host')
                if self.robots and not self.robots.can_fetch(USER_AGENT, current):
                    raise ValueError('robots.txt disallows URL')
                time.sleep(max(0, self.delay - (time.monotonic() - self.last_request)))
                self.last_request = time.monotonic()
                response = self.session.get(current, timeout=(10, 40), allow_redirects=False)
                if response.is_redirect:
                    current = urljoin(current, response.headers['Location'])
                    continue
                break
            else:
                raise ValueError('Too many redirects')
            if response.status_code in (429, 500, 502, 503, 504) and attempt < 2:
                time.sleep(2 ** (attempt + 1))
                continue
            response.raise_for_status()
            if len(response.content) > 12_000_000:
                raise ValueError('Response too large')
            response.encoding = 'utf-8'
            return response
        raise RuntimeError('Fetch failed')


def discover(fetcher, output):
    robots_response = fetcher.get(BASE + 'robots.txt')
    (output / 'robots.txt').write_text(robots_response.text, encoding='utf-8')
    fetcher.robots = RobotFileParser()
    fetcher.robots.parse(robots_response.text.splitlines())
    robot_delay = fetcher.robots.crawl_delay(USER_AGENT)
    fetcher.delay = max(fetcher.delay, robot_delay or 0)
    homepage = fetcher.get(BASE)
    soup = BeautifulSoup(homepage.text, 'html.parser')
    menu_urls = {normalize_url(a['href']) for a in soup.select('a[href]')}
    menu_urls.discard(None)
    sitemap_urls, discovery_errors = set(), []
    for sitemap in ('sitemap_index.xml', 'page-sitemap1.xml', 'page-sitemap2.xml'):
        try:
            response = fetcher.get(BASE + sitemap)
            (output / sitemap).write_text(response.text, encoding='utf-8')
            root = ET.fromstring(response.content)
            sitemap_urls.update(normalize_url(el.text or '') for el in root.findall('.//{*}url/{*}loc'))
        except (requests.RequestException, ValueError, ET.ParseError) as error:
            discovery_errors.append({'url': BASE + sitemap, 'error': str(error)})
    sitemap_urls.discard(None)
    # Sitemap is inventory only; scope stays on official menu services + exact policy seeds.
    candidates = [BASE] + [BASE + s + '/' for s in CORE]
    candidates += sorted(u for u in menu_urls if scope_url(u))
    candidates = list(dict.fromkeys(candidates))
    (output / 'discovery.json').write_text(json.dumps({
        'discovered_at': now(), 'menu_urls': sorted(menu_urls), 'sitemap_urls': sorted(sitemap_urls),
        'selected_urls': candidates, 'errors': discovery_errors,
        'scope': 'Vietnamese public service/menu and exact policy pages; excludes blog archive and customer portals'
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    return candidates


def jsonl(path, rows):
    path.write_text(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in rows), encoding='utf-8')


def csv_safe(value):
    value = str(value)
    return "'" + value if value.lstrip().startswith(('=', '+', '-', '@', '\t', '\r')) else value


def write_exports(pages, output):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='exports-', dir=output) as temporary:
        stage = Path(temporary)
        counts = _write_exports(pages, stage)
        for name in ('sources.jsonl', 'faqs.jsonl', 'chunks.jsonl', 'faqs.csv', 'knowledge.md', 'vinahost.sqlite'):
            os.replace(stage / name, output / name)
    return counts


def _write_exports(pages, output):
    # Validate and stage all files before publishing a new snapshot.
    build_database(pages, output / 'vinahost.sqlite')
    sources = [{k: v for k, v in p.items() if k not in ('faqs', 'chunks')} for p in pages]
    faqs = [dict(f, category=p['category'], title=p['title']) for p in pages for f in p['faqs']]
    chunks = [dict(c, category=p['category'], title=p['title']) for p in pages for c in p['chunks']]
    jsonl(output / 'sources.jsonl', sources)
    jsonl(output / 'faqs.jsonl', faqs)
    jsonl(output / 'chunks.jsonl', chunks)
    with (output / 'faqs.csv').open('w', encoding='utf-8-sig', newline='') as stream:
        fields = ['id', 'category', 'question', 'answer', 'source_url', 'fetched_at', 'extraction_method', 'review_status']
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows({k: csv_safe(row[k]) for k in fields} for row in faqs)
    markdown = ['# VinaHost — nội dung nguồn\n']
    for page in pages:
        markdown.append(f"## {page['title']}\n\nNguồn: {page['url']}\n\nCrawl: {page['fetched_at']}\n\n{page['text']}\n")
    (output / 'knowledge.md').write_text('\n'.join(markdown), encoding='utf-8')
    return {'sources': len(sources), 'faqs': len(faqs), 'chunks': len(chunks),
            'categories': dict(Counter(p['category'] for p in pages))}


def run(output, limit=150, delay=1.0, refresh=False):
    output = Path(output)
    raw, cache = output / 'raw', output / 'pages'
    raw.mkdir(parents=True, exist_ok=True)
    cache.mkdir(parents=True, exist_ok=True)
    fetcher = Fetcher(delay)
    started = now()
    urls = discover(fetcher, output)
    pages, manifest, seen = [], [], set()
    for index, url in enumerate(urls[:limit]):
        print(f'[{index + 1}/{min(limit,len(urls))}] {url}', flush=True)
        cached = cache / (digest(url) + '.json')
        try:
            if cached.exists() and not refresh:
                page = json.loads(cached.read_text(encoding='utf-8'))
                status = 'cached'
            else:
                response = fetcher.get(url)
                final_url = normalize_url(response.url)
                if not final_url or not scope_url(final_url):
                    raise ValueError('Redirect to excluded content')
                if 'text/html' not in response.headers.get('Content-Type', ''):
                    raise ValueError('Non-HTML response')
                stamp = now()
                page = extract_page(response.text, final_url, stamp)
                if len(page['text']) < 80:
                    raise ValueError('Insufficient main content')
                raw_name = digest(final_url) + '.html.gz'
                with gzip.open(raw / raw_name, 'wt', encoding='utf-8') as stream:
                    stream.write(response.text)
                page = dict(page, http_status=response.status_code, requested_url=url,
                            last_modified=response.headers.get('Last-Modified'),
                            raw_path='raw/' + raw_name)
                cached.write_text(json.dumps(page, ensure_ascii=False), encoding='utf-8')
                status = 'ok'
            if page['url'] not in seen:
                pages.append(page)
                seen.add(page['url'])
            manifest.append({'requested_url': url, 'final_url': page['url'], 'status': status,
                             'faq_count': len(page['faqs']), 'chunks': len(page['chunks'])})
        except (requests.RequestException, ValueError, KeyError, OSError) as error:
            manifest.append({'requested_url': url, 'status': 'error', 'error': str(error), 'at': now()})
        jsonl(output / 'crawl-manifest.jsonl', manifest)
    if not pages:
        raise RuntimeError('No pages collected; existing exports preserved')
    counts = write_exports(pages, output)
    report = dict(counts, started_at=started, finished_at=now(), attempted=len(manifest),
                  selected=len(urls), errors=[m for m in manifest if m['status'] == 'error'],
                  faq_review_status='unreviewed — literal source extraction; not manually fact-checked',
                  scope='Menu-linked service pages and policy/support seeds; not a full-domain crawl')
    (output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
    return report


def reextract(output):
    """Rebuild extraction from saved HTML without fetching the website again."""
    output = Path(output)
    report_path = output / 'report.json'
    old_report = json.loads(report_path.read_text(encoding='utf-8')) if report_path.exists() else {}
    pages, refreshed, seen, excluded = [], [], set(), []
    for cached in sorted((output / 'pages').glob('*.json')):
        old = json.loads(cached.read_text(encoding='utf-8'))
        if not scope_url(old['url']):
            excluded.append(old['url'])
            continue
        raw_path = (output / old['raw_path']).resolve()
        if not raw_path.is_relative_to(output.resolve() / 'raw'):
            raise ValueError('Invalid raw snapshot path')
        with gzip.open(raw_path, 'rt', encoding='utf-8') as stream:
            page = extract_page(stream.read(), old['url'], old['fetched_at'])
        metadata = {k: old.get(k) for k in ('raw_path', 'http_status', 'requested_url', 'last_modified')}
        page = dict(page, **metadata)
        refreshed.append((cached, page))
        if page['url'] not in seen:
            pages.append(page)
            seen.add(page['url'])
    if not pages:
        raise ValueError('No raw snapshots to re-extract')
    counts = write_exports(pages, output)
    for cached, page in refreshed:
        cached.write_text(json.dumps(page, ensure_ascii=False), encoding='utf-8')
    report = dict(old_report, **counts, reextracted_at=now(), extractor_version='1.1',
                  excluded_editorial_urls=sorted(set(excluded)))
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='data')
    parser.add_argument('--limit', type=int, default=150)
    parser.add_argument('--delay', type=float, default=1.0)
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--reextract', action='store_true', help='Rebuild from saved HTML, no network')
    args = parser.parse_args()
    if not 1 <= args.limit <= 1000 or args.delay < 0.5:
        parser.error('limit: 1–1000; delay: >=0.5 seconds')
    if args.reextract:
        print(json.dumps(reextract(args.output), ensure_ascii=False, indent=2))
    else:
        run(args.output, args.limit, args.delay, args.refresh)
