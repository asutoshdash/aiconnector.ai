#!/usr/bin/env python3
"""Validate static SEO assets with Python's standard library: python3 scripts/check-seo.py."""
import json
import struct
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://www.aiconnector.ai/'

class Page(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.meta = {}
        self.canonicals = []
        self.schemas = []
        self.json_text = None
        self.h1 = 0
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'meta':
            key = attrs.get('name', attrs.get('property'))
            self.meta.setdefault(key, []).append(attrs.get('content', ''))
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonicals.append(attrs['href'])
        if tag == 'script' and attrs.get('type') == 'application/ld+json':
            self.json_text = ''
        if tag == 'h1':
            self.h1 += 1

    def handle_data(self, value):
        if self.json_text is not None:
            self.json_text += value

    def handle_endtag(self, tag):
        if tag == 'script' and self.json_text is not None:
            self.schemas.append(json.loads(self.json_text))
            self.json_text = None


def check():
    urls = []
    for path in sorted(ROOT.rglob('*.html')):
        relative = path.relative_to(ROOT).as_posix()
        suffix = '' if relative == 'index.html' else relative.removesuffix('index.html') if relative.endswith('/index.html') else relative
        canonical = BASE + suffix
        page = Page(path.read_text())
        assert page.canonicals == [canonical], f'{relative}: canonical mismatch'
        assert page.h1 == 1, f'{relative}: expected one H1'
        for key in ('description', 'og:title', 'og:description', 'og:type', 'og:url', 'og:image', 'og:image:alt', 'twitter:card', 'twitter:image'):
            assert len(page.meta.get(key, [])) == 1 and page.meta[key][0], f'{relative}: missing/duplicate {key}'
        assert not any('noindex' in value for value in page.meta.get('robots', [])), relative
        assert page.meta['og:url'] == [canonical], relative
        assert page.meta['twitter:card'] == ['summary_large_image'], relative
        assert page.meta['twitter:image'] == page.meta['og:image'], relative
        image_url = page.meta['og:image'][0]
        assert image_url.startswith(BASE), relative
        image = ROOT / urlsplit(image_url).path.lstrip('/')
        raw = image.read_bytes()
        assert raw[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', raw[16:24]) == (1200, 630), image
        assert len(page.schemas) == 1, relative
        graph = page.schemas[0]['@graph']
        ids = [entry['@id'] for entry in graph if '@id' in entry]
        assert len(ids) == len(set(ids)), f'{relative}: duplicate schema IDs'
        if relative.startswith(('blogs/', 'writing/')):
            articles = [entry for entry in graph if entry['@type'] == 'Article']
            assert len(articles) == 1 and articles[0]['mainEntityOfPage'] == canonical, relative
            assert articles[0]['image'] == image_url, relative
        if relative != 'index.html':
            crumbs = next(entry for entry in graph if entry['@type'] == 'BreadcrumbList')['itemListElement']
            assert len(crumbs) >= 2 and crumbs[-1]['item'] == canonical, relative
            assert [item['position'] for item in crumbs] == list(range(1, len(crumbs) + 1)), relative
            for crumb in crumbs:
                target = ROOT / urlsplit(crumb['item']).path.lstrip('/')
                assert target.is_file() or (target / 'index.html').is_file(), crumb
        urls.append(canonical)
    sitemap = ET.parse(ROOT / 'sitemap.xml')
    locations = [entry.text for entry in sitemap.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
    assert Counter(locations) == Counter(urls), 'Sitemap must cover every canonical exactly once'
    robots = (ROOT / 'robots.txt').read_text()
    assert 'User-agent: *\nAllow: /' in robots and f'Sitemap: {BASE}sitemap.xml' in robots
    print(f'PASS: {len(urls)} pages; metadata, canonical URLs, JSON-LD, breadcrumb targets, PNG previews, sitemap coverage, and robots.txt')

if __name__ == '__main__':
    check()
