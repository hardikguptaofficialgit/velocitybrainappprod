const nav = document.getElementById('doc-nav');
const content = document.getElementById('doc-content');
const pageTitle = document.getElementById('page-title');
const pagePath = document.getElementById('page-path');
const searchInput = document.getElementById('doc-search');
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menu-toggle');
const tocNav = document.getElementById('toc-nav');
const themeToggle = document.getElementById('theme-toggle');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const ansiHero = document.getElementById('ansi-hero');
const statusApi = document.getElementById('status-api');
const statusPages = document.getElementById('status-pages');
const statusRuntimeUpdated = document.getElementById('status-runtime-updated');
const statusOpenClawCommand = document.getElementById('status-openclaw-command');
const statusOpenClawTools = document.getElementById('status-openclaw-tools');
const statusOpenClawSkills = document.getElementById('status-openclaw-skills');
const statusOpenClawFlow = document.getElementById('status-openclaw-flow');
const statusAuditCount = document.getElementById('status-audit-count');
const statusAuditLatest = document.getElementById('status-audit-latest');
const recentNav = document.getElementById('recent-nav');
const copyLinkBtn = document.getElementById('copy-link');
const STATUS_STALE_AFTER_MS = 60000;

let pages = [];
let currentSlug = '';
const pageIndex = new Map();
const RECENT_KEY = 'velocitybrain-guide-recent';

const ANSI_BANNER_LINES = [
  '██╗   ██╗███████╗██╗      ██████╗  ██████╗██╗████████╗██╗   ██╗',
  '██║   ██║██╔════╝██║     ██╔═══██╗██╔════╝██║╚══██╔══╝╚██╗ ██╔╝',
  '██║   ██║█████╗  ██║     ██║   ██║██║     ██║   ██║    ╚████╔╝ ',
  '╚██╗ ██╔╝██╔══╝  ██║     ██║   ██║██║     ██║   ██║     ╚██╔╝  ',
  ' ╚████╔╝ ███████╗███████╗╚██████╔╝╚██████╗██║   ██║      ██║   ',
  '  ╚═══╝  ╚══════╝╚══════╝ ╚═════╝  ╚═════╝╚═╝   ╚═╝      ╚═╝   ',
  '',
  '██████╗ ██████╗  █████╗ ██╗███╗   ██╗',
  '██╔══██╗██╔══██╗██╔══██╗██║████╗  ██║',
  '██████╔╝██████╔╝███████║██║██╔██╗ ██║',
  '██╔══██╗██╔══██╗██╔══██║██║██║╚██╗██║',
  '██████╔╝██║  ██║██║  ██║██║██║ ╚████║',
  '╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝',
];

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function renderAnsiBanner() {
  if (!ansiHero) {
    return;
  }

  const velocitySplit = 6;
  const wrapper = document.createDocumentFragment();
  let charIndex = 0;

  for (let i = 0; i < ANSI_BANNER_LINES.length; i += 1) {
    const line = ANSI_BANNER_LINES[i];
    const row = document.createElement('div');
    row.className = 'ansi-line';

    if (!line) {
      row.innerHTML = '&nbsp;';
      wrapper.appendChild(row);
      continue;
    }

    for (const ch of line) {
      const span = document.createElement('span');
      span.classList.add('ansi-char');
      span.textContent = ch;

      if (ch === '█') {
        span.classList.add('block', i < velocitySplit ? 'top' : 'bottom');
      } else if ('╗╝╚╔═║'.includes(ch)) {
        span.classList.add('edge');
      }

      const delay = Math.min(820, 6 * charIndex);
      span.style.transitionDelay = `${delay}ms`;
      row.appendChild(span);
      charIndex += 1;
    }

    wrapper.appendChild(row);
  }

  ansiHero.innerHTML = '';
  ansiHero.appendChild(wrapper);

  requestAnimationFrame(() => {
    for (const span of ansiHero.querySelectorAll('.ansi-char')) {
      span.classList.add('show');
    }
  });
}

