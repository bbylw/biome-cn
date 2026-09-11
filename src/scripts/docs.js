// 客户端行为：主题、标签页、复制、抽屉、本页目录高亮、滚动揭示、站内搜索
// 全部为渐进增强：无 JS 时内容照样完整可读。

const root = document.documentElement;
root.classList.add('js');

/* ---------- 主题 ---------- */
const THEME_KEY = 'biome-cn:theme';
const themeBtns = () => document.querySelectorAll('[data-theme-toggle]');

function applyTheme(next, persist = true) {
  root.dataset.theme = next;
  root.style.colorScheme = next;
  if (persist) {
    try { localStorage.setItem(THEME_KEY, next); } catch { /* 隐私模式忽略 */ }
  }
  themeBtns().forEach(b => b.setAttribute('aria-label', next === 'dark' ? '切换到浅色主题' : '切换到深色主题'));
}

themeBtns().forEach(btn => btn.addEventListener('click', () => {
  applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
}));

if (!('biome-cn:theme' in (window.localStorage ?? {}))) {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const follow = () => applyTheme(mq.matches ? 'dark' : 'light', false);
  follow();
  mq.addEventListener('change', follow);
}

/* ---------- 代码块：补外壳与复制按钮 ---------- */
const COPY_LABEL = '复制代码';
document.querySelectorAll('.prose pre.shiki, .prose pre[class*="astro-code"]').forEach(pre => {
  if (pre.closest('.codeblock')) return;
  const box = document.createElement('div');
  box.className = 'codeblock';
  pre.replaceWith(box);
  box.append(pre);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'code-copy';
  btn.setAttribute('aria-label', COPY_LABEL);
  btn.title = COPY_LABEL;
  btn.innerHTML = '<span class="ph ph-copy" aria-hidden="true"></span>';
  box.append(btn);
});

document.addEventListener('click', async (e) => {
  const btn = e.target instanceof Element ? e.target.closest('[data-copy]') : null;
  if (!btn) return;
  const box = btn.closest('.codeblock');
  const code = box?.querySelector('pre')?.innerText.replace(/\n$/, '');
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = code;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  const prev = btn.innerHTML;
  btn.dataset.done = '1';
  btn.innerHTML = '<span class="ph ph-check" aria-hidden="true"></span>';
  setTimeout(() => { btn.innerHTML = prev; delete btn.dataset.done; }, 1400);
});

/* ---------- 标签页（同一 syncKey 记住选择） ---------- */
const TAB_KEY = 'biome-cn:tab';
const syncState = (() => {
  try { return JSON.parse(localStorage.getItem(TAB_KEY) || '{}'); } catch { return {}; }
})();

document.querySelectorAll('[data-tabs]').forEach(group => {
  const panels = [...group.querySelectorAll('.tabs__panel')];
  if (!panels.length) return;
  const list = group.querySelector('.tabs__list');
  const syncKey = group.getAttribute('data-tabs') || '';
  const tabs = panels.map((panel, i) => {
    const label = panel.dataset.label || `第 ${i + 1} 项`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tabs__btn';
    btn.role = 'tab';
    btn.textContent = label;
    btn.id = `${syncKey || 't'}-${i}-btn`;
    btn.dataset.label = label;
    btn.setAttribute('aria-controls', panel.id || '');
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', btn.id);
    panel.hidden = true;
    list?.append(btn);
    return { btn, panel };
  });

  const select = (label, remember = true) => {
    const hit = tabs.find(t => t.btn.dataset.label === label) ?? tabs[0];
    tabs.forEach(({ btn, panel }) => {
      const on = btn === hit.btn;
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
      panel.hidden = !on;
    });
    if (remember && syncKey) {
      syncState[syncKey] = hit.btn.dataset.label;
      try { localStorage.setItem(TAB_KEY, JSON.stringify(syncState)); } catch { /* 忽略 */ }
      document.querySelectorAll(`[data-tabs="${syncKey}"]`).forEach(other => {
        if (other === group) return;
        other.dispatchEvent(new CustomEvent('tab:sync', { detail: hit.btn.dataset.label }));
      });
    }
  };

  tabs.forEach(({ btn }, i) => {
    btn.addEventListener('click', () => select(btn.dataset.label));
    btn.addEventListener('keydown', (ev) => {
      const dir = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      ev.preventDefault();
      const next = tabs[(i + dir + tabs.length) % tabs.length];
      next.btn.focus();
      select(next.btn.dataset.label);
    });
  });

  group.addEventListener('tab:sync', (ev) => select(String(ev.detail ?? ''), false));
  select(syncState[syncKey] || tabs[0].btn.dataset.label, false);
  if (syncState[syncKey]) select(syncState[syncKey], false);
});

