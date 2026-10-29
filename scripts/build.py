#!/usr/bin/env python3
"""Generate the minimal blog; Python standard library only."""
import datetime as dt
import html
import json
import math
from pathlib import Path
import re
import shutil
from string import Template

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
CONFIG = json.loads((ROOT / 'site.json').read_text())
BASE = CONFIG.get('base_path', '').rstrip('/')
CATEGORIES = {'life': '生活', 'tech': '技术'}
ON = ' class="on" aria-current="page"'
HAN = re.compile(r'[\u3400-\u4dbf\u4e00-\u9fff]')


def esc(value):
    return html.escape(str(value), quote=True)


def url(path='/'):
    return BASE + path


def image(match):
    alt, path = match.group(1), match.group(2)
    if not path.startswith('/'):
        raise ValueError(f'图片地址 {path} 必须以 / 开头，例如 /media/photo.jpg；请用后台的图片按钮上传，不要引用外部图片。')
    if not path.startswith(BASE + '/'):
        path = BASE + path
    local = path[len(BASE):] if BASE else path
    if not (local.startswith('/media/') and (ROOT / 'content' / local.lstrip('/')).is_file()):
        raise ValueError(f'找不到图片 {local}：图片文件必须放在 content/media/ 目录下，并写成 /media/文件名。')
    return f'<img src="{path}" alt="{alt}" loading="lazy">'


def inline(value):
    value = html.escape(value)
    value = re.sub(r'!\[([^\]]*)\]\(([^\s)]+)\)', image, value)
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


def preload():
    """Preload body 400 and heading 600 on the home page, only once the font files exist."""
    tags = ''
    for name in ['noto-sans-sc-400.woff2', 'noto-serif-sc-600.woff2']:
        if (ROOT / 'assets/fonts' / name).is_file():
            tags += f'  <link rel="preload" href="{url("/assets/fonts/" + name)}" as="font" type="font/woff2" crossorigin>\n'
    return tags


def page(title, content, active='home', extra=''):
    nav = ''.join(
        f'<a href="{url(path)}"' + (' aria-current="page"' if key == active else '') + f'>{label}</a>'
        for key, path, label in [('home', '/', '首页'), ('life', '/life/', '生活'), ('tech', '/tech/', '技术')]
    )
    return template('base.html', title=esc(title), description=esc(CONFIG['description']),
                    author=esc(CONFIG['author']), home=url('/'), assets=url('/assets/'),
                    preload=preload() if active == 'home' else '', progress=extra,
                    nav=nav, content=content,
                    year=dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).year)


def rainbow(counts, current=None):
    """Dashed six-ring arch, see DESIGN.md section 5. Left half links to life, right half to tech."""
    cx, cy = 180, 222
    ghost = not sum(counts.values())
    halves = {'life': [], 'tech': []}
    for ring in range(6):
        r = 170 - 18 * ring
        n = round(r / 7.2)
        for k in range(n + 1):
            a = math.pi + k / n * math.pi
            b = a + math.pi / n * .55
            x1, y1, x2, y2 = cx + math.cos(a) * r, cy + math.sin(a) * r, cx + math.cos(b) * r, cy + math.sin(b) * r
            if max(y1, y2) > cy + 1e-6:
                continue
            t = k / n
            side = 'life' if (x1 + x2) / 2 < cx else 'tech'
            delay = round(350 + t * 700 + ring * 40)
            halves[side].append(f'<line class="s{6 - min(5, math.floor(t * 6))}" x1="{x1:.2f}" y1="{y1:.2f}" '
                                f'x2="{x2:.2f}" y2="{y2:.2f}" style="--d:{delay}"/>')
    if ghost:
        top, bottom = '还没有文章', '写下第一篇，桥就有了颜色'
    elif current:
        other = 'tech' if current == 'life' else 'life'
        top, bottom = '当前 · ' + CATEGORIES[current], '点另一半，去' + CATEGORIES[other]
    else:
        top, bottom = f'生活 {counts["life"]} · 技术 {counts["tech"]}', '选一头走进去'
    parts = []
    for side, x in [('life', 0), ('tech', 180)]:
        foot = f'<text class="foot{" on" if side == current else ""}" x="{cx - 128 if side == "life" else cx + 128}" y="{cy + 22}">{CATEGORIES[side]}</text>'
        inner = f'<rect class="hit" x="{x}" y="0" width="180" height="250"/>' + ''.join(halves[side]) + foot
        if ghost:
            parts.append(f'<g class="half">{inner}</g>')
        else:
            state = ' aria-current="page"' if side == current else ''
            dim = ' dim' if current and side != current else ''
            parts.append(f'<a class="half{dim}" data-side="{side}" href="{url("/" + side + "/")}"{state} '
                         f'aria-label="{CATEGORIES[side]}：{counts[side]} 篇">{inner}</a>')
    mode = 'ghost' if ghost else ('cat' if current else 'home')
    return (f'<svg viewBox="0 0 360 250" class="{mode}" data-life="{counts["life"]}" data-tech="{counts["tech"]}"'
            + (f' data-cur="{current}"' if current else '') + '>' + ''.join(parts)
            + f'<text class="c1" x="{cx}" y="{cy - 30}">{top}</text><text class="c2" x="{cx}" y="{cy - 8}">{bottom}</text></svg>')


