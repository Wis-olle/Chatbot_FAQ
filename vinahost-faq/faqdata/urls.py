"""Constrain discovery and redirects to public Vietnamese content."""
import posixpath
import re
from urllib.parse import unquote, urljoin, urlsplit, urlunsplit

BASE = 'https://vinahost.vn/'
EXCLUDED = re.compile(r'^/(?:wp-admin|wp-login\.php|wp-json|wp-content|wp-includes|en|zh|zh-hans|cart|checkout|my-account|search|tim-kiem|feed)(?:/|$)|/feed/', re.I)


def normalize_url(url, base=BASE):
    try:
        parsed = urlsplit(urljoin(base, url.strip()))
        if (parsed.scheme not in ('https', 'http') or parsed.hostname not in ('vinahost.vn', 'www.vinahost.vn')
                or parsed.username or parsed.password or parsed.port not in (None, 80, 443) or parsed.query):
            return None
        path = posixpath.normpath(unquote(parsed.path or '/'))
        if EXCLUDED.search(path) or re.search(r'\.[a-z0-9]{1,7}$', path, re.I) or '\\' in path:
            return None
        path = '/' + path.strip('/') + '/' if path != '/' else '/'
        return urlunsplit(('https', 'vinahost.vn', path, '', ''))
    except (ValueError, AttributeError, TypeError):
        return None
