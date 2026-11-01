const API = 'https://api.github.com';
const COOKIE = 'blog_admin_session';
const STATE_COOKIE = 'blog_admin_state';

function b64(bytes) {
  let s = '';
  for (const byte of bytes) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64(value) {
  const s = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

function decodeGithubContent(value) {
  const bytes = Uint8Array.from(atob(value.replace(/\s/g, '')), c => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

async function key(secret) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function seal(value, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(secret), new TextEncoder().encode(value));
  return `${b64(iv)}.${b64(new Uint8Array(encrypted))}`;
}

async function open(value, secret) {
  try {
    const [iv, data] = value.split('.');
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await key(secret), unb64(data));
    return new TextDecoder().decode(plain);
  } catch (_) {
    return null;
  }
}

function cookie(request, name) {
  const value = request.headers.get('Cookie') || '';
  return value.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}

function setCookie(name, value, maxAge = 3600) {
  return `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
}

function config(env) {
  return { owner: env.GITHUB_OWNER, repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH || 'main' };
}

async function github(env, path, init = {}, token) {
  const headers = new Headers(init.headers || {});
  headers.set('Accept', 'application/vnd.github+json');
  headers.set('X-GitHub-Api-Version', '2022-11-28');
  headers.set('User-Agent', 'sulik0-blog-admin');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(API + path, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `GitHub API ${response.status}`);
  return body;
}

async function session(request, env) {
  const raw = cookie(request, COOKIE);
  return raw ? await open(raw, env.SESSION_SECRET) : null;
}

function safeSlug(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function frontMatter(post) {
  const lines = ['---', `title: ${post.title}`, `category: ${post.category}`, `date: ${post.date}`];
  if (post.excerpt) lines.push(`excerpt: ${post.excerpt}`);
  lines.push(`slug: ${post.slug}`, '---', '', post.body.trim(), '');
  return lines.join('\n');
}

function parsePost(text, slug) {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) throw new Error(`${slug}.md 缺少文章信息`);
  const meta = {};
  for (const line of match[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return { slug, title: meta.title || '', category: meta.category || 'life', date: meta.date || '', excerpt: meta.excerpt || '', body: match[2].trim() };
}

async function posts(request, env, token) {
  const { owner, repo, branch } = config(env);
  const items = await github(`/repos/${owner}/${repo}/contents/content/posts?ref=${encodeURIComponent(branch)}`, {}, token);
  const files = items.filter(item => item.type === 'file' && item.name.endsWith('.md'));
  const result = [];
  for (const file of files) {
    const data = await github(`/repos/${owner}/${repo}/contents/${file.path}?ref=${encodeURIComponent(branch)}`, {}, token);
    result.push({ ...parsePost(decodeGithubContent(data.content), file.name.slice(0, -3)), sha: data.sha });
  }
  return result.sort((a, b) => b.date.localeCompare(a.date));
}

async function savePost(request, env, token) {
  const post = await request.json();
  if (!post || !safeSlug(post.slug)) throw new Error('文章地址只能使用小写英文、数字和连字符');
  if (!['life', 'tech'].includes(post.category)) throw new Error('分类只能是 life 或 tech');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(post.date)) throw new Error('日期格式必须是 YYYY-MM-DD');
  if (!post.title?.trim() || !post.body?.trim()) throw new Error('标题和正文不能为空');
  const { owner, repo, branch } = config(env);
  const path = `content/posts/${post.slug}.md`;
  let sha;
  try { sha = (await github(`/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`, {}, token)).sha; } catch (_) {}
  const body = { message: `${sha ? 'Update' : 'Add'} post: ${post.title}`, content: b64(new TextEncoder().encode(frontMatter(post))), branch };
  if (sha) body.sha = sha;
  await github(`/repos/${owner}/${repo}/contents/${path}`, { method: 'PUT', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }, token);
}

async function deletePost(env, token, slug) {
  if (!safeSlug(slug)) throw new Error('文章地址不合法');
  const { owner, repo, branch } = config(env);
  const path = `content/posts/${slug}.md`;
  const file = await github(`/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`, {}, token);
  await github(`/repos/${owner}/${repo}/contents/${path}`, { method: 'DELETE', body: JSON.stringify({ message: `Delete post: ${slug}`, sha: file.sha, branch }), headers: { 'content-type': 'application/json' } }, token);
}

async function uploadMedia(request, env, token) {
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || !file.name) throw new Error('请选择图片');
  if (file.size > 10 * 1024 * 1024) throw new Error('图片不能超过 10 MB');
  const name = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  if (!/\.(png|jpe?g|gif|webp|svg)$/.test(name)) throw new Error('只支持 PNG、JPG、GIF、WebP 或 SVG 图片');
  const { owner, repo, branch } = config(env);
  const path = `content/media/${name}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  await github(`/repos/${owner}/${repo}/contents/${path}`, { method: 'PUT', body: JSON.stringify({ message: `Add media: ${name}`, content: b64(bytes), branch }), headers: { 'content-type': 'application/json' } }, token);
  return `/media/${name}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/login') {
        const state = b64(crypto.getRandomValues(new Uint8Array(24)));
        const redirect = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(env.GITHUB_CLIENT_ID)}&redirect_uri=${encodeURIComponent(env.PUBLIC_URL + '/callback')}&scope=repo&state=${state}`;
        return new Response(null, { status: 302, headers: { Location: redirect, 'Set-Cookie': setCookie(STATE_COOKIE, state, 600) } });
      }
      if (url.pathname === '/callback') {
        const state = url.searchParams.get('state');
        if (!state || state !== cookie(request, STATE_COOKIE)) return new Response('登录状态已过期，请重试', { status: 400 });
        const exchange = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code: url.searchParams.get('code'), redirect_uri: env.PUBLIC_URL + '/callback' }) });
        const data = await exchange.json();
        if (!data.access_token) return new Response('GitHub 登录失败', { status: 400 });
        const value = await seal(data.access_token, env.SESSION_SECRET);
        const headers = new Headers({ Location: '/' });
        headers.append('Set-Cookie', setCookie(COOKIE, value));
        headers.append('Set-Cookie', setCookie(STATE_COOKIE, '', 0));
        return new Response(null, { status: 302, headers });
      }
      if (url.pathname === '/logout') return new Response(null, { status: 302, headers: { Location: '/', 'Set-Cookie': setCookie(COOKIE, '', 0) } });
      if (url.pathname.startsWith('/api/')) {
        const token = await session(request, env);
        if (url.pathname === '/api/session') return json({ authenticated: Boolean(token) });
        if (!token) return json({ error: '请先登录 GitHub' }, 401);
        if (url.pathname === '/api/posts' && request.method === 'GET') return json(await posts(request, env, token));
        if (url.pathname === '/api/posts' && request.method === 'POST') { await savePost(request, env, token); return json({ ok: true }); }
        if (url.pathname === '/api/posts' && request.method === 'DELETE') { await deletePost(env, token, url.searchParams.get('slug') || ''); return json({ ok: true }); }
        if (url.pathname === '/api/media' && request.method === 'POST') return json({ path: await uploadMedia(request, env, token) });
        return json({ error: '找不到接口' }, 404);
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      return json({ error: error.message || '服务器错误' }, 400);
    }
  }
};