function fallbackMarkdownToHtml(md) {
  const lines = md.replaceAll('\r\n', '\n').split('\n');
  const html = [];
  const toc = [];
  let inCode = false;
  let listType = '';

  const closeList = () => {
    if (listType) {
      html.push(listType === 'ol' ? '</ol>' : '</ul>');
      listType = '';
    }
  };

  for (const rawLine of lines) {
    const line = rawLine;

    if (line.startsWith('```')) {
      closeList();
      if (!inCode) {
        inCode = true;
        html.push('<pre><code>');
      } else {
        inCode = false;
        html.push('</code></pre>');
      }
      continue;
    }

    if (inCode) {
      html.push(`${escapeHtml(line)}\n`);
      continue;
    }

    if (!line.trim()) {
      closeList();
      html.push('');
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slugify(text) || `section-${toc.length + 1}`;
      toc.push({ id, text, level });
      html.push(`<h${level} id="${id}">${escapeHtml(text)}</h${level}>`);
      continue;
    }

    const orderedItem = line.match(/^\d+\.\s+(.*)$/);
    if (orderedItem) {
      if (listType !== 'ol') {
        closeList();
        listType = 'ol';
        html.push('<ol>');
      }
      html.push(`<li>${escapeHtml(orderedItem[1])}</li>`);
      continue;
    }

    const bulletItem = line.match(/^[-*]\s+(.*)$/);
    if (bulletItem) {
      if (listType !== 'ul') {
        closeList();
        listType = 'ul';
        html.push('<ul>');
      }
      html.push(`<li>${escapeHtml(bulletItem[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${escapeHtml(line)}</p>`);
  }

  closeList();
  return { html: html.join('\n'), toc };
}

function markdownToHtml(md) {
  const source = md || '';
  if (!window.marked) {
    return fallbackMarkdownToHtml(source);
  }

  marked.setOptions({
    gfm: true,
    breaks: false,
    mangle: false,
    headerIds: false,
  });

  const raw = marked.parse(source);
  const safe = window.DOMPurify ? window.DOMPurify.sanitize(raw) : raw;

  const container = document.createElement('div');
  container.innerHTML = safe;
  const toc = [];
  for (const heading of container.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    const level = Number(heading.tagName.slice(1));
    const text = heading.textContent?.trim() || '';
    const id = slugify(text) || `section-${toc.length + 1}`;
    heading.id = id;
    toc.push({ id, text, level });
  }

  for (const link of container.querySelectorAll('a')) {
    const href = link.getAttribute('href') || '';
    if (/^https?:\/\//i.test(href)) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
      for (const img of container.querySelectorAll('img')) {
        const src = img.getAttribute('src') || '';
        if (src.startsWith('docs/assets/')) {
          img.setAttribute('src', '/guide/static/assets/' + src.replace('docs/assets/', ''));
        }
      }

    }
  }

  return { html: container.innerHTML, toc };
}

function highlightCodeBlocks() {
  const keywordRegex = /\b(const|let|var|function|return|if|else|for|while|class|def|import|from|as|try|except|raise|SELECT|FROM|WHERE|ORDER|BY|LIMIT|INSERT|UPDATE|DELETE|CREATE|TABLE|INDEX|JOIN)\b/g;
  const numberRegex = /\b\d+(?:\.\d+)?\b/g;
  const stringRegex = /("[^"]*"|'[^']*')/g;
  const commentRegex = /(#[^\n]*|\/\/[^\n]*)/g;
  const builtinRegex = /\b(true|false|null|None|True|False|JSON|GET|POST)\b/g;

  for (const block of content.querySelectorAll('pre code')) {
    const original = block.textContent || '';
    let html = escapeHtml(original);
    html = html.replace(commentRegex, '<span class="tok-comment">$1</span>');
    html = html.replace(stringRegex, '<span class="tok-string">$1</span>');
    html = html.replace(keywordRegex, '<span class="tok-keyword">$1</span>');
    html = html.replace(numberRegex, '<span class="tok-number">$&</span>');
    html = html.replace(builtinRegex, '<span class="tok-builtin">$1</span>');
    block.innerHTML = html;
  }
}

function renderToc(items) {
  const useful = items.filter((item) => item.level >= 2 && item.level <= 4);
  if (!useful.length) {
    tocNav.innerHTML = '<p class="empty-state">No headings on this page.</p>';
    return;
  }

  tocNav.innerHTML = useful
    .map((item) => `<a class="toc-link depth-${item.level}" href="#${currentSlug}/${item.id}" data-target="${item.id}">${item.text}</a>`)
    .join('');

  for (const link of tocNav.querySelectorAll('.toc-link')) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const id = event.currentTarget.getAttribute('data-target');
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', `#${currentSlug}/${id}`);
      }
    });
  }
}