def listing(posts, empty):
    if not posts:
        return f'<div class="empty rise" style="--i:9"><b>{empty}</b>第一篇会出现在这里。</div>'
    items = []
    for i, post in enumerate(posts):
        key = post['category']
        items.append(
            f'<a class="card rise" style="--i:{9 + min(i, 8)}" data-c="{key}" href="{url("/posts/" + post["slug"] + "/")}"><div>'
            f'<p class="meta"><span class="c">{CATEGORIES[key]}</span><time datetime="{post["date"]}">{post["date"]}</time>'
            f'<span>{post["minutes"]} min</span></p>'
            f'<h3>{esc(post["title"])} <span class="ar" aria-hidden="true">→</span></h3>'
            + (f'<p>{esc(post["excerpt"])}</p>' if post.get('excerpt') else '')
            + f'</div><div class="thumb {key}" aria-hidden="true"></div></a>'
        )
    return ''.join(items)


def intro_block():
    intro = CONFIG.get('intro', '').strip()
    links = [link for link in CONFIG.get('links', []) if link.get('label') and link.get('url')]
    html_intro = f'    <p class="intro rise" style="--i:4">{esc(intro)}</p>\n' if intro else ''
    html_links = ('    <p class="links rise" style="--i:5">'
                  + ''.join(f'<a href="{esc(link["url"])}">{esc(link["label"])}</a>' for link in links)
                  + '</p>\n') if links else ''
    return html_intro, html_links


def back_icon(key):
    # A quarter arch: the life (left) or tech (right) end of the bridge.
    if key == 'life':
        paths = '<path class="a6" d="M2 11a9 9 0 0 1 9-9"/><path class="a4" d="M6 11a5 5 0 0 1 5-5"/>'
    else:
        paths = '<path class="a1" d="M11 2a9 9 0 0 1 9 9"/><path class="a3" d="M11 6a5 5 0 0 1 5 5"/>'
    return f'<svg viewBox="0 0 22 12" aria-hidden="true">{paths}</svg>'


def pager(older, newer):
    cards = ''
    if older:
        cards += f'<a class="prev" href="{url("/posts/" + older["slug"] + "/")}"><small>← 上一篇</small><span>{esc(older["title"])}</span></a>'
    if newer:
        cards += f'<a class="next" href="{url("/posts/" + newer["slug"] + "/")}"><small>下一篇 →</small><span>{esc(newer["title"])}</span></a>'
    return f'  <nav class="pn rise" style="--i:6" aria-label="上一篇和下一篇">{cards}</nav>\n' if cards else ''


def write(path, content):
    target = DIST / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def unquote(value):
    """Plain, "double" or 'single' quoted scalar."""
    if len(value) >= 2 and value[0] == value[-1] == '"':
        try:
            return json.loads(value)
        except ValueError:
            return value[1:-1]
    if len(value) >= 2 and value[0] == value[-1] == "'":
        return value[1:-1].replace("''", "'")
    return value


def front_matter(name, text):
    """Split an article file into (metadata dict, body). Only simple `key: value` lines are supported."""
    text = text.lstrip('\ufeff').replace('\r\n', '\n')
    match = re.match(r'---[ \t]*\n(.*?\n)?---[ \t]*(?:\n|$)', text, re.S)
    if not match:
        raise ValueError(f'{name}：文件开头缺少文章信息。第一行必须是 ---，接着写 title、category、date，再用一行 --- 结束。')
    meta, key = {}, None
    for line in (match.group(1) or '').split('\n'):
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        if line[0] in ' \t' and key:
            meta[key] = (meta[key] + ' ' + line.strip()).strip()
            continue
        found = re.fullmatch(r'([A-Za-z_][\w-]*)[ \t]*:[ \t]*(.*)', line.rstrip())
        if not found:
            raise ValueError(f'{name}：文章信息里的这一行看不懂：“{line}”。每行只能写成 名称: 值，例如 title: 文章标题。')
        key, value = found.group(1), found.group(2).strip()
        if value and value[0] in '|>[{&*!':
            raise ValueError(f'{name}：文章信息“{key}”的值太复杂，只支持单行文字，请改成 {key}: 文字。')
        meta[key] = unquote(value)
    return meta, text[match.end():]


