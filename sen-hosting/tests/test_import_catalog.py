import importlib.util
import json
from pathlib import Path
import unittest
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('catalog_import', ROOT / 'import-catalog.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CatalogTests(unittest.TestCase):
    def test_domain_cards_preserve_separate_registration_and_renewal(self):
        html = '''<main><div class="domain-extensions-item"><div class="domain-extensions-content-left">
        <p><span>.com</span></p><span class="item-price">370.000 đ</span></div>
        <div class="domain-extensions-content-right">Gia hạn: <span>390.000 đ</span><br>
        Phí chuyển: <span>350.000 đ</span></div></div></main>'''
        result = module.extract_domains(BeautifulSoup(html, 'html.parser'), 'stamp')
        self.assertEqual(result[0]['extensions'], ['.com'])
        self.assertEqual(result[0]['price']['display'], '370.000 đ')
        self.assertEqual(result[0]['price']['renewalDisplay'], '390.000 đ')
        self.assertEqual(result[0]['availability']['checked'], False)

    def test_plan_grid_keeps_columns_aligned_and_ignores_comparison_table(self):
        html = '''<main><table><tr><th>Gói Dịch Vụ</th><th>WPH 1</th><th>WPH 2</th></tr>
        <tr><td>Giá</td><td>123,250 vnđ/tháng</td><td>195,500 vnđ/tháng</td></tr>
        <tr><td>RAM</td><td>4 GB</td><td>7 GB</td></tr></table>
        <table><tr><th>Gói Dịch Vụ</th><th>Hosting</th><th>VPS</th></tr><tr><td>Mục đích</td><td>A</td><td>B</td></tr></table></main>'''
        result = module.extract_plans(BeautifulSoup(html, 'html.parser'), 'wordpress-hosting', 'stamp')
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]['name'], 'WPH 1')
        self.assertEqual(result[1]['specs']['RAM'], '7 GB')
        self.assertEqual(result[0]['price']['verifiedCurrent'], False)

    def test_generated_snapshot_has_real_sources_unique_records_and_no_public_foreign_brand(self):
        catalog, provenance = module.build_catalog()
        self.assertGreaterEqual(len(catalog['items']), 40)
        self.assertEqual(len({r['id'] for r in catalog['items']}), len(catalog['items']))
        self.assertNotIn('vinahost', json.dumps(catalog, ensure_ascii=False).lower())
        self.assertTrue(all(r['sourceUrl'] == '/knowledge/' + r['id'] for r in catalog['items']))
        self.assertTrue(all(r['availability']['checked'] is False for r in catalog['items']))
        self.assertEqual(len(provenance['records']), len(catalog['items']))
        self.assertTrue(all(r['originalUrl'].startswith('https://vinahost.vn/') for r in provenance['records']))
        self.assertTrue(all(r['literalEvidence'] for r in provenance['records']))


if __name__ == '__main__':
    unittest.main()