function groupPages(items) {
  const grouped = new Map();
  for (const page of items) {
    const key = page.category || 'General';
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(page);
  }
  return grouped;
}

function saveRecentSlug(slug) {
  if (!slug) {
    return;
  }
  const existing = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  const next = [slug, ...existing.filter((value) => value !== slug)].slice(0, 6);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  renderRecentPages();
}

function renderRecentPages() {
  if (!recentNav) {
    return;
  }
  const saved = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  const recentPages = saved
    .map((slug) => pages.find((page) => page.slug === slug))
    .filter((page) => Boolean(page));

  if (!recentPages.length) {
    recentNav.innerHTML = '<p class="empty-state">No recent pages yet.</p>';
    return;
  }

  recentNav.innerHTML = recentPages
    .map((page) => `<a class="recent-link" href="#${page.slug}" data-slug="${page.slug}">${escapeHtml(page.title)}</a>`)
    .join('');

  for (const link of recentNav.querySelectorAll('.recent-link')) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      window.location.hash = event.currentTarget.getAttribute('data-slug');
      if (window.innerWidth <= 920) {
        sidebar.classList.remove('open');
      }
    });
  }
}

function renderAuditLatestEvent(event) {
  if (!event) {
    return 'No recent audit events';
  }
  const parts = [event.event_type, event.actor, event.created_at].filter(Boolean);
  return parts.length ? parts.join(' • ') : 'No recent audit events';
}

function renderRuntimeUpdated(value) {
  if (!value) {
    return 'Unknown';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }
  return date.toLocaleString();
}

function runtimeStatusFreshness(value) {
  if (!value) {
    return { stale: true, ageMs: Number.POSITIVE_INFINITY };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { stale: true, ageMs: Number.POSITIVE_INFINITY };
  }
  const ageMs = Date.now() - date.getTime();
  return { stale: ageMs > STATUS_STALE_AFTER_MS, ageMs };
}

function renderRuntimeAge(ageMs) {
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return '';
  }
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

async function updateRuntimeStatus() {
  if (!statusApi || !statusPages) {
    return;
  }

  statusPages.textContent = String(pages.length || 0);

  try {
    const response = await fetch('/v1/runtime/status?audit_limit=5');
    if (!response.ok) {
      throw new Error('Runtime status unavailable');
    }

    const payload = await response.json();
    const healthOk = Boolean(payload.health && payload.health.ok);
    statusApi.textContent = healthOk ? 'Online' : 'Degraded';
    if (statusRuntimeUpdated) {
      const freshness = runtimeStatusFreshness(payload.generated_at);
      const updated = renderRuntimeUpdated(payload.generated_at);
      const age = renderRuntimeAge(freshness.ageMs);
      statusRuntimeUpdated.textContent = age ? `${updated} (${age})` : updated;
      statusRuntimeUpdated.classList.toggle('is-stale', freshness.stale);
      if (healthOk && freshness.stale) {
        statusApi.textContent = 'Stale';
      }
    }

    if (statusOpenClawCommand && statusOpenClawTools && statusOpenClawSkills && statusOpenClawFlow) {
      const server = payload.openclaw && payload.openclaw.server ? payload.openclaw.server : {};
      const cmd = [server.command, ...(Array.isArray(server.args) ? server.args : [])].filter(Boolean).join(' ');
      statusOpenClawCommand.textContent = cmd || 'Unavailable';
      statusOpenClawTools.textContent = String(payload.openclaw?.tool_count ?? '-');
      statusOpenClawSkills.textContent = String(payload.openclaw?.skill_count ?? '-');
      const flow = Array.isArray(payload.openclaw?.recommended_smoke_flow) ? payload.openclaw.recommended_smoke_flow : [];
      statusOpenClawFlow.textContent = flow.length ? flow.join(' -> ') : 'No smoke flow configured';
    }

    if (statusAuditCount && statusAuditLatest) {
      const audit = payload.audit || {};
      if (audit.available === false) {
        statusAuditCount.textContent = '-';
        statusAuditLatest.textContent = 'Audit trail unavailable';
      } else {
        statusAuditCount.textContent = String(audit.count ?? 0);
        statusAuditLatest.textContent = renderAuditLatestEvent(audit.latest_event);
      }
    }
  } catch (_error) {
    statusApi.textContent = 'Offline';
    if (statusRuntimeUpdated) {
      statusRuntimeUpdated.textContent = 'Unavailable';
      statusRuntimeUpdated.classList.add('is-stale');
    }

    if (statusOpenClawCommand && statusOpenClawTools && statusOpenClawSkills && statusOpenClawFlow) {
      statusOpenClawCommand.textContent = 'Unavailable';
      statusOpenClawTools.textContent = '-';
      statusOpenClawSkills.textContent = '-';
      statusOpenClawFlow.textContent = 'OpenClaw profile unavailable';
    }

    if (statusAuditCount && statusAuditLatest) {
      statusAuditCount.textContent = '-';
      statusAuditLatest.textContent = 'Audit trail unavailable';
    }
  }
}

