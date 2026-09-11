// 客户端行为：主题、代码复制、标签页、侧栏抽屉、本页目录高亮、滚动揭示、站内搜索。
// 全部为渐进增强：无 JS 时内容照样完整可读。
//
// 两条纪律：
//   1) 外部依赖（localStorage、clipboard、matchMedia、IntersectionObserver）一律兜底；
//   2) 每个增强各自包在 safe() 里。增强之间是并列关系，任一抛错都不该让后面的不执行
//      （曾经因为一个非法的 rootMargin 让搜索整块没初始化）。

const root = document.documentElement;
root.classList.add('js');

/** 单个增强的隔离层 */
const safe = (fn) => { try { fn(); } catch { /* 该增强失效，其余照常 */ } };

/* ---------- 存储：隐私模式或存储被策略禁用时不得让脚本崩掉 ---------- */
const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* 忽略 */ } },
};

/* ---------- 主题 ---------- */
const THEME_KEY = 'biome-cn:theme';
const THEME_COLOR = { dark: '#0d0c10', light: '#f4f4f5' };

safe(() => {
  const themeBtns = () => document.querySelectorAll('[data-theme-toggle]');

  /**
   * 地址栏配色随主题走。首屏由两条带 media 的 meta 决定（无 JS 也正确），
   * 脚本接管后收敛为一条，避免主题切换与系统配色不一致。
   */
  const applyThemeColor = (dark) => {
    const tags = [...document.querySelectorAll('meta[name="theme-color"]')];
    if (!tags.length) return;
    const [first, ...rest] = tags;
    rest.forEach(t => t.remove());
    first.removeAttribute('media');
    first.setAttribute('content', dark ? THEME_COLOR.dark : THEME_COLOR.light);
  };

  const applyTheme = (next, persist = true) => {
    const dark = next === 'dark';
    root.dataset.theme = dark ? 'dark' : 'light';
    root.style.colorScheme = dark ? 'dark' : 'light';
    if (persist) store.set(THEME_KEY, next);
    themeBtns().forEach(b => b.setAttribute('aria-label', dark ? '切换到浅色主题' : '切换到深色主题'));
    applyThemeColor(dark);
  };

  themeBtns().forEach(btn => btn.addEventListener('click', () => {
    applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
  }));

  // 用户没有显式选择时才跟随系统
  if (!store.get(THEME_KEY) && typeof matchMedia === 'function') {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const follow = () => applyTheme(mq.matches ? 'dark' : 'light', false);
    follow();
    mq.addEventListener('change', follow);
  }
});

/* ---------- 代码块：补外壳与复制按钮 ---------- */
safe(() => {
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
    const btn = e.target instanceof Element ? e.target.closest('[data-copy], .code-copy') : null;
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
});

/* ---------- 终端：复制命令（仅首页真实输出条） ---------- */
safe(() => {
  document.addEventListener('click', async (e) => {
    const btn = e.target instanceof Element ? e.target.closest('[data-term-copy]') : null;
    if (!btn) return;
    const text = btn.getAttribute('data-term-copy') || '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    const prev = btn.innerHTML;
    btn.innerHTML = '<span class="ph ph-check" aria-hidden="true"></span>';
    setTimeout(() => { btn.innerHTML = prev; }, 1400);
  });
});

