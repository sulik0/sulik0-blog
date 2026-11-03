'use strict';
const $ = id => document.getElementById(id);
const DRAFT_KEY = 'sulik0-writing-drafts-v1';
const ACTIVE_KEY = 'sulik0-writing-active-v1';
const fields = ['title', 'slug', 'category', 'date', 'excerpt', 'body'];
const state = { posts: [], drafts: [], current: null, view: 'posts', authenticated: false, dirty: false, busy: false, storageOK: true, postsLoaded: false };
let saveTimer;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function message(text) { $('status').textContent = text; }
function error(text = '') { $('error').textContent = text; $('error').hidden = !text; }
function readDrafts() {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]');
    if (!Array.isArray(saved) || saved.some(d => !d || typeof d.id !== 'string' || !fields.every(f => typeof d[f] === 'string'))) throw Error('invalid');
    state.drafts = saved;
  } catch (_) {
    state.storageOK = false;
    error('无法读取本机草稿。为避免覆盖已有内容，已停止自动保存。请先下载当前文章备份，并检查浏览器的网站存储设置。');
  }
}
function writeDrafts(drafts) {
  if (!state.storageOK) return false;
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts)); state.drafts = drafts; return true; }
  catch (_) { error('草稿保存失败：浏览器存储不可用或空间已满。请使用“下载备份”保留内容。'); return false; }
}
function readPost() { return Object.fromEntries(fields.map(f => [f, $(f).value])); }
function hasContent(post) { return [post.title, post.slug, post.excerpt, post.body].some(v => v.trim()); }
function countWords() { $('word-count').textContent = `${Array.from($('body').value.replace(/\s/g, '')).length} 字`; }
function saveDraft(manual = false) {
  clearTimeout(saveTimer);
  if (!state.current || state.busy) return false;
  if (!state.dirty && state.drafts.some(d => d.id === state.current.id)) {
    if (manual) message('草稿已保存在当前浏览器，尚未发布。');
    return true;
  }
  const post = readPost();
  if (!hasContent(post)) { if (manual) error('先写一点标题或正文，再保存草稿。'); return !state.dirty; }
  const draft = { ...post, id: state.current.id, originalSlug: state.current.originalSlug || '', updatedAt: new Date().toISOString() };
  if (!writeDrafts([draft, ...state.drafts.filter(d => d.id !== draft.id)])) return false;
  state.dirty = false;
  setActive(draft.id);
  $('save-state').textContent = `草稿已保存 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  $('discard').hidden = false;
  if (manual) { error(); message('草稿已保存在当前浏览器，尚未发布。'); }
  render();
  return true;
}
function setActive(id = '') {
  try { if (id) localStorage.setItem(ACTIVE_KEY, id); else localStorage.removeItem(ACTIVE_KEY); } catch (_) {}
}
function showEditor(post = {}, draft = false) {
  if (state.current && state.dirty && !saveDraft() && !confirm('草稿未能保存。仍要离开当前编辑内容吗？')) return;
  clearTimeout(saveTimer);
  state.current = { id: draft ? post.id : crypto.randomUUID(), originalSlug: draft ? (post.originalSlug || '') : (post.slug || '') };
  for (const field of fields) $(field).value = post[field] ?? (field === 'date' ? today() : field === 'category' ? 'life' : '');
  $('slug').disabled = Boolean(state.current.originalSlug);
  $('editor-title').textContent = draft ? '继续写草稿' : post.slug ? '编辑文章' : '新建文章';
  $('publish').textContent = state.current.originalSlug ? '发布更新' : '发布文章';
  $('delete').hidden = !state.current.originalSlug;
  $('discard').hidden = !draft;
  $('save-state').textContent = draft ? '已恢复本机草稿' : '输入时自动保存草稿';
  state.dirty = false;
  setActive(draft ? post.id : '');
  $('editor').hidden = false; $('library').hidden = true; document.querySelector('.hero').hidden = true;
  countWords(); $('title').focus(); window.scrollTo({ top: 0 });
}
function back() {
  if (state.busy) return;
  if (state.dirty && !saveDraft() && !confirm('草稿未能保存。仍要返回吗？')) return;
  clearTimeout(saveTimer); state.current = null; state.dirty = false; setActive();
  $('editor').hidden = true; $('library').hidden = false; document.querySelector('.hero').hidden = false; render();
}
function render() {
  $('posts-count').textContent = state.posts.length;
  $('drafts-count').textContent = state.drafts.length;
  $('filter-posts').setAttribute('aria-pressed', String(state.view === 'posts'));
  $('filter-drafts').setAttribute('aria-pressed', String(state.view === 'drafts'));
  $('draft-note').hidden = state.view !== 'drafts';
  const draftView = state.view === 'drafts';
  const items = draftView ? state.drafts : state.posts;
  if (!items.length) {
    const title = draftView ? '还没有草稿' : state.postsLoaded ? '还没有文章' : state.authenticated ? '文章列表尚未加载' : '登录后，查看已发布文章';
    const hint = draftView ? '点“写一篇新文章”，写到一半也可以先留下。' : state.postsLoaded ? '第一篇会出现在这里。' : state.authenticated ? '可以点击“刷新列表”重试，本机草稿仍然可用。' : '也可以先写作，草稿会留在这个浏览器里。';
    $('entries').innerHTML = `<div class="empty"><strong>${title}</strong>${hint}</div>`;
    return;
  }
  $('entries').innerHTML = items.map((post, index) => {
    const changed = !draftView && state.drafts.some(d => d.originalSlug === post.slug);
    const date = draftView ? new Date(post.updatedAt).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : post.date;
    return `<article class="entry"><div><p class="meta"><span class="category ${post.category === 'tech' ? 'tech' : 'life'}">${post.category === 'tech' ? '技术' : '生活'}</span><span>${esc(date)}</span><span>${draftView ? '本机草稿' : changed ? '有未发布修改' : '已发布'}</span></p><h3>${esc(post.title || '未命名草稿')}</h3><p>${esc(post.excerpt || post.body.slice(0, 70) || '还没写正文')}</p></div><div class="entry-actions"><button class="text-button" data-open="${index}">${draftView ? '继续写' : changed ? '继续编辑草稿' : '编辑文章'}</button>${!draftView ? `<a class="text-button" href="https://sulik0.github.io/sulik0-blog/posts/${encodeURIComponent(post.slug)}/" target="_blank" rel="noopener">查看文章</a>` : ''}</div></article>`;
  }).join('');
  $('entries').querySelectorAll('[data-open]').forEach(button => button.onclick = () => {
    const item = items[Number(button.dataset.open)];
    const saved = draftView ? item : state.drafts.find(d => d.originalSlug === item.slug);
    showEditor(saved || item, Boolean(saved));
  });
}
async function api(path, options) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || '请求失败，请稍后重试');
  return data;
}
async function loadPosts() {
  if (!state.authenticated) return;
  state.posts = await api('/api/posts'); state.postsLoaded = true; render();
}
function busy(value) {
  state.busy = value;
  $('post-form').querySelectorAll('button,input,select,textarea').forEach(e => e.disabled = value);
  $('slug').disabled = value || Boolean(state.current?.originalSlug);
  ['back', 'new', 'refresh', 'filter-posts', 'filter-drafts'].forEach(id => $(id).disabled = value);
}
async function publish(event) {
  event.preventDefault();
  if (state.busy) return;
  error();
  if (!state.authenticated) { error('请先点击右上角“GitHub 登录”。本机草稿会保留，登录后可以继续发布。'); saveDraft(); return; }
  const post = readPost();
  if (!post.title.trim() || !post.body.trim()) return error('发布前，请填写标题和正文。');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)) return error('文章地址只能使用小写英文、数字和连字符，例如 autumn-rain。');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(post.date)) return error('请选择文章日期。');
  if (!state.current.originalSlug && state.posts.some(p => p.slug === post.slug)) return error('这个文章地址已存在，请更换地址，或从已发布列表编辑原文。');
  saveDraft(); busy(true);
  try {
    await api('/api/posts', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(post) });
    const id = state.current.id;
    const removed = writeDrafts(state.drafts.filter(d => d.id !== id));
    state.dirty = false; busy(false); back(); state.view = 'posts'; render();
    message(removed ? '文章已提交发布，博客将在自动构建完成后更新。' : '文章已提交发布；本机草稿未能移除，请稍后手动清理。');
    try { await loadPosts(); } catch (_) { error('文章已提交发布，但列表刷新失败。请稍后点击“刷新列表”，无需重复发布。'); }
  } catch (e) { error(`发布失败：${e.message}。文章内容仍保留在编辑器和已保存的本机草稿中。`); }
  finally { busy(false); }
}
function download() {
  const post = readPost();
  const text = ['---', ...['title','category','date','excerpt'].map(k => `${k}: ${post[k].replace(/[\r\n]/g,' ')}`), '---', '', post.body, ''].join('\n');
  const link = document.createElement('a'); const url = URL.createObjectURL(new Blob([text], { type:'text/markdown;charset=utf-8' }));
  link.href = url; link.download = `${/^[a-z0-9-]+$/.test(post.slug) ? post.slug : 'writing-draft'}.md`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('post-form').addEventListener('input', event => {
  if (!fields.includes(event.target.id) || !state.current) return;
  state.dirty = true; $('save-state').textContent = '正在保存草稿…'; countWords();
  clearTimeout(saveTimer); saveTimer = setTimeout(() => { if (saveDraft()) setActive(state.current.id); }, 700);
});
$('new').onclick = () => showEditor(); $('back').onclick = back;
$('save-draft').onclick = () => { if (saveDraft(true)) setActive(state.current.id); };
$('post-form').onsubmit = publish; $('download').onclick = download;
$('refresh').onclick = async () => { error(); try { await loadPosts(); message(state.authenticated ? '文章列表已刷新。' : '登录后可以刷新已发布文章，本机草稿不受影响。'); } catch (e) { error(e.message); } };
for (const view of ['posts','drafts']) $(`filter-${view}`).onclick = () => { state.view = view; render(); };
$('discard').onclick = () => {
  if (!confirm('删除这份本机草稿？此操作无法撤销，已发布文章不会受影响。')) return;
  clearTimeout(saveTimer);
  if (writeDrafts(state.drafts.filter(d => d.id !== state.current.id))) { state.dirty = false; back(); message('本机草稿已删除。'); }
};
$('delete').onclick = async () => {
  if (!state.authenticated) return error('请先登录 GitHub。');
  if (!confirm('确定从博客撤下这篇文章？仓库历史仍会保留原文。')) return;
  const slug = state.current.originalSlug; clearTimeout(saveTimer); busy(true);
  try {
    await api('/api/posts?slug=' + encodeURIComponent(slug), { method:'DELETE' });
    state.current.originalSlug = ''; $('delete').hidden = true;
    busy(false); state.dirty = true; saveDraft(); back(); message('文章已撤下，内容保留为本机草稿。');
    try { await loadPosts(); } catch (_) { error('撤下成功，但列表刷新失败，请稍后刷新列表。'); }
  } catch(e) { error(e.message); } finally { busy(false); }
};
$('image').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  if (!state.authenticated) { error('请先登录 GitHub 再上传图片。'); event.target.value = ''; return; }
  if (!confirm('图片会上传到公开仓库，即使文章还在草稿中也能被访问。继续上传吗？')) { event.target.value = ''; return; }
  const form = new FormData(); form.append('file', file); busy(true); error();
  try {
    const data = await api('/api/media', { method:'POST', body:form });
    $('body').value += `\n\n![${file.name.replace(/[\[\]\r\n]/g,'')}](${data.path})\n`; state.dirty = true; countWords();
  } catch(e) { error(e.message); }
  finally { busy(false); event.target.value = ''; if (state.dirty) saveDraft(); }
};
window.addEventListener('beforeunload', event => { if (state.dirty && !saveDraft()) { event.preventDefault(); event.returnValue = ''; } });
document.addEventListener('visibilitychange', () => { if (document.hidden && state.dirty && saveDraft()) setActive(state.current.id); });
window.addEventListener('storage', event => {
  if (event.key !== DRAFT_KEY) return;
  // Stop this tab from silently overwriting a draft changed in another tab.
  if (state.current) { clearTimeout(saveTimer); state.storageOK = false; error('另一个标签页修改了草稿。为避免覆盖，已暂停此页保存。请下载当前内容备份，再刷新页面。'); }
  else { readDrafts(); render(); }
});
function drawBridge() {
  const colors = ['#ff7a7a','#f0559c','#cf4fc4','#a457e6','#7b63f2','#5f7cff'];
  const lines = [];
  for (let i = 0; i < 6; i++) {
    const r = 170 - 18 * i, n = Math.round(r / 7.2);
    for (let k = 0; k < n; k++) {
      const a = Math.PI + k / n * Math.PI, b = a + Math.PI / n * .55;
      lines.push(`<line x1="${180 + Math.cos(a)*r}" y1="${222 + Math.sin(a)*r}" x2="${180 + Math.cos(b)*r}" y2="${222 + Math.sin(b)*r}" stroke="${colors[Math.min(5,Math.floor(k/n*6))]}" stroke-width="7" stroke-linecap="round"/>`);
    }
  }
  $('bridge').innerHTML = lines.join('');
}
$('year').textContent = new Date().getFullYear(); drawBridge(); readDrafts(); render();
(async () => {
  try {
    let active; try { active = localStorage.getItem(ACTIVE_KEY); } catch (_) {}
    const draft = state.drafts.find(d => d.id === active); if (draft) showEditor(draft,true);
    const session = await api('/api/session'); state.authenticated = session.authenticated;
    $('login').hidden = state.authenticated; $('logout').hidden = !state.authenticated;
    message(state.authenticated ? '已登录 GitHub。草稿保留在本机，发布后博客自动更新。' : '可以先写作并保存草稿，发布时再登录 GitHub。');
    await loadPosts();
  } catch(e) { message('后台连接不可用，本机草稿仍可使用。'); error(`连接后台失败：${e.message}。仍可写作和保存本机草稿。`); }
})();
