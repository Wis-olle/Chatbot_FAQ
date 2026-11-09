"""Import service catalog from saved source HTML; never check domain availability."""
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import re
import unicodedata
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
DATA = ROOT.parent / 'faq' / 'data'
SERVICES = {
    'hosting-gia-re': ('hosting', 'Hosting giá rẻ', ['website giới thiệu', 'blog', 'website nhỏ']),
    'wordpress-hosting': ('hosting', 'WordPress Hosting', ['WordPress', 'WooCommerce', 'cửa hàng trực tuyến']),
    'windows-hosting': ('hosting', 'Windows Hosting', ['ASP.NET', 'ứng dụng Windows']),
    'hosting-doanh-nghiep': ('hosting', 'Hosting doanh nghiệp', ['nhiều website', 'website doanh nghiệp']),
    'thue-vps-gia-re': ('vps', 'VPS SSD', ['tự quản trị máy chủ', 'ứng dụng Linux']),
    'vps-n8n': ('vps', 'VPS n8n', ['n8n', 'tự động hóa workflow']),
    'email-hosting-chuyen-nghiep': ('email', 'Email Hosting', ['email tên miền riêng', 'email doanh nghiệp']),
}
POPULAR = ['.com', '.vn', '.com.vn', '.net', '.org', '.shop', '.store', '.online', '.site',
           '.website', '.fashion', '.boutique', '.biz', '.info', '.io', '.co', '.cloud', '.asia',
           '.io.vn', '.id.vn', '.biz.vn', '.net.vn', '.pro.vn', '.name.vn', '.me', '.app', '.dev']


def clean(value):
    return re.sub(r'\s+', ' ', value).strip()


def folded(value):
    return ''.join(c for c in unicodedata.normalize('NFD', value.lower().replace('đ', 'd')) if unicodedata.category(c) != 'Mn')


def identifier(service, name):
    token = re.sub('[^A-Z0-9]+', '-', folded(name).upper()).strip('-')
    return 'SEN-CATALOG-' + service.upper() + '-' + token


def base_item(service, name, stamp, kind, label):
    item_id = identifier(service, name)
    return {'id': item_id, 'type': kind, 'name': name, 'service': service,
            'serviceLabel': label, 'status': 'active', 'ownerConfirmed': True,
            'reviewMethod': 'owner-requested-crawl-import', 'snapshotAt': stamp,
            'sourceUrl': '/knowledge/' + item_id, 'specs': {},
            'availability': {'checked': False, 'status': 'not_checked'},
            'suitabilityIsGuidance': True}


def price(display, period):
    return {'display': display, 'currency': 'VND', 'billingPeriod': period,
            'conditions': 'Giá theo bản chụp danh mục; chu kỳ đăng ký, ưu đãi và thuế cần đối chiếu trước khi thanh toán.',
            'verifiedCurrent': False}


def extract_domains(soup, stamp):
    found = {}
    for card in soup.select('main .domain-extensions-item'):
        left = card.select_one('.domain-extensions-content-left')
        if not left:
            continue
        name_node, price_node = left.select_one('p'), left.select_one('.item-price')
        name = clean(name_node.get_text(' ', strip=True)) if name_node else ''
        if not re.fullmatch(r'\.[a-z0-9]+(?:\.[a-z0-9]+)*', name):
            continue
        item = base_item('domain', name, stamp, 'domain', 'Tên miền ' + name)
        item.update({'description': 'Đuôi tên miền ' + name + ' trong danh mục Sen Hosting.',
                     'extensions': [name], 'useCases': ['tên miền thương hiệu', 'website doanh nghiệp', 'cửa hàng trực tuyến']})
        if price_node:
            item['price'] = price(clean(price_node.get_text(' ', strip=True)), 'mục đăng ký tên miền; thời hạn cần xác nhận')
            right = card.select('.domain-extensions-content-right span')
            if right:
                item['price']['renewalDisplay'] = clean(right[0].get_text(' ', strip=True))
            if len(right) > 1:
                item['price']['transferDisplay'] = clean(right[1].get_text(' ', strip=True))
        found.setdefault(name, item)
    # Keep a manageable real subset; do not invent popular extensions absent from the snapshot.
    ordered = [found[name] for name in POPULAR if name in found]
    if len(ordered) < 15:
        ordered += [item for name, item in found.items() if name not in POPULAR][:15-len(ordered)]
    return ordered