/* ---------- 标签页（同一 syncKey 记住选择） ---------- */
safe(() => {
  const TAB_KEY = 'biome-cn:tab';
  const syncState = (() => {
    try { return JSON.parse(store.get(TAB_KEY) || '{}'); } catch { return {}; }
  })();

  document.querySelectorAll('[data-tabs]').forEach((group, gi) => {
    const panels = [...group.querySelectorAll('.tabs__panel')];
    if (!panels.length) return;
    const list = group.querySelector('.tabs__list');
    const syncKey = group.getAttribute('data-tabs') || '';

    const tabs = panels.map((panel, i) => {
      const label = panel.dataset.label || `第 ${i + 1} 项`;
      // 同一页可能有多组标签，id 必须全局唯一（TabItem 的 SSR id 已保证唯一）
      const key = panel.id || `tabs-${gi}-${i}`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tabs__btn';
      btn.role = 'tab';
      btn.textContent = label;
      btn.id = `${key}-tab`;
      btn.dataset.label = label;
      btn.setAttribute('aria-controls', panel.id || key);
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
        store.set(TAB_KEY, JSON.stringify(syncState));
        document.querySelectorAll(`[data-tabs="${syncKey}"]`).forEach(other => {
          if (other === group) return;
          other.dispatchEvent(new CustomEvent('tab:sync', { detail: hit.btn.dataset.label }));
        });
      }
    };

    tabs.forEach(({ btn }, i) => {
      btn.addEventListener('click', () => select(btn.dataset.label));
      btn.addEventListener('keydown', (ev) => {
        const target =
          ev.key === 'ArrowRight' ? (i + 1) % tabs.length :
          ev.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length :
          ev.key === 'Home' ? 0 :
          ev.key === 'End' ? tabs.length - 1 : -1;
        if (target < 0) return;
        ev.preventDefault();
        tabs[target].btn.focus();
        select(tabs[target].btn.dataset.label);
      });
    });

    group.addEventListener('tab:sync', (ev) => select(String(ev.detail ?? ''), false));
    select(syncState[syncKey] || tabs[0].btn.dataset.label, false);
  });
});

/* ---------- 侧栏抽屉（窄屏） ---------- */
const rail = document.querySelector('.rail--side');
const menuBtn = document.querySelector('[data-rail-toggle]');
safe(() => {
  if (!rail || !menuBtn) return;
  const close = (refocus = false) => {
    root.dataset.rail = 'close';
    document.querySelector('.scrim')?.remove();
    menuBtn.setAttribute('aria-expanded', 'false');
    if (refocus && rail.contains(document.activeElement)) menuBtn.focus();
  };
  const open = () => {
    root.dataset.rail = 'open';
    menuBtn.setAttribute('aria-expanded', 'true');
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.addEventListener('click', () => close(true));
    document.body.append(scrim);
    rail.querySelector('a')?.focus();
  };
  menuBtn.addEventListener('click', () => (root.dataset.rail === 'open' ? close(true) : open()));
  rail.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.dataset.rail === 'open') close(true); });
});

/* ---------- 侧栏：把当前条目滚进视野，并标出所属分组 ---------- */
safe(() => {
  if (!rail) return;
  const current = rail.querySelector('a[aria-current="true"]');
  if (!current) return;
  const grp = current.closest('.rail__grp');
  if (grp) grp.dataset.current = '1';
  // 只调侧栏自身的 scrollTop，不用 scrollIntoView（那会把整页一起滚走）
  const ar = current.getBoundingClientRect();
  const rr = rail.getBoundingClientRect();
  if (ar.top < rr.top + 40 || ar.bottom > rr.bottom - 40) {
    rail.scrollTop += ar.top - rr.top - rr.height / 3;
  }
});

/* ---------- 本页目录：当前项高亮 ----------
 * 不用 scroll 监听（每帧触发）。观测范围取「导航条以下整个视口」，
 * 当前小节 = 视口内最靠上的那个标题；视口内没有标题时保持上一状态，
 * 这正好对应「还在读最后经过的那个小节」，长小节不会滞留旧高亮，
 * 快速滚动或锚点跳转也不会漏掉标题。
 */
