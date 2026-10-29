#!/usr/bin/env python3
"""Check generated pages, metadata and local links without network requests."""
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
config = json.loads((ROOT / 'site.json').read_text())
base = config.get('base_path', '').rstrip('/')


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.references, self.ids, self.headings = [], set(), 0
        self.has_title = False
    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if tag == 'h1':
            self.headings += 1
        if tag == 'title':
            self.has_title = True
        if 'id' in data:
            assert data['id'] not in self.ids, 'Duplicate HTML id'
            self.ids.add(data['id'])
        if tag == 'img':
            assert 'alt' in data, 'Image alt missing'
        for attribute in ['href', 'src']:
            if attribute in data:
                self.references.append(data[attribute])


def main():
    pages = list(DIST.rglob('*.html'))
    posts = json.loads((ROOT / 'content/posts.json').read_text())
    assert len(pages) == 4 + len(posts)
    for path in pages:
        text = path.read_text()
        page = Page()
        page.feed(text)
        assert page.headings == 1 and page.has_title, str(path.relative_to(DIST))
        assert '<html lang="zh-CN">' in text
        for reference in page.references:
            parsed = urlsplit(reference)
            if parsed.scheme or parsed.netloc:
                continue
            if parsed.path:
                clean = unquote(parsed.path)
                if base and clean.startswith(base + '/'):
                    clean = clean[len(base):]
                target = DIST / clean.lstrip('/') if clean.startswith('/') else path.parent / clean
                if clean.endswith('/'):
                    target /= 'index.html'
                assert target.is_file(), f'Broken local link in {path.name}: {clean}'
            elif parsed.fragment:
                assert unquote(parsed.fragment) in page.ids
        assert not re.search(r'https://hc-ping\.com/[0-9a-f-]{30,}|AGE-SECRET-KEY-1[0-9A-Z]{40,}', text)
    expected = {post['slug'] for post in posts}
    actual = {p.parent.name for p in (DIST / 'posts').glob('*/index.html')} if (DIST / 'posts').exists() else set()
    assert expected == actual
    if not posts:
        assert '还没有文章' in (DIST / 'index.html').read_text()
    assert not (DIST / 'assets/site.js').exists()
    for path in DIST.rglob('*'):
        if path.is_file():
            assert 'chatgpt.site' not in path.read_text(), 'Legacy hosting URL remains'
    print(f'Passed: {len(pages)} pages, local links and article/empty-state output')



if __name__ == '__main__':
    main()
