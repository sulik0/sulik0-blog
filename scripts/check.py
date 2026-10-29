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
HAN = re.compile(r'[㐀-䶿一-鿿]')


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
        # Anything the browser fetches by itself must stay on this site.
        loads = data.get('src') or (data.get('href') if tag == 'link' else None)
        if loads:
            assert not urlsplit(loads).netloc, f'External request: {loads}'
        if tag == 'script':
            assert data.get('src') == base + '/assets/site.js', 'Only assets/site.js may run'


def local_target(path, reference):
    clean = unquote(urlsplit(reference).path)
    if base and clean.startswith(base + '/'):
        clean = clean[len(base):]
    target = DIST / clean.lstrip('/') if clean.startswith('/') else path.parent / clean
    return target / 'index.html' if clean.endswith('/') else target


def check_css():
    css = DIST / 'assets/site.css'
    text = css.read_text()
    assert '@import' not in text, 'site.css must not import other stylesheets'
    for reference in re.findall(r'url\(\s*["\']?([^"\')\s]+)', text):
        assert not urlsplit(reference).netloc, f'External request in site.css: {reference}'
        if not (css.parent / reference).is_file():
            print(f'Warning: site.css refers to missing {reference}; run python3 scripts/fonts.py')


def check_charset(posts):
    """Warn (never fail) when an article uses Chinese characters missing from the font subset."""
    charset = ROOT / 'assets/fonts/charset.txt'
    if not charset.is_file():
        return
    known = set(charset.read_text(encoding='utf-8'))
    for post in posts:
        source = (ROOT / 'content/posts' / (post['slug'] + '.md')).read_text(encoding='utf-8')
        missing = sorted(set(HAN.findall(post['title'] + post.get('excerpt', '') + source)) - known)
        if missing:
            print(f'Warning: {post["slug"]} uses {len(missing)} characters outside the font subset '
                  f'({"".join(missing[:20])}); run python3 scripts/fonts.py')


def check_hero(text):
    """Empty intro or links in site.json must not leave empty elements behind."""
    if not config.get('intro', '').strip():
        assert 'class="intro' not in text, 'Empty intro rendered'
    if not config.get('links'):
        assert 'class="links' not in text, 'Empty links rendered'
    assert not re.search(r'<(p|div|a)\b(?![^>]*aria-hidden)[^>]*>\s*</\1>', text), 'Empty element in page'


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
                assert local_target(path, reference).is_file(), f'Broken local link in {path.name}: {parsed.path}'
            elif parsed.fragment:
                assert unquote(parsed.fragment) in page.ids
        assert not re.search(r'https://hc-ping\.com/[0-9a-f-]{30,}|AGE-SECRET-KEY-1[0-9A-Z]{40,}', text)
    expected = {post['slug'] for post in posts}
    actual = {p.parent.name for p in (DIST / 'posts').glob('*/index.html')} if (DIST / 'posts').exists() else set()
    assert expected == actual
    home = (DIST / 'index.html').read_text()
    check_hero(home)
    for key in ['life', 'tech']:
        count = sum(post['category'] == key for post in posts)
        category = (DIST / key / 'index.html').read_text()
        assert f'{key} · {count} 篇' in category, f'Wrong count on /{key}/'
        if not count:
            assert '这个分类还没有文章' in category
    assert f'全部<small>{len(posts)}</small>' in home
    if not posts:
        assert '还没有文章' in home and 'class="ghost"' in home
    else:
        assert 'class="card' in home and 'class="ghost"' not in home
    script = DIST / 'assets/site.js'
    assert script.is_file() and script.stat().st_size < 6 * 1024, 'assets/site.js missing or not under 6KB'
    for path in DIST.rglob('*'):
        if path.is_file():
            assert b'chatgpt.site' not in path.read_bytes(), 'Legacy hosting URL remains'
    check_css()
    check_charset(posts)
    print(f'Passed: {len(pages)} pages, local links and article/empty-state output')


if __name__ == '__main__':
    main()
