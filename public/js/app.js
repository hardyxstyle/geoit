// ГеоКомпас — рутер и обща рамка
import { api } from './api.js';
import { esc, $, icon, initials, roleName, classLabel } from './ui.js';
import * as views from './views.js';
import { usersView } from './users.js';
import { handleViewerPop } from './viewer.js';
import { progressView, studentProgressView } from './progress.js';
import { attemptView } from './quiz.js';
import { confirmLeave } from './ui.js';

export const APP_NAME = 'ГеоКомпас';

export const state = { user: null, pendingCount: 0 };

export async function refreshMe() {
  const data = await api('/me');
  state.user = data.user;
  state.pendingCount = data.pendingCount || 0;
}

export function go(path, { replace = false } = {}) {
  if (replace) history.replaceState({}, '', path);
  else history.pushState({}, '', path);
  render();
}

const isStaff = () => state.user && (state.user.role === 'teacher' || state.user.role === 'admin');

// ---------- Горна лента ----------
function renderTopbar() {
  const u = state.user;
  const active = u && u.status === 'active';
  const path = location.pathname;
  const cur = (p) => (path === p || path.startsWith(p + '-') ? 'aria-current="page"' : '');
  const nav = active
    ? `
      <button class="menu-toggle" aria-expanded="false" aria-controls="nav" aria-label="Меню">${icon.menu}</button>
      <nav class="nav" id="nav" aria-label="Основно меню">
        <a href="/s/klas-5" data-c="5" ${cur('/s/klas-5')}><span class="dot"></span>5. клас</a>
        <a href="/s/klas-6" data-c="6" ${cur('/s/klas-6')}><span class="dot"></span>6. клас</a>
        <a href="/s/klas-7" data-c="7" ${cur('/s/klas-7')}><span class="dot"></span>7. клас</a>
        <a href="/s/shkoli" data-c="x" ${cur('/s/shkoli')}><span class="dot"></span>Школи и състезания</a>
        <a href="/napredak" ${cur('/napredak')}>Напредък</a>
        <a href="/vrazki" ${cur('/vrazki')}>Връзки</a>
        <a href="/tarsene" class="mobile-only" ${cur('/tarsene')}>Търсене</a>
      </nav>`
    : '';
  const right = u
    ? `
      ${active ? `<form class="searchbox" role="search" action="/tarsene">${icon.search}
        <label class="visually-hidden" for="q">Търси тема</label>
        <input id="q" name="q" type="search" placeholder="Търси тема…" autocomplete="off"></form>` : ''}
      <div class="usermenu">
        <button class="userbtn" aria-haspopup="true" aria-expanded="false">
          <span class="avatar" aria-hidden="true">${esc(initials(u.name))}</span>
          <span class="uname">${esc(u.name.split(' ')[0])}</span>
          ${isStaff() && state.pendingCount ? `<span class="badge-count" aria-label="${state.pendingCount} чакащи">${state.pendingCount}</span>` : ''}
        </button>
        <div class="dropdown" role="menu">
          <div class="who"><strong>${esc(u.name)}</strong><span>${roleName[u.role]}${u.grade ? ', ' + esc(classLabel(u)) : ''}</span></div>
          ${active && isStaff() ? `<a href="/potrebiteli" role="menuitem">Потребители ${state.pendingCount ? `<span class="badge-count">${state.pendingCount}</span>` : ''}</a>` : ''}
          <a href="/profil" role="menuitem">Профил и парола</a>
          <button type="button" data-logout role="menuitem">Изход</button>
        </div>
      </div>`
    : `<a class="btn ghost small" href="/vhod">Вход</a><a class="btn small" href="/registracia">Регистрация</a>`;

  $('#topbar').innerHTML = `
    <div class="wrap">
      <a class="brand" href="/"><img src="/img/compass.svg" alt=""><span>${APP_NAME}</span></a>
      ${nav}
      <span class="spacer"></span>
      ${right}
    </div>`;
}

// ---------- Рутер ----------
const routes = [
  [/^\/$/, () => (state.user?.status === 'active' ? views.home() : views.landing())],
  [/^\/vhod$/, () => views.login()],
  [/^\/registracia$/, () => views.register()],
  [/^\/profil$/, () => views.profile(), 'user'],
  [/^\/potrebiteli$/, () => usersView(), 'staff'],
  [/^\/vrazki$/, () => views.links(), 'active'],
  [/^\/tarsene$/, () => views.search(), 'active'],
  [/^\/s\/([a-z0-9-]+)$/, (m) => views.section(m[1]), 'active'],
  [/^\/napredak$/, () => progressView(), 'active'],
  [/^\/napredak\/uchenik\/(\d+)$/, (m) => studentProgressView(m[1]), 'staff'],
  [/^\/opit\/(\d+)$/, (m) => attemptView(m[1]), 'active'],
];

export async function render() {
  const path = location.pathname;
  const u = state.user;
  const main = $('#main');

  // Задължителна смяна на временна парола
  if (u?.mustChangePassword && path !== '/profil') return go('/profil', { replace: true });
  // Вече влезлите нямат работа на вход/регистрация
  if (u && (path === '/vhod' || path === '/registracia')) return go('/', { replace: true });

  renderTopbar();
  main.innerHTML = '<div class="loading">Зареждане…</div>';

  for (const [re, view, need] of routes) {
    const m = path.match(re);
    if (!m) continue;
    if (need && !u) return go('/vhod?next=' + encodeURIComponent(path), { replace: true });
    if (need && need !== 'user' && u.status !== 'active') return views.pending(main);
    if (need === 'staff' && !isStaff()) return views.notFound(main);
    if (path === '/' && u && u.status !== 'active') return views.pending(main);
    try {
      await view(m)(main);
    } catch (err) {
      views.errorView(main, err);
    }
    window.scrollTo({ top: 0 });
    main.focus({ preventScroll: true });
    return;
  }
  views.notFound(main);
}

// ---------- Глобални събития ----------
document.addEventListener('click', async (e) => {
  const a = e.target.closest('a[href]');
  if (a && a.origin === location.origin && !a.target && !a.hasAttribute('download') && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
    if (a.pathname.startsWith('/api/')) return;
    e.preventDefault();
    if (!confirmLeave()) return;
    if (a.pathname === location.pathname && a.hash) {
      document.getElementById(decodeURIComponent(a.hash.slice(1)))?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    go(a.pathname + a.search + a.hash);
    return;
  }

  const userBtn = e.target.closest('.userbtn');
  const dd = $('.dropdown');
  if (userBtn) {
    const open = dd.classList.toggle('open');
    userBtn.setAttribute('aria-expanded', open);
    return;
  }
  if (dd && !e.target.closest('.dropdown')) dd.classList.remove('open');

  const toggle = e.target.closest('.menu-toggle');
  if (toggle) {
    const open = $('#nav').classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  }

  if (e.target.closest('[data-logout]')) {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    state.user = null;
    go('/');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') $('.dropdown')?.classList.remove('open');
});

document.addEventListener('submit', (e) => {
  if (e.target.matches('.searchbox, .searchbox-page')) {
    e.preventDefault();
    const q = new FormData(e.target).get('q').trim();
    if (q) go('/tarsene?q=' + encodeURIComponent(q));
  }
});

window.addEventListener('popstate', () => {
  if (handleViewerPop()) return;
  render();
});

(async function start() {
  try {
    await refreshMe();
  } catch {
    state.user = null;
  }
  render();
})();
