"""Behavioral tests for the VinaHost extraction and retrieval bundle."""

import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

from faqdata.extract import extract_page
from faqdata.urls import normalize_url
from faqdata.db import build_database, search_database


STAMP = "2026-11-07T05:00:00+00:00"
URL = "https://vinahost.vn/hosting-gia-re/"


def markup(question="Có hỗ trợ kỹ thuật không?", answer="Hỗ trợ kỹ thuật 24/7 qua ticket."):
    return f"""<!doctype html><html lang="vi"><head>
      <title>Hosting giá rẻ - VinaHost</title></head><body>
      <nav>Menu tuyệt đối không lấy</nav><main id="content">
      <h1>Hosting giá rẻ</h1><p>Dịch vụ lưu trữ website doanh nghiệp.</p>
      <div class="accordion-item"><a class="accordion-title"><span>{question}</span></a>
      <div class="accordion-inner"><p>{answer}</p></div></div>
      </main><footer>Footer tuyệt đối không lấy</footer>
      <script>SECRET_SCRIPT_SHOULD_NOT_APPEAR</script></body></html>"""


class UrlTests(unittest.TestCase):
    def test_relative_url_is_canonical_https(self):
        self.assertEqual(normalize_url("/hosting-gia-re/#faq"), URL)

    def test_rejects_offsite_and_private_hosts(self):
        for value in ("https://evil.example/", "http://127.0.0.1/", "http://localhost/",
                      "https://vinahost.vn.evil.example/", "https://user@vinahost.vn/"):
            with self.subTest(value=value):
                self.assertIsNone(normalize_url(value))

    def test_excludes_noncontent_routes(self):
        for value in ("/?s=hosting", "/wp-admin/", "/wp-login.php", "/feed/",
                      "/wp-content/uploads/logo.png", "/en/hosting/", "/zh/hosting/",
                      "javascript:alert(1)", "mailto:info@vinahost.vn"):
            with self.subTest(value=value):
                self.assertIsNone(normalize_url(value))


class ExtractionTests(unittest.TestCase):
    def test_main_article_content_beats_unrelated_popup_entry_content(self):
        html = '''<html><title>Quy định sử dụng</title><body>
        <aside><div class="entry-content"><p>POPUP_MENU_UNRELATED</p></div></aside>
        <main><article><div class="entry-content"><h1>Quy định sử dụng dịch vụ</h1>
        <p>Khách hàng có trách nhiệm bảo quản thông tin đăng nhập dịch vụ.</p>
        <p>Yêu cầu hỗ trợ cần gửi qua kênh chính thức được công bố.</p>
        </div></article></main></body></html>'''
        page = extract_page(html, "https://vinahost.vn/quy-dinh-su-dung-dich-vu/", STAMP)
        self.assertIn("bảo quản thông tin đăng nhập", page["text"])
        self.assertNotIn("POPUP_MENU_UNRELATED", page["text"])
        self.assertEqual(page["title"], "Quy định sử dụng dịch vụ")

    def test_service_main_faq_beats_unrelated_popup_entry_content(self):
        html = markup().replace('<main id="content">',
            '<aside><div class="entry-content">POPUP_MENU_UNRELATED</div></aside><main id="content">')
        page = extract_page(html, URL, STAMP)
        self.assertIn("Hỗ trợ kỹ thuật", page["text"])
        self.assertEqual(len(page["faqs"]), 1)
        self.assertNotIn("POPUP_MENU_UNRELATED", page["text"])

    def test_malformed_jsonld_does_not_hide_visible_faq(self):
        html = markup().replace('</head>', '<script type="application/ld+json">{broken json</script></head>')
        self.assertEqual(len(extract_page(html, URL, STAMP)["faqs"]), 1)

    def test_empty_or_missing_main_is_invalid(self):
        for html in ('<html><body><nav>Menu only</nav></body></html>',
                     '<html><main>  <script>ignore()</script></main></html>'):
            with self.subTest(html=html):
                with self.assertRaises(ValueError):
                    extract_page(html, URL, STAMP)

    def test_tables_preserve_column_headers_and_cell_boundaries(self):
        html = '<main><h1>Gói Hosting</h1><table><tr><th>Gói</th><th>Dung lượng</th></tr><tr><td>Starter</td><td>5 GB</td></tr></table></main>'
        page = extract_page(html, URL, STAMP)
        chunks = '\n'.join(c["text"] for c in page["chunks"])
        self.assertIn("Gói | Dung lượng", chunks)
        self.assertIn("Starter | 5 GB", chunks)

    def test_main_content_omits_site_chrome_and_scripts(self):
        page = extract_page(markup(), URL, STAMP)
        self.assertIn("Dịch vụ lưu trữ", page["text"])
        for unwanted in ("Menu tuyệt đối", "Footer tuyệt đối", "SECRET_SCRIPT"):
            self.assertNotIn(unwanted, page["text"])
        self.assertEqual(page["url"], URL)
        self.assertEqual(page["fetched_at"], STAMP)
        self.assertTrue(page["title"])
        self.assertTrue(page["category"])

    def test_accordion_question_and_answer_have_provenance(self):
        faq = extract_page(markup(), URL, STAMP)["faqs"][0]
        self.assertEqual(faq["question"], "Có hỗ trợ kỹ thuật không?")
        self.assertEqual(faq["answer"], "Hỗ trợ kỹ thuật 24/7 qua ticket.")
        self.assertEqual(faq["source_url"], URL)
        self.assertTrue(faq["id"])
        self.assertTrue(faq["extraction_method"])
        self.assertTrue(faq["review_status"])

    def test_jsonld_faqpage_graph_and_html_answer(self):
        schema = {"@context": "https://schema.org", "@graph": [
            {"@type": "WebPage", "name": "Hosting"},
            {"@type": "FAQPage", "mainEntity": [{"@type": "Question",
              "name": "SSL có miễn phí không?", "acceptedAnswer": {"@type": "Answer",
              "text": "<p>Có <strong>SSL miễn phí</strong> cho gói được áp dụng.</p>"}}]}]}
        html = '<html><title>Hosting</title><main><h1>Hosting</h1><p>Thông tin gói.</p></main>'
        html += '<script type="application/ld+json">' + json.dumps(schema, ensure_ascii=False) + '</script></html>'
        faqs = extract_page(html, URL, STAMP)["faqs"]
        self.assertEqual(len(faqs), 1)
        self.assertEqual(faqs[0]["question"], "SSL có miễn phí không?")
        self.assertIn("SSL miễn phí", faqs[0]["answer"])
        self.assertNotIn("<strong>", faqs[0]["answer"])

    def test_duplicate_faq_markup_is_deduplicated(self):
        html = markup()
        duplicate = '<div class="accordion-item"><a class="accordion-title">Có hỗ trợ kỹ thuật không?</a><div class="accordion-inner">Hỗ trợ kỹ thuật 24/7 qua ticket.</div></div>'
        html = html.replace("</main>", duplicate + "</main>")
        self.assertEqual(len(extract_page(html, URL, STAMP)["faqs"]), 1)

    def test_empty_accordion_answer_is_not_faq(self):
        self.assertEqual(extract_page(markup(answer="   "), URL, STAMP)["faqs"], [])

    def test_ids_and_hash_do_not_change_with_crawl_timestamp(self):
        first = extract_page(markup(), URL, STAMP)
        second = extract_page(markup(), URL, "2026-11-08T05:00:00+00:00")
        for field in ("id", "content_hash"):
            self.assertEqual(first[field], second[field])
        self.assertEqual(first["faqs"][0]["id"], second["faqs"][0]["id"])
        self.assertEqual(first["chunks"][0]["id"], second["chunks"][0]["id"])

    def test_changed_body_changes_hash_and_chunks_have_sources(self):
        first = extract_page(markup(), URL, STAMP)
        second = extract_page(markup(answer="Chỉ hỗ trợ trong giờ hành chính."), URL, STAMP)
        self.assertNotEqual(first["content_hash"], second["content_hash"])
        self.assertTrue(first["chunks"])
        for chunk in first["chunks"]:
            self.assertTrue(chunk["id"])
            self.assertTrue(chunk["text"].strip())
            self.assertEqual(chunk["source_url"], URL)
            self.assertIsInstance(chunk["position"], int)
            self.assertIn("heading", chunk)