def load_post(path):
    name = path.name
    slug = path.stem
    if path.suffix != '.md' or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug):
        raise ValueError(f'{name}：文件名不合规。请改成只含小写英文、数字和连字符的名字，例如 autumn-rain.md。')
    meta, body = front_matter(name, path.read_text(encoding='utf-8'))
    for field, hint in [('title', '文章标题'), ('category', 'life（生活）或 tech（技术）'), ('date', '日期，例如 2026-10-30')]:
        if not meta.get(field):
            raise ValueError(f'{name}：文章信息缺少“{field}”。请在开头的 --- 之间补上 {field}: {hint}。')
    if meta['category'] not in CATEGORIES:
        raise ValueError(f'{name}：category 写成了“{meta["category"]}”，只能是 life（生活）或 tech（技术）。')
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', meta['date']):
        raise ValueError(f'{name}：date 写成了“{meta["date"]}”，格式应为 YYYY-MM-DD，例如 2026-10-30。')
    try:
        dt.date.fromisoformat(meta['date'])
    except ValueError:
        raise ValueError(f'{name}：date“{meta["date"]}”不是真实存在的日期，请改成 YYYY-MM-DD，例如 2026-10-30。') from None
    if meta.get('slug') and meta['slug'] != slug:
        raise ValueError(f'{name}：文章地址 slug 写成了“{meta["slug"]}”，与文件名“{slug}”不一致。请改回 {slug}，或把文件改名。')
    chars = len(HAN.findall(body))
    return {'slug': slug, 'title': meta['title'], 'category': meta['category'], 'date': meta['date'],
            'excerpt': meta.get('excerpt', ''), 'body': markdown(body), 'chars': chars,
            'minutes': max(1, math.ceil(chars / 400))}


def load_posts():
    return [load_post(path) for path in sorted((ROOT / 'content/posts').glob('*.md'))]


def main():
    posts = load_posts()
    posts.sort(key=lambda post: post['date'], reverse=True)
    counts = {key: sum(post['category'] == key for post in posts) for key in CATEGORIES}
    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(ROOT / 'assets', DIST / 'assets')
    if (ROOT / 'content/media').is_dir():
        shutil.copytree(ROOT / 'content/media', DIST / 'media', ignore=shutil.ignore_patterns('.*'))
    intro, links = intro_block()
    filters = ('  <h2 class="rise" style="--i:7">文章</h2>\n  <p class="filters rise" style="--i:8">分类：'
               + ''.join(f'<a{ON if key == "all" else ""} data-f="{key}" href="{url(path)}">{label}<small>{n}</small></a>'
                         for key, path, label, n in [('all', '/', '全部', len(posts)), ('life', '/life/', '生活', counts['life']),
                                                     ('tech', '/tech/', '技术', counts['tech'])])
               + '</p>\n')
    content = template('list.html', hero_class='', heading=f'你好，<b>{esc(CONFIG["author"])}</b>',
                       tagline='生活感悟 / 技术学习', intro=intro, links=links, rainbow=rainbow(counts),
                       divider='<p class="divider rise" style="--i:6"><a href="#posts">我写的文章 <i aria-hidden="true">↓</i></a></p>\n',
                       filters=filters, posts=listing(posts, '还没有文章'))
    write('index.html', page(CONFIG['title'], content))
    for key, label in CATEGORIES.items():
        content = template('list.html', hero_class=' cat', heading=f'<b>{label}</b>',
                           tagline=f'{key} · {counts[key]} 篇', intro='', links='',
                           rainbow=rainbow(counts, key), divider='', filters='',
                           posts=listing([post for post in posts if post['category'] == key], '这个分类还没有文章'))
        write(key + '/index.html', page(label + ' | ' + CONFIG['title'], content, key))
    for i, post in enumerate(posts):
        key = post['category']
        content = template('post.html', title=esc(post['title']), date=post['date'],
                           category=CATEGORIES[key], category_key=key,
                           category_url=url('/' + key + '/'), back_icon=back_icon(key),
                           minutes=post['minutes'], chars=f'{post["chars"]:,}', body=post['body'],
                           pager=pager(posts[i + 1] if i + 1 < len(posts) else None, posts[i - 1] if i else None))
        write('posts/' + post['slug'] + '/index.html',
              page(post['title'] + ' | ' + CONFIG['title'], content, key,
                   f'  <div class="progress {key}" aria-hidden="true"></div>\n'))
    write('404.html', page('页面没有找到', '<section class="notfound"><h1>页面没有找到</h1><p><a href="' + url('/') + '">返回首页</a></p></section>', ''))
    write('.nojekyll', '')
    print(f'Built {len(posts)} articles into dist/')


if __name__ == '__main__':
    main()
