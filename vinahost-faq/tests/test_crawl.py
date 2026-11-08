"""Contract tests for FAQ-focused crawl scope and reusable data exports."""

import csv
import gzip
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

from faqdata.crawl import scope_url, write_exports
from faqdata.extract import extract_page


STAMP = "2026-11-07T05:00:00+00:00"
URL = "https://vinahost.vn/hosting-gia-re/"


def page(url=URL, question="Hosting có hỗ trợ SSL không?", answer="Có hỗ trợ SSL miễn phí theo gói."):
    html = f'''<html lang="vi"><head><title>Hosting VinaHost</title></head>
        <body><main><h1>Hosting giá rẻ</h1><p>Dịch vụ lưu trữ website.</p>
        <div class="faq_item"><div class="item_title">{question}</div>
        <div class="item_content"><p>{answer}</p></div></div>
        </main></body></html>'''
    return extract_page(html, url, STAMP)


def jsonl(path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


class CrawlScopeTests(unittest.TestCase):
    def test_service_policy_and_support_routes_are_in_scope(self):
        for route in ("/", "/hosting-gia-re/", "/vps-gia-re/", "/dang-ky-ten-mien/",
                      "/email-hosting/", "/ssl-gia-re/", "/cloud-server/", "/cloud-backup/",
                      "/object-storage/", "/lien-he/", "/thanh-toan/", "/gioi-thieu/",
                      "/chinh-sach-hoan-tien/", "/chinh-sach-bao-mat/"):
            with self.subTest(route=route):
                self.assertTrue(scope_url("https://vinahost.vn" + route))

    def test_generic_editorial_and_account_routes_are_out_of_scope(self):
        for route in ("/blog/", "/khuyen-mai/", "/tuyen-dung/", "/category/hosting/",
                      "/hosting-la-gi/", "/cach-cai-dat-wordpress/", "/wp-admin/",
                      "/en/hosting/", "/zh/vps/", "/?s=hosting", "/feed/"):
            with self.subTest(route=route):
                self.assertFalse(scope_url("https://vinahost.vn" + route))

    def test_scope_never_accepts_other_hosts_or_url_credentials(self):
        for url in ("https://evil.example/hosting-gia-re/", "https://vinahost.vn.evil.example/vps/",
                    "https://secure.vinahost.vn/", "http://localhost/hosting/",
                    "http://127.0.0.1/vps/", "https://user:pass@vinahost.vn/hosting-gia-re/",
                    "javascript:alert(1)", "mailto:info@vinahost.vn"):
            with self.subTest(url=url):
                self.assertFalse(scope_url(url))


class ExportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.output = Path(self.temp.name) / "snapshot"

    def test_exports_exist_and_preserve_unicode_and_source_links(self):
        source = page()
        write_exports([source], self.output)
        for name in ("sources.jsonl", "faqs.jsonl", "chunks.jsonl", "faqs.csv", "knowledge.md", "vinahost.sqlite"):
            with self.subTest(name=name):
                self.assertTrue((self.output / name).is_file())
                self.assertGreater((self.output / name).stat().st_size, 0)
        sources = jsonl(self.output / "sources.jsonl")
        faqs = jsonl(self.output / "faqs.jsonl")
        chunks = jsonl(self.output / "chunks.jsonl")
        self.assertEqual(len(sources), 1)
        self.assertEqual(sources[0]["url"], URL)
        self.assertEqual(sources[0]["fetched_at"], STAMP)
        self.assertEqual(faqs[0]["question"], "Hosting có hỗ trợ SSL không?")
        self.assertEqual(faqs[0]["answer"], "Có hỗ trợ SSL miễn phí theo gói.")
        self.assertTrue(chunks)
        for record in faqs + chunks:
            self.assertEqual(record["source_id"], sources[0]["id"])
            self.assertEqual(record["source_url"], URL)
        with (self.output / "faqs.csv").open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))
        self.assertEqual(rows[0]["question"], faqs[0]["question"])
        self.assertEqual(rows[0]["answer"], faqs[0]["answer"])
        self.assertEqual(rows[0]["source_url"], URL)
        markdown = (self.output / "knowledge.md").read_text(encoding="utf-8")
        self.assertIn(URL, markdown)
        self.assertIn("Hosting", markdown)
        with sqlite3.connect(self.output / "vinahost.sqlite") as connection:
            self.assertEqual(connection.execute("PRAGMA foreign_key_check").fetchall(), [])
            linked = connection.execute("SELECT f.question, f.answer, s.url FROM faqs f JOIN sources s ON s.id=f.source_id").fetchall()
        self.assertEqual(linked, [(faqs[0]["question"], faqs[0]["answer"], URL)])

    def test_csv_formula_defense_keeps_json_literal(self):
        for prefix in ("=", "+", "-", "@"):
            with self.subTest(prefix=prefix):
                question, answer = prefix + "Câu hỏi", prefix + "Nội dung trả lời"
                write_exports([page(question=question, answer=answer)], self.output)
                with (self.output / "faqs.csv").open(encoding="utf-8-sig", newline="") as handle:
                    row = next(csv.DictReader(handle))
                self.assertEqual(row["question"], "'" + question)
                self.assertEqual(row["answer"], "'" + answer)
                raw = jsonl(self.output / "faqs.jsonl")[0]
                self.assertEqual(raw["question"], question)
                self.assertEqual(raw["answer"], answer)

    def test_reimport_replaces_snapshot_without_duplicates_or_stale_records(self):
        first = page()
        other = page("https://vinahost.vn/email-hosting/", "Email có hỗ trợ không?", "Có hỗ trợ email.")
        write_exports([first, other], self.output)
        updated = page(answer="Thông tin SSL đã cập nhật.")
        write_exports([updated], self.output)
        write_exports([updated], self.output)
        self.assertEqual(len(jsonl(self.output / "sources.jsonl")), 1)
        self.assertEqual(len(jsonl(self.output / "faqs.jsonl")), 1)
        with sqlite3.connect(self.output / "vinahost.sqlite") as connection:
            self.assertEqual(connection.execute("SELECT count(*) FROM sources").fetchone()[0], 1)
            self.assertEqual(connection.execute("SELECT count(*) FROM faqs").fetchone()[0], 1)
            self.assertEqual(connection.execute("SELECT answer FROM faqs").fetchone()[0], "Thông tin SSL đã cập nhật.")
            self.assertEqual(connection.execute("SELECT count(*) FROM chunks").fetchone()[0], len(updated["chunks"]))
        self.assertNotIn(other["url"], (self.output / "knowledge.md").read_text(encoding="utf-8"))

    def test_invalid_export_preserves_all_existing_exports_byte_for_byte(self):
        valid = page()
        write_exports([valid], self.output)
        names = ("sources.jsonl", "faqs.jsonl", "chunks.jsonl", "faqs.csv", "knowledge.md", "vinahost.sqlite")
        original = {name: (self.output / name).read_bytes() for name in names}
        corrupted = {key: value for key, value in valid.items() if key != "title"}
        with self.assertRaises((ValueError, KeyError)):
            write_exports([corrupted], self.output)
        for name in names:
            with self.subTest(name=name):
                self.assertEqual((self.output / name).read_bytes(), original[name])

    def test_reextract_rebuilds_from_gzip_and_preserves_crawl_report(self):
        from faqdata.crawl import reextract

        raw = self.output / "raw"
        cache = self.output / "pages"
        raw.mkdir(parents=True)
        cache.mkdir()
        html = '''<html lang="vi"><head><title>Hosting VinaHost</title></head><body>
            <main><h1>Hosting đã kiểm tra</h1><p>Nội dung dịch vụ chính xác.</p>
            <div class="faq_item"><div class="item_title">Có hỗ trợ kỹ thuật không?</div>
            <div class="item_content"><p>Hỗ trợ kỹ thuật 24/7.</p></div></div></main>
            </body></html>'''
        with gzip.open(raw / "a.html.gz", "wt", encoding="utf-8") as stream:
            stream.write(html)
        old = dict(page(), text="Thông tin popup sai", extractor_version="1.0",
                   raw_path="raw/a.html.gz", http_status=200, requested_url=URL,
                   last_modified="Thu, 05 Nov 2026 03:00:00 GMT")
        cached_path = cache / "a.json"
        cached_path.write_text(json.dumps(old, ensure_ascii=False), encoding="utf-8")
        old_report = {"attempted": 3, "errors": [{"requested_url": "https://vinahost.vn/ho-tro/", "status": "error"}],
                      "started_at": STAMP, "sources": 1, "faqs": 99, "chunks": 99}
        report_path = self.output / "report.json"
        report_path.write_text(json.dumps(old_report, ensure_ascii=False), encoding="utf-8")

        report = reextract(self.output)

        expected = extract_page(html, URL, STAMP)
        self.assertEqual(report["sources"], 1)
        self.assertEqual(report["faqs"], len(expected["faqs"]))
        self.assertEqual(report["chunks"], len(expected["chunks"]))
        self.assertEqual(report["attempted"], old_report["attempted"])
        self.assertEqual(report["errors"], old_report["errors"])
        self.assertTrue(report["reextracted_at"])
        self.assertEqual(report["extractor_version"], "1.1")
        self.assertEqual(json.loads(report_path.read_text(encoding="utf-8")), report)
        refreshed = json.loads(cached_path.read_text(encoding="utf-8"))
        for key in ("url", "fetched_at", "raw_path", "http_status", "requested_url", "last_modified"):
            self.assertEqual(refreshed[key], old[key])
        self.assertEqual(refreshed["extractor_version"], "1.1")
        self.assertEqual(refreshed["text"], expected["text"])
        sources = jsonl(self.output / "sources.jsonl")
        self.assertEqual(sources[0]["text"], expected["text"])
        self.assertNotIn("Thông tin popup sai", (self.output / "knowledge.md").read_text(encoding="utf-8"))
        with sqlite3.connect(self.output / "vinahost.sqlite") as connection:
            self.assertEqual(connection.execute("SELECT text FROM sources").fetchone()[0], expected["text"])


if __name__ == "__main__":
    unittest.main()