class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "faq.sqlite"
        self.pages = [extract_page(markup(), URL, STAMP)]

    def counts(self):
        with sqlite3.connect(self.path) as connection:
            return tuple(connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                         for table in ("sources", "faqs", "chunks"))

    def test_database_contains_linked_data(self):
        build_database(self.pages, self.path)
        self.assertEqual(self.counts(), (1, 1, len(self.pages[0]["chunks"])))
        with sqlite3.connect(self.path) as connection:
            self.assertEqual(connection.execute("PRAGMA foreign_key_check").fetchall(), [])

    def test_reimport_is_idempotent(self):
        build_database(self.pages, self.path)
        original = self.counts()
        build_database(self.pages, self.path)
        self.assertEqual(self.counts(), original)

    def test_invalid_import_preserves_existing_database(self):
        build_database(self.pages, self.path)
        original = self.counts()
        with self.assertRaises((ValueError, KeyError)):
            build_database([{"id": "broken"}], self.path)
        self.assertEqual(self.counts(), original)
        self.assertTrue(search_database(self.path, "hỗ trợ"))

    def test_vietnamese_search_without_diacritics(self):
        build_database(self.pages, self.path)
        results = search_database(self.path, "ho tro", limit=3)
        self.assertTrue(results)
        self.assertLessEqual(len(results), 3)
        for result in results:
            self.assertEqual(result["source_url"], URL)
            self.assertTrue(result["title"])
            self.assertTrue(result["text"])
            self.assertIn(result["kind"], ("faq", "chunk"))

    def test_unknown_query_returns_no_evidence(self):
        build_database(self.pages, self.path)
        self.assertEqual(search_database(self.path, "xyzzynonexistenttoken"), [])

    def test_search_punctuation_and_sql_are_data(self):
        build_database(self.pages, self.path)
        search_database(self.path, '\" OR 1=1; DROP TABLE sources; --')
        self.assertEqual(self.counts()[0], 1)
        self.assertTrue(search_database(self.path, "hỗ trợ?"))

    def test_empty_search_query_is_invalid(self):
        build_database(self.pages, self.path)
        with self.assertRaises(ValueError):
            search_database(self.path, "  ")


if __name__ == "__main__":
    unittest.main()
