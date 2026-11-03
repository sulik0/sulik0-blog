import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto, randomBytes } from 'node:crypto';
import { File } from 'node:buffer';

globalThis.crypto ??= webcrypto;
globalThis.File ??= File;
const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
const { default: worker, seal } = await import('data:text/javascript;base64,' + Buffer.from(source + '\nexport { seal };').toString('base64'));
const env = { GITHUB_OWNER:'test-owner', GITHUB_REPO:'test-blog', GITHUB_BRANCH:'main', SESSION_SECRET:randomBytes(32).toString('hex') };
const cookie = 'blog_admin_session=' + await seal('test-token', env.SESSION_SECRET);
const endpoint = 'https://admin.example/api/';
const realFetch = globalThis.fetch;
function request(path, options = {}) { return new Request(endpoint + path, { ...options, headers: { cookie, ...options.headers } }); }
const post = { title:'中文发布验证 🌈', slug:'encoding-test', category:'tech', date:'2026-11-04', excerpt:'中文、表情与符号 + / =', body:'这是中文正文。\n\n## 彩虹桥 🌈\n\n保留换行、标点与 emoji：你好，世界！' };

test('Chinese and emoji posts use standard Base64 and round-trip through listing', async () => {
  let saved;
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.get('Authorization'), 'Bearer test-token');
    if (options.method === 'PUT') {
      saved = JSON.parse(options.body);
      assert.match(saved.content, /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
      assert.equal(saved.content, Buffer.from(Buffer.from(saved.content, 'base64')).toString('base64'));
      const text = Buffer.from(saved.content,'base64').toString('utf8');
      assert.ok(text.includes(post.title)); assert.ok(text.includes(post.body));
      return Response.json({ content:{sha:'created'} });
    }
    if (saved && String(url).includes('contents/content/posts?')) return Response.json([{type:'file',name:'encoding-test.md',path:'content/posts/encoding-test.md'}]);
    if (saved) return Response.json({ content:saved.content, sha:'created' });
    return Response.json({message:'Not Found'}, {status:404});
  };
  try {
    const result = await worker.fetch(request('posts', { method:'POST', body:JSON.stringify(post) }), env);
    assert.equal(result.status, 200, await result.text());
    const list = await worker.fetch(request('posts'),env);
    const [loaded] = await list.json();
    for (const field of Object.keys(post)) assert.equal(loaded[field],post[field]);
  } finally { globalThis.fetch = realFetch; }
});

test('binary image bytes retain + / and padding', async () => {
  const bytes = Uint8Array.of(251,255,255,0);
  let saved;
  globalThis.fetch = async (_, options) => { saved = JSON.parse(options.body); return Response.json({}); };
  try {
    const form = new FormData(); form.append('file', new File([bytes],'base64-test.png',{type:'image/png'}));
    const result = await worker.fetch(request('media',{method:'POST',body:form}),env);
    assert.equal(result.status,200,await result.text());
    assert.equal(saved.content,'+///AA==');
    assert.deepEqual(Buffer.from(saved.content,'base64'),Buffer.from(bytes));
  } finally { globalThis.fetch = realFetch; }
});

test('unauthenticated publication cannot write to GitHub', async () => {
  let called = false;
  globalThis.fetch = async () => { called=true; throw Error('unexpected network'); };
  try {
    const response = await worker.fetch(new Request(endpoint+'posts',{method:'POST',body:JSON.stringify(post)}),env);
    assert.equal(response.status,401); assert.equal(called,false);
  } finally { globalThis.fetch = realFetch; }
});