safe(() => {
  const tocLinks = [...document.querySelectorAll('.rail--toc a[href^="#"]')];
  if (!tocLinks.length || !('IntersectionObserver' in window)) return;

  const heads = tocLinks
    .map(a => document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))))
    .filter(Boolean);
  if (!heads.length) return;

  const setActive = (id) => tocLinks.forEach(a =>
    a.setAttribute('aria-current', a.getAttribute('href') === `#${id}` ? 'true' : 'false'));
  const navH = parseFloat(getComputedStyle(root).getPropertyValue('--nav-h')) || 64;
  const line = navH + 8;

  const visible = new Set();
  const io = new IntersectionObserver((rows) => {
    rows.forEach(r => (r.isIntersecting ? visible.add(r.target) : visible.delete(r.target)));
    if (!visible.size) return;
    const top = [...visible].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
    setActive(top.id);
  }, { rootMargin: `-${line}px 0px 0px 0px`, threshold: 0 });
  heads.forEach(h => io.observe(h));

  // 首屏可能没有标题进入观测区，先实测对齐一次
  const sync = () => {
    let current = heads[0];
    for (const h of heads) if (h.getBoundingClientRect().top <= line) current = h;
    setActive(current.id);
  };
  sync();
  addEventListener('resize', sync, { passive: true });
});

/* ---------- 滚动揭示（仅落地页标记了 data-reveal 的元素） ----------
 * 逐元素观测而非整块：阈值调低，避免超高容器永远不触发导致内容停在透明状态。
 * 无 IO 或用户要求减弱动效时直接显示。
 */
safe(() => {
  const revealables = [...document.querySelectorAll('[data-reveal]')];
  if (!revealables.length) return;
  const show = (el) => el.classList.add('is-in');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    revealables.forEach(show);
    return;
  }
  // 兜底：直接把已经在视口内的元素点亮。观测器只是加速器，不能是唯一真相，
  // 否则观测一旦失效（元素被裁成零面积等），内容会永久停在透明态、只留白。
  const sweep = () => revealables.forEach(el => {
    if (el.classList.contains('is-in')) return;
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight - 40 && r.bottom > 0) show(el);
  });
  const io = new IntersectionObserver((rows) => {
    rows.forEach(r => { if (r.isIntersecting) { show(r.target); io.unobserve(r.target); } });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0 });
  revealables.forEach(el => io.observe(el));
  sweep();
  addEventListener('resize', sweep, { passive: true });
});

/* ---------- 站内搜索 ----------
 * 索引按需拉取（首次打开才请求）：分节全文检索，命中节给出锚点与摘要。
 * 键盘遵循 combobox 模式：焦点留在输入框，用 aria-activedescendant 标出当前项。
 */
