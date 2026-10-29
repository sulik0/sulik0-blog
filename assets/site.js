// Progressive enhancements only; every page is complete without this file. See design/DESIGN.md.
(() => {
  const d = document, body = d.body;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  d.documentElement.classList.add('js');
  void body.offsetWidth; // commit the hidden state so the entrance transitions run, even in throttled tabs
  body.classList.add('go');

  // Nav: a highlight that slides to the hovered item and back to the current page.
  const nav = d.querySelector('.site-header nav'), here = nav.querySelector('[aria-current]');
  const pill = d.createElement('span');
  pill.className = 'pill';
  nav.prepend(pill);
  const move = a => {
    pill.style.left = (a ? a.offsetLeft : 0) + 'px';
    pill.style.width = (a ? a.offsetWidth : 0) + 'px';
  };
  nav.querySelectorAll('a').forEach(a => {
    a.addEventListener('mouseenter', () => move(a));
    a.addEventListener('focus', () => move(a));
  });
  nav.addEventListener('mouseleave', () => move(here));
  nav.addEventListener('focusout', () => move(here));
  addEventListener('resize', () => move(here));
  move(here);
  d.fonts && d.fonts.ready.then(() => move(here));

  // Article: reading progress.
  const bar = d.querySelector('.progress');
  if (bar) {
    const fill = () => {
      const h = d.documentElement.scrollHeight - innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, scrollY / h) : 1) + ')';
    };
    addEventListener('scroll', fill, { passive: true });
    addEventListener('resize', fill);
    fill();
  }

  // Home: filter cards in place instead of following the category links.
  const cards = [...d.querySelectorAll('.card')], filters = [...d.querySelectorAll('.filters a')];
  let locked = 'all';
  const show = f => cards.forEach(c => { c.hidden = f !== 'all' && c.dataset.c !== f; });
  const lock = f => {
    locked = f;
    filters.forEach(a => {
      a.classList.toggle('on', a.dataset.f === f);
      a.setAttribute('aria-pressed', a.dataset.f === f);
    });
    show(f);
  };
  filters.forEach(a => {
    a.removeAttribute('aria-current');
    a.setAttribute('role', 'button');
    a.addEventListener('click', e => { e.preventDefault(); lock(a.dataset.f); });
  });
  if (filters.length) lock('all');

  // Rainbow bridge.
  const svg = d.querySelector('.rainbow svg');
  if (!svg) return;
  svg.addEventListener('transitionend', e => {
    if (e.target.tagName === 'line' && !e.target.classList.contains('near')) e.target.classList.add('settled');
  });
  if (svg.classList.contains('ghost')) return;

  const cx = 180, cy = 222, cur = svg.dataset.cur, name = { life: '生活', tech: '技术' };
  const count = { life: svg.dataset.life, tech: svg.dataset.tech };
  const halves = [...svg.querySelectorAll('.half')];
  const c1 = svg.querySelector('.c1'), c2 = svg.querySelector('.c2'), idle = [c1.textContent, c2.textContent];
  const lines = [...svg.querySelectorAll('line')].map(l => {
    const x = (+l.getAttribute('x1') + +l.getAttribute('x2')) / 2, y = (+l.getAttribute('y1') + +l.getAttribute('y2')) / 2;
    const r = Math.hypot(x - cx, y - cy);
    return { l, x, y, ux: (x - cx) / r, uy: (y - cy) / r };
  });

  const near = q => lines.forEach(o => {
    const d2 = q ? (o.x - q.x) ** 2 + (o.y - q.y) ** 2 : 1e9;
    if (d2 < 1296) {
      const f = 7 * (1 - d2 / 1296);
      o.l.style.setProperty('--nx', (o.ux * f).toFixed(2) + 'px');
      o.l.style.setProperty('--ny', (o.uy * f).toFixed(2) + 'px');
      o.l.classList.add('near');
    } else o.l.classList.remove('near');
  });

  // side = the hovered half, or null when the pointer leaves.
  const hover = side => {
    halves.forEach(h => {
      const k = h.dataset.side;
      h.classList.toggle('dim', cur ? k !== cur : !!side && k !== side);
      h.querySelector('.foot').classList.toggle('on', k === (side || cur));
    });
    if (side) {
      c1.textContent = name[side] + ' · ' + count[side] + ' 篇';
      c2.textContent = !cur ? '点击，只看这一类' : side === cur ? '当前分类' : '点击，去' + name[side];
    } else [c1.textContent, c2.textContent] = idle;
    if (!cur) show(side || locked);
  };

  const local = e => new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  let touch = false;
  svg.addEventListener('pointerdown', e => { touch = e.pointerType === 'touch'; });
  svg.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const q = local(e);
    if (!reduce) near(q);
    hover(q.x < cx ? 'life' : 'tech');
  });
  svg.addEventListener('pointerleave', () => { near(null); hover(null); });
  svg.addEventListener('click', e => {
    const half = e.target.closest('.half');
    if (!half) return;
    const side = half.dataset.side;
    if (cur) { if (side === cur) e.preventDefault(); return; }
    if (touch) return; // no hover on touch screens: follow the link to the category page
    e.preventDefault();
    lock(side);
    d.getElementById('posts').scrollIntoView();
  });
})();