function bindCopyLink() {
  if (!copyLinkBtn) {
    return;
  }
  copyLinkBtn.addEventListener('click', async () => {
    const link = `${window.location.origin}${window.location.pathname}${window.location.hash || `#${currentSlug}`}`;
    try {
      await navigator.clipboard.writeText(link);
      copyLinkBtn.textContent = 'Copied';
      setTimeout(() => {
        copyLinkBtn.textContent = 'Copy Link';
      }, 1000);
    } catch (_error) {
      copyLinkBtn.textContent = 'Failed';
      setTimeout(() => {
        copyLinkBtn.textContent = 'Copy Link';
      }, 1000);
    }
  });
}

function attachCopyButtons() {
  for (const pre of content.querySelectorAll('pre')) {
    if (pre.querySelector('.copy-code')) {
      continue;
    }
    const button = document.createElement('button');
    button.className = 'copy-code';
    button.type = 'button';
    button.textContent = 'Copy';
    button.addEventListener('click', async () => {
      const code = pre.querySelector('code');
      const text = code ? code.textContent || '' : pre.textContent || '';
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = 'Copied';
        setTimeout(() => {
          button.textContent = 'Copy';
        }, 1200);
      } catch (_error) {
        button.textContent = 'Failed';
        setTimeout(() => {
          button.textContent = 'Copy';
        }, 1200);
      }
    });
    pre.appendChild(button);
  }
}

function renderNav(filteredPages) {
  if (!filteredPages.length) {
    nav.innerHTML = '<p class="empty-state">No docs pages match your search.</p>';
    return;
  }

  const groups = groupPages(filteredPages);
  const chunks = [];

  for (const [groupName, groupPagesList] of groups.entries()) {
    chunks.push('<section class="doc-group">');
    chunks.push(`<h3 class="doc-group-title">${escapeHtml(groupName)}</h3>`);
    chunks.push('<div class="doc-group-links">');
    for (const page of groupPagesList) {
      chunks.push(
        `<a class="doc-link ${page.slug === currentSlug ? 'active' : ''}" href="#${page.slug}" data-slug="${page.slug}">${page.title}</a>`,
      );
    }
    chunks.push('</div>');
    chunks.push('</section>');
  }

  nav.innerHTML = chunks.join('');

  for (const link of nav.querySelectorAll('.doc-link')) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const slug = event.currentTarget.getAttribute('data-slug');
      window.location.hash = slug;
      if (window.innerWidth <= 920) {
        sidebar.classList.remove('open');
      }
    });
  }
}

async function loadPages() {
  const response = await fetch('/v1/docs/pages');
  if (!response.ok) {
    throw new Error('Unable to load docs page list');
  }
  const payload = await response.json();
  pages = payload.pages || [];
  return pages;
}

async function loadPage(slug) {
  const response = await fetch(`/v1/docs/page/${encodeURIComponent(slug)}`);
  if (!response.ok) {
    throw new Error(`Unable to load docs page: ${slug}`);
  }
  return response.json();
}