safe(() => {
  const findBtn = document.querySelector('[data-find-open]');
  const dlg = document.querySelector('.find__dlg');
  if (!findBtn || !dlg) return;

  const input = dlg.querySelector('input');
  const out = dlg.querySelector('.find__results');
  const status = dlg.querySelector('[data-find-status]');
  /** @type {{title:string,href:string,section:string,description:string,sections:{id:string,t:string,x:string}[]}[]} */
  let index = [];
  let load = null;
  let cursor = -1;
  let lastFocus = null;

  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = (s) => String(s).toLowerCase();

  /** 命中词高亮：先转义再定位，两侧同一套转义，偏移不会错位 */
  const mark = (text, needle) => {
    const hay = esc(text);
    const at = norm(hay).indexOf(norm(esc(needle)));
    if (at < 0) return hay;
    const n = esc(needle).length;
    return `${hay.slice(0, at)}<mark>${hay.slice(at, at + n)}</mark>${hay.slice(at + n)}`;
  };

  /** 摘要：以命中位置为中心开窗，避免总是截到开头 */
  const excerpt = (text, needle) => {
    const at = norm(text).indexOf(norm(needle));
    if (at < 0) return text.slice(0, 140);
    const start = Math.max(0, at - 44);
    const end = Math.min(text.length, start + 170);
    return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
  };

  /**
   * 打分：每一档都先确认「确实命中」才给分，否则会出现所有页面都拿正分、
   * 结果退化成全量的情况。返回最佳命中所在的小节，用于锚点与摘要。
   */
  const score = (p, needle) => {
    const title = norm(p.title);
    let best = 0;
    let hit = null;
    if (title.startsWith(needle)) best = 100;
    else if (title.includes(needle)) best = 70;
    if (!best && norm(p.href).includes(needle)) best = 42;

    for (const s of p.sections || []) {
      if (best < 26 && norm(s.t).includes(needle)) { best = 26; hit = s; }
      if (best < 14 && norm(s.x).includes(needle)) { best = 14; hit = s; }
    }
    if (best < 10 && norm(p.description || '').includes(needle)) best = 10;
    return { best, hit };
  };

  const build = (q) => {
    const needle = q.trim();
    if (!needle) return index.slice(0, 8).map(p => ({ p, hit: null, best: 0 }));
    const n = norm(needle);
    return index
      .map(p => ({ p, ...score(p, n) }))
      .filter(x => x.best > 0)
      .sort((a, b) => b.best - a.best || a.p.title.length - b.p.title.length)
      .slice(0, 12);
  };

  const render = (q) => {
    const items = build(q);
    cursor = -1;
    input.removeAttribute('aria-activedescendant');
    if (!items.length) {
      out.innerHTML = q.trim()
        ? `<li class="find__empty">没有匹配「${esc(q.trim())}」的页面</li>`
        : '<li class="find__empty">索引为空</li>';
      if (status) status.textContent = '没有匹配结果';
      return;
    }
    out.innerHTML = items.map(({ p, hit }, i) => {
      const href = esc(hit && hit.id ? `${p.href}#${hit.id}` : p.href);
      const sub = hit
        ? `<span class="hit">${mark(excerpt(hit.x, q), q)}</span>`
        : `<span class="hit">${mark(p.description || '', q)}</span>`;
      return `<li role="presentation"><a role="option" id="find-opt-${i}" aria-selected="false" href="${href}">`
        + `<span class="sec">${esc(hit ? `${p.section} · ${hit.t}` : p.section)}</span>`
        + `${mark(p.title, q)}${sub}</a></li>`;
    }).join('');
    if (status) status.textContent = `找到 ${items.length} 个结果`;
  };

  const ensure = () => (load ??= fetch('/search.json')
    .then(r => r.json())
    .then(d => { index = Array.isArray(d.pages) ? d.pages : []; })
    .catch(() => { index = []; }));

  const move = (delta) => {
    const opts = [...out.querySelectorAll('[role="option"]')];
    if (!opts.length) return;
    cursor = cursor < 0
      ? (delta > 0 ? 0 : opts.length - 1)
      : (cursor + delta + opts.length) % opts.length;
    opts.forEach((o, i) => o.setAttribute('aria-selected', i === cursor ? 'true' : 'false'));
    input.setAttribute('aria-activedescendant', opts[cursor].id);
    opts[cursor].scrollIntoView({ block: 'nearest' });
  };

  const show = () => {
    lastFocus = document.activeElement;
    dlg.hidden = false;
    findBtn.setAttribute('aria-expanded', 'true');
    input.focus();
    ensure().then(() => render(input.value));
  };
  const hide = () => {
    if (dlg.hidden) return;
    dlg.hidden = true;
    findBtn.setAttribute('aria-expanded', 'false');
    input.value = '';
    cursor = -1;
    if (lastFocus instanceof HTMLElement) lastFocus.focus();
  };

  findBtn.addEventListener('click', () => (dlg.hidden ? show() : hide()));
  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') {
      const active = cursor >= 0 ? out.querySelectorAll('[role="option"]')[cursor] : out.querySelector('[role="option"]');
      const href = active?.getAttribute('href');
      if (href) { e.preventDefault(); hide(); location.assign(href); }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hide();
    }
  });
  // 焦点锁在弹层内（弹层只有输入框与结果链接）
  dlg.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = [...dlg.querySelectorAll('a[href], input, button')];
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  // 点结果先收起弹层：同页锚点跳转不会重载页面，否则遮罩会留在原地
  out.addEventListener('click', (e) => { if (e.target.closest('a')) hide(); });
  dlg.addEventListener('click', (e) => { if (!e.target.closest('a') && !e.target.closest('input')) hide(); });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (dlg.hidden) show(); else hide();
    }
  });

  // 结构化数据里的 SearchAction 指向 ?q=，这里让该入口真的可用
  const q0 = new URLSearchParams(location.search).get('q');
  if (q0) {
    show();
    input.value = q0;
  }
});
