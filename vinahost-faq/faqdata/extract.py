"""Extract literal source FAQ pairs and heading-aware knowledge chunks."""
import hashlib
import json
import re
import unicodedata
from bs4 import BeautifulSoup


def digest(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def clean(value):
    return re.sub(r'\s+', ' ', value).strip()


def fold(value):
    return ''.join(c for c in unicodedata.normalize('NFD', value.lower().replace('đ', 'd'))
                   if unicodedata.category(c) != 'Mn')


def plain(value):
    return clean(BeautifulSoup(str(value), 'html.parser').get_text(' ', strip=True))


def category(url):
    groups = [('policy', ('chinh-sach', 'quy-dinh', 'thoa-thuan', 'privacy', 'phap-ly', 'trach-nhiem')),
              ('support', ('lien-he', 'ho-tro', 'thanh-toan', 'bieu-mau', 'gioi-thieu')),
              ('domain', ('ten-mien', 'dns', 'whois', 'registry')),
              ('email', ('email', 'workspace', 'microsoft')),
              ('ssl-security', ('ssl', 'waf', 'waap', 'cdn')),
              ('hosting', ('hosting', 'freehost')),
              ('vps', ('vps', 'may-chu-ao')),
              ('cloud-server', ('cloud', 'server', 'may-chu', 'backup', 'sao-luu', 'storage', 'veeam'))]
    return next((name for name, keys in groups if any(k in url.lower() for k in keys)), 'company')


def walk_json(value):
    if isinstance(value, list):
        for item in value:
            yield from walk_json(item)
    elif isinstance(value, dict):
        yield value
        for item in value.values():
            yield from walk_json(item)


def extract_faqs(soup, root, url, fetched_at):
    candidates = []
    # Visible Q&A has priority if JSON-LD disagrees with rendered source content.
    for node in root.select('.faq_item, .accordion-item, .rank-math-list-item'):
        q = node.select_one('.item_title, .accordion-title, .rank-math-question')
        a = node.select_one('.item_content, .accordion-inner, .rank-math-answer')
        if q and a:
            candidates.append((q.get_text(' ', strip=True), a.get_text(' ', strip=True), 'html-faq'))
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            data = json.loads(script.string or script.get_text())
        except (ValueError, TypeError):
            continue
        for node in walk_json(data):
            kind = node.get('@type', [])
            if 'FAQPage' not in (kind if isinstance(kind, list) else [kind]):
                continue
            entities = node.get('mainEntity', [])
            for q in entities if isinstance(entities, list) else [entities]:
                if not isinstance(q, dict):
                    continue
                answers = q.get('acceptedAnswer', [])
                for a in answers if isinstance(answers, list) else [answers]:
                    if isinstance(a, dict):
                        candidates.append((plain(q.get('name', '')), plain(a.get('text', '')), 'jsonld-faqpage'))
    result, seen = [], set()
    for question, answer, method in candidates:
        question, answer = clean(question), clean(answer)
        key = fold(re.sub(r'^\d+[.)]\s*', '', question))
        if not question or not answer or key in seen:
            continue
        seen.add(key)
        result.append({'id': digest(url + '\n' + key), 'source_id': digest(url), 'source_url': url,
                       'question': question, 'answer': answer, 'extraction_method': method,
                       'review_status': 'unreviewed', 'fetched_at': fetched_at,
                       'content_hash': digest(question + '\n' + answer)})
    return result


def chunk_blocks(root, url, title, fetched_at, max_chars=1600):
    result, buffer, heading = [], [], title

    def emit(parts, label):
        text = '\n'.join(parts).strip()
        if text:
            position = len(result)
            result.append({'id': digest(f'{url}\n{position}\n{text}'), 'source_id': digest(url),
                           'source_url': url, 'position': position, 'heading': label, 'text': text,
                           'fetched_at': fetched_at, 'content_hash': digest(text)})

    for node in root.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'tr', 'div']):
        if node.find_parent(['p', 'li', 'tr']) is not None:
            continue
        if node.name == 'div' and (node.find(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'tr', 'div']) is not None):
            continue
        text = (' | '.join(clean(c.get_text(' ', strip=True)) for c in node.select('th, td'))
                if node.name == 'tr' else clean(node.get_text(' ', strip=True)))
        if not text:
            continue
        if node.name == 'tr':
            emit(buffer, heading)
            buffer = []
            table = node.find_parent('table')
            if table is None:
                emit([text], heading)
                continue
            first = table.find('tr')
            headers = [clean(c.get_text(' ', strip=True)) for c in first.select('th,td')]
            has_headers = bool(first.select('th') or first.find_parent('thead'))
            cells = [clean(c.get_text(' ', strip=True)) for c in node.select('th,td')]
            # Repeat source column labels and row labels in each independent table chunk.
            if has_headers and node is not first:
                row_label = cells[0] if cells else ''
                for i, cell in enumerate(cells[1:], 1):
                    label = headers[i] if i < len(headers) else ''
                    emit([' | '.join(p for p in (row_label, cell, label) if p)], heading)
            else:
                emit([text], heading)
            continue
        if re.fullmatch(r'h[1-6]', node.name):
            emit(buffer, heading)
            buffer, heading = [], text
            continue
        # Oversized blocks split at word boundaries without discarding source text.
        words, pieces, part = text.split(), [], ''
        for word in words:
            if len(part) + len(word) + 1 > max_chars and part:
                pieces.append(part)
                part = ''
            part = (part + ' ' + word).strip()
        pieces += [part] if part else []
        for piece in pieces:
            if sum(len(p) + 1 for p in buffer) + len(piece) > max_chars:
                emit(buffer, heading)
                buffer = []
            buffer.append(piece)
    emit(buffer, heading)
    if not result and root.get_text(strip=True):
        emit([clean(root.get_text(' ', strip=True))], title)
    return result


def extract_page(html, url, fetched_at):
    soup = BeautifulSoup(html, 'html.parser')
    root = soup.select_one('main') or soup.select_one('#content') or soup.select_one('article')
    if root is None:
        raise ValueError('No main content container')
    root = root.select_one('article .entry-content, .entry-content.single-page') or root
    h1 = soup.find('h1')
    title = clean(h1.get_text(' ', strip=True) if h1 else soup.title.get_text() if soup.title else url)
    faqs = extract_faqs(soup, root, url, fetched_at)
    for node in root.select('script,style,noscript,nav,footer,header,form,svg,.related_post,.social-share,.kk-star-ratings,.breadcrumb,.breadcrumbs,.entry-meta,.post-sidebar,.sidebar,.show_more_faqs'):
        node.decompose()
    text = root.get_text('\n', strip=True)
    if not text.strip():
        raise ValueError('Empty main content')
    return {'id': digest(url), 'url': url, 'title': title, 'category': category(url), 'language': 'vi',
            'text': text, 'content_hash': digest(text), 'fetched_at': fetched_at,
            'extractor_version': '1.1', 'faqs': faqs,
            'chunks': chunk_blocks(root, url, title, fetched_at)}
