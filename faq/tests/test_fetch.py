"""Network-free tests of polite fetching, discovery, and crawl orchestration."""

import gzip
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
from urllib.robotparser import RobotFileParser

import requests

from faqdata import crawl
from faqdata.extract import digest, extract_page


BASE = "https://vinahost.vn/"
URL = BASE + "hosting-gia-re/"
STAMP = "2026-11-07T05:00:00+00:00"
HTML = '''<html><head><title>Hosting</title></head><body><main><h1>Hosting giá rẻ</h1>
<p>Dịch vụ lưu trữ website doanh nghiệp, thông tin hỗ trợ và các điều kiện sử dụng dịch vụ.</p>
<div class="faq_item"><div class="item_title">Có hỗ trợ SSL không?</div>
<div class="item_content">Có hỗ trợ SSL miễn phí theo điều kiện của từng gói dịch vụ.</div></div>
</main></body></html>'''


def response(url=URL, text=HTML, status=200, headers=None):
    result = requests.Response()
    result.url = url
    result.status_code = status
    result._content = text.encode("utf-8")
    result.encoding = "utf-8"
    result.headers.update(headers or {"Content-Type": "text/html; charset=utf-8"})
    return result


def read_jsonl(path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]


class FetcherTests(unittest.TestCase):
    def setUp(self):
        self.session = Mock()
        self.session.headers = {}
        self.session_patch = patch.object(crawl.requests, "Session", return_value=self.session)
        self.session_patch.start()
        self.addCleanup(self.session_patch.stop)
        self.sleep_patch = patch.object(crawl.time, "sleep")
        self.sleep = self.sleep_patch.start()
        self.addCleanup(self.sleep_patch.stop)
        self.fetcher = crawl.Fetcher(delay=1)

    def test_success_sets_user_agent_and_utf8_and_disables_auto_redirect(self):
        expected = response()
        self.session.get.return_value = expected
        self.assertIs(self.fetcher.get(URL), expected)
        self.assertIn("VinaHostFAQDataset", self.session.headers["User-Agent"])
        self.assertEqual(expected.encoding, "utf-8")
        self.session.get.assert_called_once_with(URL, timeout=(10, 40), allow_redirects=False)
        self.sleep.assert_called()

    def test_robots_disallow_prevents_network_request(self):
        self.fetcher.robots = RobotFileParser()
        self.fetcher.robots.parse(["User-agent: *", "Disallow: /private/"])
        with self.assertRaisesRegex(ValueError, "robots"):
            self.fetcher.get(BASE + "private/")
        self.session.get.assert_not_called()

    def test_unsafe_initial_target_prevents_network_request(self):
        for url in ("http://vinahost.vn/", "https://evil.example/", BASE + "?s=foo",
                    "https://user:password@vinahost.vn/", "https://127.0.0.1/"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                self.fetcher.get(url)
        self.session.get.assert_not_called()

    def test_relative_redirect_is_followed_explicitly(self):
        final = response(BASE + "hosting-cao-cap/")
        self.session.get.side_effect = [response(status=301, headers={"Location": "/hosting-cao-cap/"}), final]
        self.assertIs(self.fetcher.get(URL), final)
        self.assertEqual(self.session.get.call_args_list[1].args[0], final.url)

    def test_external_redirect_is_blocked_before_follow(self):
        self.session.get.return_value = response(status=302, headers={"Location": "https://evil.example/"})
        with self.assertRaises(ValueError):
            self.fetcher.get(URL)
        self.assertEqual(self.session.get.call_count, 1)

    def test_redirect_checks_target_robots_permission(self):
        self.fetcher.robots = RobotFileParser()
        self.fetcher.robots.parse(["User-agent: *", "Disallow: /private/"])
        self.session.get.return_value = response(status=302, headers={"Location": "/private/"})
        with self.assertRaisesRegex(ValueError, "robots"):
            self.fetcher.get(URL)
        self.assertEqual(self.session.get.call_count, 1)

    def test_too_many_redirects_is_bounded(self):
        self.session.get.return_value = response(status=301, headers={"Location": URL})
        with self.assertRaisesRegex(ValueError, "Too many redirects"):
            self.fetcher.get(URL)
        self.assertEqual(self.session.get.call_count, 6)

    def test_429_retries_with_backoff_then_succeeds(self):
        final = response()
        self.session.get.side_effect = [response(status=429), final]
        self.assertIs(self.fetcher.get(URL), final)
        self.assertEqual(self.session.get.call_count, 2)
        self.assertIn(2, [call.args[0] for call in self.sleep.call_args_list])

    def test_repeated_server_errors_stop_after_three_attempts(self):
        self.session.get.return_value = response(status=503)
        with self.assertRaises(requests.HTTPError):
            self.fetcher.get(URL)
        self.assertEqual(self.session.get.call_count, 3)
        delays = [call.args[0] for call in self.sleep.call_args_list]
        self.assertIn(2, delays)
        self.assertIn(4, delays)

    def test_client_http_error_is_not_retried(self):
        self.session.get.return_value = response(status=404)
        with self.assertRaises(requests.HTTPError):
            self.fetcher.get(URL)
        self.assertEqual(self.session.get.call_count, 1)

    def test_network_timeout_is_propagated(self):
        self.session.get.side_effect = requests.Timeout("fixture timeout")
        with self.assertRaises(requests.Timeout):
            self.fetcher.get(URL)

    def test_response_size_is_bounded(self):
        self.session.get.return_value = response(text="x" * 12_000_001)
        with self.assertRaisesRegex(ValueError, "too large"):
            self.fetcher.get(URL)


class DiscoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.output = Path(self.temp.name)
        self.fetcher = Mock(delay=1, robots=None)

    def test_discovery_records_inventory_respects_delay_and_scopes_menu(self):
        robots = "User-agent: *\nDisallow: /private/\nCrawl-delay: 3\n"
        home = '<a href="/hosting-gia-re/">Hosting</a><a href="/email-hosting/">Email</a>'
        home += '<a href="/blog/">Blog</a><a href="https://evil.example/hosting/">Other</a>'
        xml = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://vinahost.vn/cloud-backup/</loc></url><url><loc>https://evil.example/</loc></url></urlset>'

        def get(url):
            if url.endswith("robots.txt"):
                return response(url, robots)
            if url == BASE:
                return response(url, home)
            return response(url, xml)

        self.fetcher.get.side_effect = get
        urls = crawl.discover(self.fetcher, self.output)
        self.assertEqual(self.fetcher.delay, 3)
        self.assertFalse(self.fetcher.robots.can_fetch(crawl.USER_AGENT, BASE + "private/"))
        self.assertIn(BASE + "email-hosting/", urls)
        self.assertNotIn(BASE + "blog/", urls)
        self.assertEqual(len(urls), len(set(urls)))
        inventory = json.loads((self.output / "discovery.json").read_text(encoding="utf-8"))
        self.assertIn(BASE + "cloud-backup/", inventory["sitemap_urls"])
        self.assertNotIn("https://evil.example/", inventory["sitemap_urls"])
        self.assertEqual(inventory["selected_urls"], urls)
        self.assertEqual(inventory["errors"], [])
        self.assertEqual((self.output / "robots.txt").read_text(encoding="utf-8"), robots)

    def test_sitemap_parse_and_network_errors_are_reported_without_losing_seeds(self):
        def get(url):
            if url.endswith("robots.txt"):
                return response(url, "User-agent: *\nDisallow:\n")
            if url == BASE:
                return response(url, "<main>Home</main>")
            if url.endswith("page-sitemap2.xml"):
                raise requests.Timeout("sitemap timeout")
            return response(url, "not XML")

        self.fetcher.get.side_effect = get
        urls = crawl.discover(self.fetcher, self.output)
        self.assertIn(URL, urls)
        self.assertEqual(self.fetcher.delay, 1)
        inventory = json.loads((self.output / "discovery.json").read_text(encoding="utf-8"))
        self.assertEqual(len(inventory["errors"]), 3)


class RunTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.output = Path(self.temp.name) / "data"
        self.fetcher = Mock()
        fetcher_patch = patch.object(crawl, "Fetcher", return_value=self.fetcher)
        fetcher_patch.start()
        self.addCleanup(fetcher_patch.stop)
        print_patch = patch("builtins.print")
        print_patch.start()
        self.addCleanup(print_patch.stop)

    def run_urls(self, urls, **kwargs):
        with patch.object(crawl, "discover", return_value=urls):
            return crawl.run(self.output, **kwargs)

    def test_success_exports_database_and_reproducible_raw_snapshot(self):
        self.fetcher.get.return_value = response(headers={"Content-Type": "text/html", "Last-Modified": "Wed, 04 Nov 2026 12:00:00 GMT"})
        report = self.run_urls([URL])
        self.assertEqual((report["sources"], report["faqs"], report["attempted"]), (1, 1, 1))
        self.assertEqual(report["errors"], [])
        manifest = read_jsonl(self.output / "crawl-manifest.jsonl")
        self.assertEqual(manifest[0]["status"], "ok")
        source = read_jsonl(self.output / "sources.jsonl")[0]
        self.assertEqual(source["requested_url"], URL)
        self.assertEqual(source["http_status"], 200)
        self.assertTrue(source["last_modified"])
        with gzip.open(self.output / source["raw_path"], "rt", encoding="utf-8") as stream:
            self.assertEqual(stream.read(), HTML)
        self.assertTrue((self.output / "vinahost.sqlite").is_file())
        self.assertEqual(json.loads((self.output / "report.json").read_text(encoding="utf-8"))["sources"], 1)

    def test_second_run_uses_cached_page_without_fetch(self):
        self.fetcher.get.return_value = response()
        self.run_urls([URL])
        self.fetcher.get.reset_mock()
        report = self.run_urls([URL])
        self.fetcher.get.assert_not_called()
        self.assertEqual(report["sources"], 1)
        self.assertEqual(read_jsonl(self.output / "crawl-manifest.jsonl")[0]["status"], "cached")

    def test_refresh_fetches_and_replaces_cached_content(self):
        self.fetcher.get.return_value = response()
        self.run_urls([URL])
        self.fetcher.get.reset_mock()
        self.fetcher.get.return_value = response(text=HTML.replace("miễn phí", "theo bảng giá"))
        self.run_urls([URL], refresh=True)
        self.fetcher.get.assert_called_once_with(URL)
        faq = read_jsonl(self.output / "faqs.jsonl")[0]
        self.assertIn("theo bảng giá", faq["answer"])

    def test_redirect_aliases_do_not_duplicate_source_records(self):
        self.fetcher.get.return_value = response()
        report = self.run_urls([URL, BASE + "hosting-alias/"])
        self.assertEqual(report["attempted"], 2)
        self.assertEqual(report["sources"], 1)
        self.assertEqual(len(read_jsonl(self.output / "sources.jsonl")), 1)

    def test_page_failures_are_manifested_while_success_is_exported(self):
        bad_urls = [BASE + name + "/" for name in ("hosting-timeout", "hosting-json", "hosting-short", "hosting-offsite")]
        self.fetcher.get.side_effect = [response(), requests.Timeout("fixture timeout"),
            response(bad_urls[1], "{}", headers={"Content-Type": "application/json"}),
            response(bad_urls[2], "<main><p>Short.</p></main>"),
            response("https://evil.example/", HTML)]
        report = self.run_urls([URL] + bad_urls)
        self.assertEqual(report["sources"], 1)
        self.assertEqual(report["attempted"], 5)
        self.assertEqual(len(report["errors"]), 4)
        manifest = read_jsonl(self.output / "crawl-manifest.jsonl")
        self.assertEqual([m["status"] for m in manifest], ["ok", "error", "error", "error", "error"])
        for item in manifest[1:]:
            self.assertTrue(item["error"])
            self.assertTrue(item["at"])

    def test_failed_run_preserves_previous_exports(self):
        self.fetcher.get.return_value = response()
        self.run_urls([URL])
        original = (self.output / "vinahost.sqlite").read_bytes()
        self.fetcher.get.side_effect = requests.Timeout("fixture timeout")
        with self.assertRaisesRegex(RuntimeError, "existing exports preserved"):
            self.run_urls([URL], refresh=True)
        self.assertEqual((self.output / "vinahost.sqlite").read_bytes(), original)
        self.assertEqual(read_jsonl(self.output / "crawl-manifest.jsonl")[0]["status"], "error")

    def test_crawl_limit_bounds_attempts_but_retains_discovery_count(self):
        self.fetcher.get.return_value = response()
        report = self.run_urls([URL, BASE + "email-hosting/"], limit=1)
        self.assertEqual(report["selected"], 2)
        self.assertEqual(report["attempted"], 1)
        self.fetcher.get.assert_called_once_with(URL)

    def test_corrupt_cached_page_is_logged_instead_of_silently_imported(self):
        cache = self.output / "pages"
        cache.mkdir(parents=True)
        (cache / (digest(URL) + ".json")).write_text("not JSON", encoding="utf-8")
        with self.assertRaises(RuntimeError):
            self.run_urls([URL])
        self.fetcher.get.assert_not_called()
        self.assertEqual(read_jsonl(self.output / "crawl-manifest.jsonl")[0]["status"], "error")


if __name__ == "__main__":
    unittest.main()