def extract_plans(soup, service, stamp):
    kind, label, use_cases = SERVICES[service]
    result = []
    for table in soup.select('main table'):
        rows = [[clean(cell.get_text(' ', strip=True)) for cell in tr.select('th,td')]
                for tr in table.select('tr')]
        if not rows or folded(rows[0][0]) != 'goi dich vu':
            continue
        prices = next((row for row in rows[1:] if row and folded(row[0]) == 'gia'), None)
        if not prices or len(prices) != len(rows[0]) or not all(re.search(r'\d.*(?:đ|vnđ|VNĐ)', p, re.I) for p in prices[1:]):
            continue
        for column, name in enumerate(rows[0][1:], 1):
            item = base_item(service, name, stamp, kind, label)
            item.update({'description': label + ' — gói ' + name + '.', 'useCases': use_cases,
                         'price': price(prices[column], 'tháng (đơn giá hiển thị; chu kỳ thanh toán cần xác nhận)')})
            for row in rows[1:]:
                if len(row) != len(rows[0]) or column >= len(row) or not row[column] or folded(row[0]) == 'gia':
                    continue
                # Exclude source-vendor branding, absolute security/SLA and unrelated benefits.
                if re.search(r'vinahost|https?://|an toan tuyet doi|bao mat tuyet doi', folded(row[0] + ' ' + row[column])):
                    continue
                if not re.search(r'cpu|ram|ssd|nvme|dung luong|tai khoan|ten mien|website|bang thong|he dieu hanh|panel|dung luong|email|database|mysql', folded(row[0])):
                    continue
                item['specs'][row[0]] = row[column]
            result.append(item)
    return result


def build_catalog():
    sources = [json.loads(line) for line in (DATA / 'sources.jsonl').read_text(encoding='utf-8').splitlines()]
    items, records = [], []
    for service in ['dang-ky-ten-mien'] + list(SERVICES):
        source = next(source for source in sources if source['url'] == 'https://vinahost.vn/' + service + '/')
        raw = (DATA / source['raw_path']).resolve()
        if not raw.is_relative_to((DATA / 'raw').resolve()):
            raise ValueError('Unsafe raw source path')
        with gzip.open(raw, 'rt', encoding='utf-8') as stream:
            html = stream.read()
        soup = BeautifulSoup(html, 'html.parser')
        extracted = extract_domains(soup, source['fetched_at']) if service == 'dang-ky-ten-mien' else extract_plans(soup, service, source['fetched_at'])
        source_text = clean(soup.select_one('main').get_text(' ', strip=True))
        for item in extracted:
            evidence = [item['name'], *item['specs'].values()]
            if item.get('price'):
                evidence.append(item['price']['display'])
            if not all(value in source_text for value in evidence):
                raise ValueError('Catalog value not found in source: ' + item['id'])
            records.append({'id': item['id'], 'originalUrl': source['url'], 'sourceId': source['id'],
                            'sourceContentHash': source['content_hash'], 'rawPath': source['raw_path'],
                            'snapshotAt': source['fetched_at'], 'literalEvidence': evidence})
            items.append(item)
    stamp = datetime.now(timezone.utc).isoformat()
    catalog = {'version': 1, 'brandName': 'Sen Hosting', 'importedAt': stamp,
               'snapshotAt': max(item['snapshotAt'] for item in items),
               'availability': {'checked': False, 'note': 'Danh mục đuôi tên miền không xác nhận tên miền cụ thể còn trống.'},
               'items': items}
    if len({item['id'] for item in items}) != len(items):
        raise ValueError('Duplicate catalog ID')
    if re.search('vinahost', json.dumps(catalog, ensure_ascii=False), re.I):
        raise ValueError('Foreign brand in public catalog')
    return catalog, {'version': 1, 'importedAt': stamp, 'records': records}


if __name__ == '__main__':
    catalog, provenance = build_catalog()
    (ROOT / 'content' / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (ROOT / 'prepared' / 'catalog-provenance.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'items': len(catalog['items']), 'types': {kind: sum(item['type'] == kind for item in catalog['items']) for kind in ['domain', 'hosting', 'vps', 'email']}}, ensure_ascii=False))
