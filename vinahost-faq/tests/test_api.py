"""Real HTTP contract tests for the read-only local evidence API."""

import json
from pathlib import Path
import tempfile
from threading import Thread
import unittest
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from faqdata.api import create_server
from faqdata.db import build_database
from faqdata.extract import extract_page


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "knowledge.sqlite"
        html = """<html><head><title>Hosting VinaHost</title></head><body><main>
        <h1>Hosting</h1><p>Dịch vụ lưu trữ website.</p>
        <div class="accordion-item"><a class="accordion-title">Có hỗ trợ không?</a>
        <div class="accordion-inner">Hỗ trợ kỹ thuật 24/7 qua ticket.</div></div>
        <div class="accordion-item"><a class="accordion-title">Có SSL không?</a>
        <div class="accordion-inner">Có SSL miễn phí theo điều kiện gói.</div></div>
        </main></body></html>"""
        self.page = extract_page(html, "https://vinahost.vn/hosting-gia-re/",
                                 "2026-11-07T05:00:00+00:00")
        build_database([self.page], self.path)
        self.server = create_server(self.path, port=0)
        self.thread = Thread(target=lambda: self.server.serve_forever(poll_interval=0.01), daemon=True)
        self.thread.start()
        self.addCleanup(self.close_server)
        self.base = "http://127.0.0.1:" + str(self.server.server_address[1])

    def close_server(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def request(self, path, method="GET", body=None):
        request = Request(self.base + path, data=body, method=method)
        try:
            response = urlopen(request, timeout=3)
        except HTTPError as error:
            response = error
        with response:
            raw = response.read().decode("utf-8")
            return response.status, response.headers, json.loads(raw)

    def assert_error(self, path, status=400):
        actual, headers, payload = self.request(path)
        self.assertEqual(actual, status)
        self.assertFalse(payload["success"])
        self.assertIn("error", payload)
        rendered = json.dumps(payload)
        self.assertNotIn(str(self.path), rendered)
        self.assertNotIn("Traceback", rendered)
        self.assertIn("application/json", headers.get("Content-Type", ""))

    def test_server_binds_loopback_only(self):
        self.assertEqual(self.server.server_address[0], "127.0.0.1")

    def test_health_reports_imported_counts(self):
        status, _, payload = self.request("/health")
        self.assertEqual(status, 200)
        self.assertTrue(payload["success"])
        self.assertEqual(payload["data"]["sources"], 1)
        self.assertEqual(payload["data"]["faqs"], 2)
        self.assertEqual(payload["data"]["chunks"], len(self.page["chunks"]))

    def test_search_returns_citable_evidence_without_accents(self):
        status, _, payload = self.request("/api/search?" + urlencode({"q": "ho tro", "limit": 3}))
        self.assertEqual(status, 200)
        self.assertTrue(payload["success"])
        self.assertTrue(payload["meta"]["retrieval_only"])
        self.assertTrue(payload["data"])
        self.assertLessEqual(len(payload["data"]), 3)
        for item in payload["data"]:
            self.assertEqual(item["source_url"], self.page["url"])
            self.assertIn("text", item)

    def test_no_matches_is_successful_empty_result(self):
        status, _, payload = self.request("/api/search?q=xyzzynonexistenttoken")
        self.assertEqual(status, 200)
        self.assertTrue(payload["success"])
        self.assertEqual(payload["data"], [])

    def test_faq_pagination_and_category(self):
        status, _, payload = self.request("/api/faqs?limit=1&offset=1&category=hosting")
        self.assertEqual(status, 200)
        self.assertTrue(payload["success"])
        data = payload["data"]
        self.assertEqual((data["total"], data["limit"], data["offset"]), (2, 1, 1))
        self.assertEqual(len(data["items"]), 1)
        self.assertEqual(data["items"][0]["source_url"], self.page["url"])
        self.assertEqual(data["items"][0]["category"], "hosting")

    def test_category_filter_has_no_cross_category_results(self):
        status, _, payload = self.request("/api/faqs?category=email")
        self.assertEqual(status, 200)
        self.assertEqual(payload["data"]["total"], 0)
        self.assertEqual(payload["data"]["items"], [])

    def test_missing_and_blank_search_are_invalid(self):
        for path in ("/api/search", "/api/search?q=", "/api/search?q=%20%20"):
            with self.subTest(path=path):
                self.assert_error(path)

    def test_search_limit_must_be_bounded_integer(self):
        for value in ("0", "21", "-1", "1.5", "abc"):
            with self.subTest(value=value):
                self.assert_error("/api/search?q=hosting&limit=" + value)

    def test_faq_pagination_is_validated(self):
        for query in ("limit=0", "limit=101", "limit=abc", "offset=-1", "offset=1.5",
                      "offset=100001"):
            with self.subTest(query=query):
                self.assert_error("/api/faqs?" + query)

    def test_malformed_query_encoding_is_rejected(self):
        for query in ("q=%FF", "q=%ZZ"):
            with self.subTest(query=query):
                self.assert_error("/api/search?" + query)

    def test_unknown_path_is_json_404(self):
        self.assert_error("/does-not-exist", status=404)

    def test_post_is_rejected_without_writing(self):
        status, _, payload = self.request("/api/faqs", method="POST", body=b'{"question":"write"}')
        self.assertEqual(status, 405)
        self.assertFalse(payload["success"])
        _, _, health = self.request("/health")
        self.assertEqual(health["data"]["faqs"], 2)

    def test_responses_do_not_allow_wildcard_cors_or_credentials(self):
        _, headers, _ = self.request("/health")
        self.assertNotEqual(headers.get("Access-Control-Allow-Origin"), "*")
        self.assertNotEqual(headers.get("Access-Control-Allow-Credentials", "").lower(), "true")

    def test_rate_limit_covers_every_route(self):
        self.server.rate_limit = 2
        self.assertEqual(self.request("/health")[0], 200)
        self.assertEqual(self.request("/does-not-exist")[0], 404)
        status, _, payload = self.request("/api/search?q=hosting")
        self.assertEqual(status, 429)
        self.assertFalse(payload["success"])


if __name__ == "__main__":
    unittest.main()
