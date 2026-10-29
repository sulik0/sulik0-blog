#!/usr/bin/env python3
"""Generate the minimal blog; Python standard library only."""
import datetime as dt
import html
import json
from pathlib import Path
import re
import shutil
from string import Template

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
CONFIG = json.loads((ROOT / 'site.json').read_text())
BASE = CONFIG.get('base_path', '').rstrip('/')
CATEGORIES = {'life': '生活', 'tech': '技术'}


def esc(value):
    return html.escape(str(value), quote=True)


def url(path='/'):
    return BASE + path


def inline(value):
    value = html.escape(value)
    value = re.sub(r'`([^`]+)`', r'<code>\1</code>', value)
    value = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', value)
    return re.sub(r'\[([^\]]+)\]\(((?:https?://|/|#)[^\s)]+)\)', r'<a href="\2">\1</a>', value)


def markdown(source):
    result, paragraph, listing, quote_lines = [], [], [], []
    list_type = None
    headings = {}
    lines = source.splitlines()
    def flush():
        nonlocal list_type
        if paragraph:
            result.append('<p>' + inline(' '.join(paragraph)) + '</p>')
            paragraph.clear()
        if listing:
            result.append(f'<{list_type}>' + ''.join('<li>' + inline(x) + '</li>' for x in listing) + f'</{list_type}>')
            listing.clear()
            list_type = None
        if quote_lines:
            result.append('<blockquote><p>' + inline(' '.join(quote_lines)) + '</p></blockquote>')
            quote_lines.clear()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if line.startswith('```'):
            flush()
            language = re.sub(r'[^A-Za-z0-9_-]', '', line[3:])
            block = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith('```'):
                block.append(lines[i])
                i += 1
            if i == len(lines):
                raise ValueError('Unclosed code block')
            result.append('<pre><code class="language-' + language + '">' + html.escape('\n'.join(block)) + '</code></pre>')
        elif not line:
            flush()
        elif line.startswith(('## ', '### ')):
            flush()
            level, title = line.split(' ', 1)
            key = re.sub(r'[^\w\u4e00-\u9fff-]', '-', title).strip('-') or 'section'
            headings[key] = headings.get(key, 0) + 1
            if headings[key] > 1:
                key += '-' + str(headings[key])
            result.append(f'<h{len(level)} id="{esc(key)}">{inline(title)}</h{len(level)}>')
        elif line.startswith('> '):
            if paragraph or listing:
                flush()
            quote_lines.append(line[2:])
        elif line.startswith('- ') or re.match(r'^\d+\. ', line):
            kind = 'ul' if line.startswith('- ') else 'ol'
            if paragraph or quote_lines or (list_type and list_type != kind):
                flush()
            list_type = kind
            listing.append(re.sub(r'^(?:- |\d+\. )', '', line))
        else:
            if listing or quote_lines:
                flush()
            paragraph.append(line)
        i += 1
    flush()
    return '\n'.join(result)


def template(name, **values):
    return Template((ROOT / 'templates' / name).read_text()).substitute(values)


def page(title, content, active='home'):
    nav = ''.join(
        f'<a href="{url(path)}"' + (' aria-current="page"' if key == active else '') + f'>{label}</a>'
        for key, path, label in [('home', '/', '首页'), ('life', '/life/', '生活'), ('tech', '/tech/', '技术')]
    )
    return template('base.html', title=esc(title), description=esc(CONFIG['description']),
                    site_title=esc(CONFIG['title']), author=esc(CONFIG['author']),
                    home=url('/'), assets=url('/assets/'), nav=nav, content=content,
                    year=dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).year)


def listing(posts):
    if not posts:
        return '<p class="empty">还没有文章。</p>'
    items = []
    for post in posts:
        link = url('/posts/' + post['slug'] + '/')
        items.append(
            '<article class="post-summary"><p class="meta"><time datetime="' + post['date'] + '">' + post['date'] + '</time> / ' + CATEGORIES[post['category']] + '</p>'
            '<h2><a href="' + link + '">' + esc(post['title']) + '</a></h2>'
            + ('<p>' + esc(post['excerpt']) + '</p>' if post.get('excerpt') else '') + '</article>'
        )
    return ''.join(items)


def write(path, content):
    target = DIST / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def main():
    posts = json.loads((ROOT / 'content/posts.json').read_text())
    slugs = set()
    for post in posts:
        slug = post['slug']
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug) or slug in slugs:
            raise ValueError('Invalid or duplicate article slug')
        slugs.add(slug)
        if post['category'] not in CATEGORIES:
            raise ValueError('Unknown category')
        dt.date.fromisoformat(post['date'])
        post['body'] = markdown((ROOT / 'content/posts' / (slug + '.md')).read_text())
    posts.sort(key=lambda post: post['date'], reverse=True)
    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(ROOT / 'assets', DIST / 'assets')
    content = template('list.html', heading=esc(CONFIG['title']),
                       description=esc(CONFIG['description']), posts=listing(posts))
    write('index.html', page(CONFIG['title'], content))
    for key, label in CATEGORIES.items():
        content = template('list.html', heading=label,
                           description='生活感悟' if key == 'life' else '技术学习',
                           posts=listing([post for post in posts if post['category'] == key]))
        write(key + '/index.html', page(label + ' | ' + CONFIG['title'], content, key))
    for post in posts:
        content = template('post.html', title=esc(post['title']), date=post['date'],
                           category=CATEGORIES[post['category']],
                           category_url=url('/' + post['category'] + '/'),
                           body=post['body'])
        write('posts/' + post['slug'] + '/index.html', page(post['title'] + ' | ' + CONFIG['title'], content, post['category']))
    write('404.html', page('页面没有找到', '<h1>页面没有找到</h1><p><a href="' + url('/') + '">返回首页</a></p>'))
    write('.nojekyll', '')
    print(f'Built {len(posts)} articles into dist/')


if __name__ == '__main__':
    main()