async function showPage(slug) {
  const target = pages.find((p) => p.slug === slug) || pages[0];
  if (!target) {
    pageTitle.textContent = 'No docs pages available';
    content.innerHTML = '<p class="empty-state">Add Markdown files in docs/ to start building your guide.</p>';
    return;
  }

  let page = pageIndex.get(target.slug);
  if (!page) {
    page = await loadPage(target.slug);
    pageIndex.set(target.slug, page);
  }
  currentSlug = target.slug;
  saveRecentSlug(currentSlug);
  pageTitle.textContent = page.title;
  pagePath.textContent = page.path;
  const rendered = markdownToHtml(page.markdown || '');
  content.innerHTML = rendered.html;
  highlightCodeBlocks();
  renderToc(rendered.toc);
  attachCopyButtons();
  const query = searchInput.value.trim().toLowerCase();
  const filtered = pages.filter((p) => {
    const indexed = pageIndex.get(p.slug);
    const body = indexed?.markdown?.toLowerCase() || '';
    return p.title.toLowerCase().includes(query) || p.slug.includes(query) || body.includes(query);
  });
  renderNav(filtered);
  updatePagerState();
}

function getCurrentPageIndex() {
  return pages.findIndex((page) => page.slug === currentSlug);
}

function updatePagerState() {
  const index = getCurrentPageIndex();
  prevPageBtn.disabled = index <= 0;
  nextPageBtn.disabled = index < 0 || index >= pages.length - 1;
}

async function jumpRelative(offset) {
  const index = getCurrentPageIndex();
  if (index < 0) {
    return;
  }
  const target = pages[index + offset];
  if (!target) {
    return;
  }
  window.location.hash = target.slug;
}

function bindPager() {
  prevPageBtn.addEventListener('click', async () => {
    await jumpRelative(-1);
  });
  nextPageBtn.addEventListener('click', async () => {
    await jumpRelative(1);
  });
}

function bindSearch() {
  searchInput.addEventListener('input', async () => {
    const query = searchInput.value.trim().toLowerCase();
    if (query.length >= 2) {
      await Promise.all(
        pages.map(async (page) => {
          if (!pageIndex.has(page.slug)) {
            try {
              pageIndex.set(page.slug, await loadPage(page.slug));
            } catch (_error) {
              // Ignore non-critical page index failures during search.
            }
          }
        }),
      );
    }

    const filtered = pages.filter((p) => {
      const indexed = pageIndex.get(p.slug);
      const body = indexed?.markdown?.toLowerCase() || '';
      return p.title.toLowerCase().includes(query) || p.slug.includes(query) || body.includes(query);
    });

    renderNav(filtered);
  });
}

function isTypingContext() {
  const el = document.activeElement;
  if (!el) {
    return false;
  }
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || el.isContentEditable;
}

function bindKeyboardShortcuts() {
  window.addEventListener('keydown', async (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }

    if (!isTypingContext() && event.key === '/') {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }

    if (isTypingContext()) {
      return;
    }

    if (event.key === '[') {
      event.preventDefault();
      await jumpRelative(-1);
      return;
    }

    if (event.key === ']') {
      event.preventDefault();
      await jumpRelative(1);
      return;
    }

    if (event.key.toLowerCase() === 't') {
      event.preventDefault();
      themeToggle.click();
    }
  });
}

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? 'Light' : 'Dark';
}

function bindTheme() {
  const stored = localStorage.getItem('velocitybrain-guide-theme');
  const preferred = stored || 'light';
  applyTheme(preferred);
  themeToggle.addEventListener('click', () => {
    const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem('velocitybrain-guide-theme', next);
    applyTheme(next);
  });
}

function resolveStart() {
  const hash = window.location.hash.slice(1);
  if (!hash) {
    return { slug: '', headingId: '' };
  }
  const [slug, headingId] = hash.split('/');
  return { slug: slug || '', headingId: headingId || '' };
}

async function boot() {
  try {
    renderAnsiBanner();
    await loadPages();
    renderRecentPages();
    bindCopyLink();
    bindTheme();
    bindSearch();
    bindPager();
    bindKeyboardShortcuts();
    await updateRuntimeStatus();
    window.setInterval(updateRuntimeStatus, 30000);
    const start = resolveStart();
    await showPage(start.slug || pages[0]?.slug || '');
    if (start.headingId) {
      document.getElementById(start.headingId)?.scrollIntoView({ behavior: 'auto', block: 'start' });
    }

    window.addEventListener('hashchange', async () => {
      const next = resolveStart();
      await showPage(next.slug || pages[0]?.slug || '');
      if (next.headingId) {
        document.getElementById(next.headingId)?.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    });

    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  } catch (error) {
    pageTitle.textContent = 'Guide failed to load';
    content.innerHTML = `<p class="empty-state">${escapeHtml(String(error))}</p>`;
  }
}

boot();