/* ---------- 侧栏抽屉（窄屏） ---------- */
const rail = document.querySelector('.rail--side');
const menuBtn = document.querySelector('[data-rail-toggle]');
if (rail && menuBtn) {
  const close = () => {
    root.dataset.rail = 'close';
    document.querySelector('.scrim')?.remove();
    menuBtn.setAttribute('aria-expanded', 'false');
  };
  const open = () => {
    root.dataset.rail = 'open';
    menuBtn.setAttribute('aria-expanded', 'true');
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.addEventListener('click', close);
    document.body.append(scrim);
    rail.querySelector('a')?.focus();
  };
  menuBtn.addEventListener('click', () => (root.dataset.rail === 'open' ? close() : open()));
  rail.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.dataset.rail === 'open') close(); });
}

/* ---------- 本页目录：当前项高亮 ---------- */
const tocLinks = [...document.querySelectorAll('.rail--toc a[href^="#"]')];
if (tocLinks.length && 'IntersectionObserver' in window) {
  const map = new Map(tocLinks.map(a => [a.getAttribute('href')?.slice(1), a]));
  const heads = [...map.keys()].map(id => document.getElementById(id)).filter(Boolean);
  const setActive = (id) => tocLinks.forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === `#${id}` ? 'true' : 'false'));
  const io = new IntersectionObserver((rows) => {
    const visible = rows.filter(r => r.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (visible[0]?.target.id) setActive(visible[0].target.id);
  }, { rootMargin: '-72px 0px -70% 0px', threshold: [0, 1] });
  heads.forEach(h => io.observe(h));
  setActive(heads[0]?.id);
}

/* ---------- 滚动揭示 ---------- */
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const revealIO = new IntersectionObserver((rows) => {
    rows.forEach(r => { if (r.isIntersecting) { r.target.classList.add('in'); revealIO.unobserve(r.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i % 4, 3) * 60}ms`;
    revealIO.observe(el);
  });
} else {
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
}

/* ---------- 站内搜索 ---------- */
const findBtn = document.querySelector('[data-find-open]');
const dlg = document.querySelector('.find__dlg');
if (findBtn && dlg) {
  const input = dlg.querySelector('input');
  const out = dlg.querySelector('.find__results');
  /** @type {{title:string,href:string,section:string,description:string,headings:string[]}[]} */
  let index = null;
  let load = null;
  const ensure = () => (load ??= fetch('/search.json').then(r => r.json()).then(d => (index = d.pages, d)).catch(() => (index = [], [])));

  const render = (q) => {
    if (!index) { out.innerHTML = '<li class="find__empty">正在载入索引…</li>'; return; }
    const needle = q.trim().toLowerCase();
    const hits = !needle ? index.slice(0, 8) : index
      .map(p => {
        const t = p.title.toLowerCase(), d = (p.description || '').toLowerCase(), h = p.headings.join(' ').toLowerCase();
        let score = 0;
        if (t.startsWith(needle)) score += 60;
        if (t.includes(needle)) score += 34;
        if (h.includes(needle)) score += 16;
        if (d.includes(needle)) score += 8;
        if (p.href.toLowerCase().includes(needle)) score += 12;
        return { p, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || a.p.title.length - b.p.title.length)
      .slice(0, 12);
    if (!hits.length) { out.innerHTML = `<li class="find__empty">没有匹配「${escapeHtml(q)}」的页面</li>`; return; }
    out.innerHTML = hits.map(({ p }) =>
      `<li><a href="${p.href}"><span class="sec">${escapeHtml(p.section)}</span>${escapeHtml(p.title)}</a></li>`).join('');
  };
  const escapeHtml = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const show = async () => {
    dlg.hidden = false;
    document.body.classList.add('finding');
    input.focus();
    ensure().then(() => render(input.value));
  };
  const hide = () => { dlg.hidden = true; document.body.classList.remove('finding'); input.value = ''; };

  findBtn.addEventListener('click', show);
  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
    if (e.key === 'ArrowDown') { e.preventDefault(); out.querySelector('a')?.focus(); }
  });
  dlg.addEventListener('click', (e) => { if (!e.target.closest('a') && !e.target.closest('input')) hide(); });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dlg.hidden) hide();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); dlg.hidden ? show() : hide(); }
  });
}
