// Страници на ГеоКомпас
import { api } from './api.js';
import { state, go, refreshMe, render, APP_NAME } from './app.js';
import { esc, $, $$, toast, icon, reliefSvg, animateRelief, plural, classLabel } from './ui.js';
import { materialsPanel, itemHtml, bindFileActions, TAB_NAMES } from './materials.js';
import { lessonPanel, hasUnsavedLesson } from './lesson.js';

const gradeKey = (s) => (s.grade ? String(s.grade) : 'x');
const setTitle = (t) => (document.title = t ? `${t} — ${APP_NAME}` : `${APP_NAME} — география за 5.–7. клас`);
const isStaff = () => state.user && (state.user.role === 'teacher' || state.user.role === 'admin');

const footer = () => `
  <footer class="footer"><div class="wrap">
    <span>${APP_NAME}, ППМГ „Акад. Никола Обрешков“, Бургас</span>
    <span>Съдържанието следва учебните програми на МОН за 5.–7. клас</span>
  </div></footer>`;

function bindForm(form, handler) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('.error-box', form);
    const btn = $('button[type="submit"]', form);
    err.textContent = '';
    btn.disabled = true;
    try {
      await handler(Object.fromEntries(new FormData(form)));
    } catch (ex) {
      err.textContent = ex.message;
    } finally {
      btn.disabled = false;
    }
  });
}

// ---------- Начало за гости ----------
export function landing() {
  return (main) => {
    setTitle();
    main.innerHTML = `
      <section class="hero"><div class="wrap">
        <div>
          <h1>Цялата география за 5.–7. клас на едно място</h1>
          <p class="lead">Уроци, карти, задачи и материали, подредени по учебната програма. Учениците знаят къде да търсят, учителите — къде да качат.</p>
          <div class="actions">
            <a class="btn" href="/registracia">Създай профил</a>
            <a class="btn ghost" href="/vhod">Вече имам профил</a>
          </div>
        </div>
        ${reliefSvg()}
      </div></section>
      <section class="section-block"><div class="wrap">
        <div class="features">
          <div><h3>Подредено по програмата</h3><p>Всеки клас е разделен на теми и уроци точно както в учебната програма на МОН.</p></div>
          <div><h3>Карти и задачи към всеки урок</h3><p>Към урока стоят картите, инфографиките, тестовете и домашните — без да ги търсиш в чатове и имейли.</p></div>
          <div><h3>Школи и олимпиади</h3><p>Отделно място за подготовката за олимпиадата, школата и конкурсите.</p></div>
        </div>
      </div></section>
      ${footer()}`;
    animateRelief(main);
  };
}

// ---------- Вход ----------
export function login() {
  return (main) => {
    setTitle('Вход');
    main.innerHTML = `
      <div class="auth"><div class="auth-card">
        <h1>Вход</h1>
        <p class="sub">С имейла и паролата, с които си се регистрирал.</p>
        <form class="form" novalidate>
          <div class="field"><label for="email">Имейл</label>
            <input class="input" id="email" name="email" type="email" autocomplete="email" required></div>
          <div class="field"><label for="password">Парола</label>
            <input class="input" id="password" name="password" type="password" autocomplete="current-password" required></div>
          <div class="error-box" role="alert"></div>
          <button class="btn" type="submit">Влез</button>
        </form>
        <p class="alt">Нямаш профил? <a href="/registracia">Регистрирай се</a><br>
        Забравена парола? Учителят ти може да ти даде нова.</p>
      </div></div>`;
    bindForm($('form', main), async (data) => {
      await api('/auth/login', { method: 'POST', body: data });
      await refreshMe();
      const next = new URLSearchParams(location.search).get('next');
      go(next && next.startsWith('/') && !next.startsWith('//') ? next : '/', { replace: true });
    });
    $('#email', main).focus();
  };
}

// ---------- Регистрация ----------
export function register() {
  return (main) => {
    setTitle('Регистрация');
    main.innerHTML = `
      <div class="auth"><div class="auth-card">
        <h1>Регистрация</h1>
        <p class="sub">Учител ще одобри профила ти и след това ще виждаш всичко.</p>
        <form class="form" novalidate>
          <fieldset class="field" style="border:0;padding:0;margin:0">
            <legend class="label" style="margin-bottom:.35rem">Аз съм</legend>
            <div class="segmented">
              <input type="radio" id="r-student" name="role" value="student" checked><label for="r-student">Ученик</label>
              <input type="radio" id="r-teacher" name="role" value="teacher"><label for="r-teacher">Учител</label>
            </div>
          </fieldset>
          <div class="field"><label for="name">Име и фамилия</label>
            <input class="input" id="name" name="name" autocomplete="name" required maxlength="80"></div>
          <div class="student-only form" style="gap:1.1rem">
            <fieldset class="field" style="border:0;padding:0;margin:0">
              <legend class="label" style="margin-bottom:.35rem">Клас</legend>
              <div class="segmented grades" style="--n:3">
                <input type="radio" id="g5" name="grade" value="5"><label for="g5" data-c="5">5.<small>клас</small></label>
                <input type="radio" id="g6" name="grade" value="6"><label for="g6" data-c="6">6.<small>клас</small></label>
                <input type="radio" id="g7" name="grade" value="7"><label for="g7" data-c="7">7.<small>клас</small></label>
              </div>
            </fieldset>
            <div class="field"><label for="classLetter">Паралелка</label>
              <input class="input" id="classLetter" name="classLetter" maxlength="1" placeholder="напр. А" style="max-width:8rem" autocomplete="off">
            </div>
          </div>
          <div class="field"><label for="email">Имейл</label>
            <input class="input" id="email" name="email" type="email" autocomplete="email" required></div>
          <div class="field"><label for="password">Парола</label>
            <input class="input" id="password" name="password" type="password" autocomplete="new-password" minlength="8" required>
            <span class="hint">Поне 8 символа.</span></div>
          <div class="error-box" role="alert"></div>
          <button class="btn" type="submit">Създай профил</button>
        </form>
        <p class="alt">Вече имаш профил? <a href="/vhod">Влез</a></p>
      </div></div>`;
    const form = $('form', main);
    const studentOnly = $('.student-only', form);
    form.addEventListener('change', () => {
      studentOnly.hidden = form.role.value !== 'student';
    });
    bindForm(form, async (data) => {
      if (data.role === 'student' && !data.grade) throw new Error('Избери в кой клас си.');
      await api('/auth/register', { method: 'POST', body: data });
      await refreshMe();
      go('/', { replace: true });
    });
    $('#name', main).focus();
  };
}

// ---------- Чака одобрение ----------
export function pending(main) {
  setTitle('Чака одобрение');
  const u = state.user;
  const who = u.role === 'teacher' ? 'администраторът' : 'учител по география';
  main.innerHTML = `
    <div class="auth"><div class="auth-card" style="text-align:center">
      <div class="pending-map" style="color:var(--g5)">${icon.map}</div>
      <h1>Профилът чака одобрение</h1>
      <p class="sub">Здравей, ${esc(u.name.split(' ')[0])}! Щом ${who} одобри профила ти, ще виждаш уроците, картите и материалите.</p>
      <button class="btn ghost" type="button" id="recheck">Провери отново</button>
    </div></div>`;
  $('#recheck', main).addEventListener('click', async () => {
    await refreshMe();
    if (state.user?.status === 'active') {
      toast('Профилът е одобрен. Добре дошъл!');
      render();
    } else toast('Още чака одобрение.');
  });
}

// ---------- Табло ----------
const legendItem = (s, extra = '') => `
  <a class="legend-item" href="/s/${esc(s.slug)}" data-c="${gradeKey(s)}">
    <span class="swatch"><span>${s.grade || '★'}</span></span>
    <span><h3>${esc(s.title)}</h3><p>${esc(s.summary || '')}</p></span>
    <span class="meta">${extra}</span>
  </a>`;

export function home() {
  return async (main) => {
    setTitle();
    const [{ sections }, { links }, { materials: recent }] = await Promise.all([
      api('/overview'),
      api('/links'),
      api('/materials/recent').catch(() => ({ materials: [] })),
    ]);
    const u = state.user;
    const grades = sections.filter((s) => s.kind === 'grade');
    const areas = sections.filter((s) => s.kind === 'area');
    // Ученикът вижда своя клас най-отгоре
    if (u.role === 'student' && u.grade) grades.sort((a, b) => (b.grade === u.grade) - (a.grade === u.grade));
    const first = u.name.split(' ')[0];

    main.innerHTML = `
      <div class="wrap dash">
        <div class="greet">
          <div>
            <h1>Здравей, ${esc(first)}</h1>
            <p>${u.role === 'student' ? `${esc(classLabel(u))}. Избери тема и започни.` : 'Избери клас, за да видиш темите и материалите.'}</p>
          </div>
        </div>
        ${isStaff() && state.pendingCount ? `
          <div class="notice">
            <span><strong>${plural(state.pendingCount, 'нов профил чака', 'нови профила чакат')}</strong> твоето одобрение.</span>
            <a class="btn small" href="/potrebiteli">Прегледай</a>
          </div>` : ''}
        <div class="two-col">
          <section class="legend" aria-labelledby="legend-h">
            <div class="legend-title"><h2 id="legend-h">Легенда</h2><p>Класове и раздели</p></div>
            ${grades.map((g) => legendItem(g, `${plural(g.grandchildren, 'урок', 'урока')}${u.grade === g.grade && u.role === 'student' ? '<br>твоят клас' : ''}`)).join('')}
            ${areas.map((a) => legendItem(a, plural(a.children, 'раздел', 'раздела'))).join('')}
          </section>
          <div class="side">
          <section class="panel recent" aria-labelledby="recent-h">
            <h2 id="recent-h">Нови материали</h2>
            ${recent.length
              ? `<ul class="mat-list compact">${recent.map((m) => itemHtml(m, { showSection: true })).join('')}</ul>`
              : `<p class="muted">${isStaff() ? 'Още няма качени материали. Отвори урок → „Материали“ → „Качи файл“.' : 'Тук ще се появяват новите материали от учителите.'}</p>`}
          </section>
          <aside class="panel">
            <h2>Полезни връзки</h2>
            <ul class="linklist">
              ${links.slice(0, 6).map((l) => `<li><a href="${esc(l.url)}" rel="noopener">${esc(l.title)}<small>${esc(l.description || '')}</small></a></li>`).join('')}
            </ul>
            <p style="margin-top:.9rem"><a href="/vrazki">Всички връзки</a></p>
          </aside>
          </div>
        </div>
      </div>
      ${footer()}`;
    const recentBox = $('.recent', main);
    if (recentBox) bindFileActions(recentBox, () => recent);
  };
}

// ---------- Раздел (клас, тема, урок, школи) ----------
export function section(slug) {
  return async (main) => {
    const data = await api('/sections/' + encodeURIComponent(slug));
    const s = data.section;
    setTitle(s.code ? `${s.code} ${s.title}` : s.title);
    if (s.kind === 'grade') return gradeView(main, data);
    if (s.kind === 'area') return areaView(main, data);
    if (s.kind === 'theme') return themeView(main, data);
    return topicView(main, data);
  };
}

const crumbsHtml = (crumbs, current) => `
  <ol class="crumbs" aria-label="Път">
    <li><a href="/">Начало</a></li>
    ${crumbs.map((c) => `<li><a href="/s/${esc(c.slug)}">${esc(c.title)}</a></li>`).join('')}
    <li aria-current="page">${esc(current)}</li>
  </ol>`;

function gradeView(main, { section: s, children }) {
  const topicCount = children.reduce((n, c) => n + c.topics.length, 0);
  main.innerHTML = `
    <div data-c="${gradeKey(s)}">
      <header class="grade-head"><div class="wrap">
        ${crumbsHtml([], s.title)}
        <h1>${esc(s.title)}</h1>
        <p>${esc(s.summary || '')}</p>
        <div class="stats"><span><b>${children.length}</b>${children.length === 1 ? 'тема' : 'теми'}</span><span><b>${topicCount}</b>урока</span></div>
      </div></header>
      <div class="wrap grade-body">
        <nav class="toc" aria-label="Теми">
          <h2>Теми</h2>
          <ol>${children.map((c, i) => `<li><a href="#tema-${i + 1}">${esc(c.title)}</a></li>`).join('')}</ol>
        </nav>
        <div>
          ${children.map((c, i) => `
            <section class="theme" id="tema-${i + 1}" aria-labelledby="th-${i}">
              <div class="theme-head">
                <span class="num">${i + 1}</span>
                <div><h2 id="th-${i}"><a href="/s/${esc(c.slug)}" style="text-decoration:none">${esc(c.title)}</a></h2><p>${esc(c.summary || '')}</p></div>
              </div>
              <ol class="topics">
                ${c.topics.map((t) => `
                  <li><a href="/s/${esc(t.slug)}">
                    <span class="code">${esc(t.code || '')}</span>
                    <span>${esc(t.title)}</span>
                    <span class="state ${t.materials ? 'has' : ''}">${t.materials ? plural(t.materials, 'материал', 'материала') : ''}</span>
                  </a></li>`).join('')}
              </ol>
            </section>`).join('')}
        </div>
      </div>
    </div>
    ${footer()}`;
}

function themeView(main, { section: s, crumbs, children }) {
  main.innerHTML = `
    <div data-c="${gradeKey(s)}">
      <header class="grade-head"><div class="wrap">
        ${crumbsHtml(crumbs, s.title)}
        <h1>${esc(s.title)}</h1>
        <p>${esc(s.summary || '')}</p>
      </div></header>
      <div class="wrap" style="padding:2rem 0 3rem; max-width:820px">
        <ol class="topics">
          ${children.map((t) => `<li><a href="/s/${esc(t.slug)}"><span class="code">${esc(t.code || '')}</span><span>${esc(t.title)}</span></a></li>`).join('')}
        </ol>
      </div>
    </div>
    ${footer()}`;
}

function areaView(main, { section: s, children }) {
  main.innerHTML = `
    <div data-c="x">
      <header class="grade-head"><div class="wrap">
        ${crumbsHtml([], s.title)}
        <h1>${esc(s.title)}</h1>
        <p>${esc(s.summary || '')}</p>
      </div></header>
      <div class="wrap" style="padding:2rem 0 3rem">
        <section class="legend">
          ${children.map((c) => legendItem({ ...c, grade: null })).join('')}
        </section>
      </div>
    </div>
    ${footer()}`;
}

// Табовете на урока
const TABS = Object.entries(TAB_NAMES).map(([id, label]) => ({ id, label }));

function topicView(main, { section: s, crumbs, prev, next, materials }) {
  let mats = materials || [];
  const count = (id) => mats.filter((m) => (m.tab || 'materiali') === id).length;
  const tabLabel = (t) => (t.id !== 'urok' && count(t.id) ? `${t.label} (${count(t.id)})` : t.label);
  const start = TABS.find((t) => '#' + t.id === location.hash) || TABS[0];

  main.innerHTML = `
    <div data-c="${gradeKey(s)}">
      <header class="topic-head"><div class="wrap">
        ${crumbsHtml(crumbs, s.title)}
        <div class="title-row">
          ${s.code ? `<span class="bigcode" aria-hidden="true">${esc(s.code)}</span>` : ''}
          <div><h1>${esc(s.title)}</h1>${s.summary ? `<p style="color:var(--ink-soft);margin-top:.5rem;max-width:60ch">${esc(s.summary)}</p>` : ''}</div>
        </div>
        <div class="tabs" role="tablist" aria-label="Части на урока">
          ${TABS.map((t) => `<button role="tab" id="tab-${t.id}" aria-controls="panel" aria-selected="${t === start}" tabindex="${t === start ? 0 : -1}" data-tab="${t.id}">${tabLabel(t)}</button>`).join('')}
        </div>
      </div></header>
      <div class="wrap topic-body">
        <div class="topic-main">
          <div id="panel" role="tabpanel" aria-labelledby="tab-${start.id}"></div>
          <nav class="pager" aria-label="Съседни уроци">
            ${prev ? `<a href="/s/${esc(prev.slug)}"><small>Предишен</small>${esc((prev.code ? prev.code + ' ' : '') + prev.title)}</a>` : ''}
            ${next ? `<a class="next" href="/s/${esc(next.slug)}"><small>Следващ</small>${esc((next.code ? next.code + ' ' : '') + next.title)}</a>` : ''}
          </nav>
        </div>
        ${s.goals.length ? `
          <aside class="goals">
            <h2>${s.kind === 'topic' ? 'Какво ще научиш' : 'Какво ще намериш тук'}</h2>
            <ul>${s.goals.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>
          </aside>` : ''}
      </div>
    </div>
    ${footer()}`;

  const tabs = $$('[role="tab"]', main);
  const panel = $('#panel', main);
  const onMaterialsChange = (list) => {
    mats = list;
    tabs.forEach((b) => (b.textContent = tabLabel(TABS.find((t) => t.id === b.dataset.tab))));
  };
  const show = (tab) => {
    panel.setAttribute('aria-labelledby', 'tab-' + tab.id);
    // нов контейнер всеки път, за да не се трупат слушатели
    panel.innerHTML = '<div></div>';
    if (tab.id === 'urok') lessonPanel(panel.firstChild, { section: s, materials: mats, onMaterialsChange });
    else materialsPanel(panel.firstChild, { slug: s.slug, tab: tab.id, all: mats, onChange: onMaterialsChange });
  };
  const select = (btn) => {
    if (btn.getAttribute('aria-selected') === 'true') return;
    if (hasUnsavedLesson() && !window.confirm('Имаш незапазени промени в урока. Да ги изоставя ли?')) return;
    tabs.forEach((b) => {
      b.setAttribute('aria-selected', b === btn);
      b.tabIndex = b === btn ? 0 : -1;
    });
    const tab = TABS.find((t) => t.id === btn.dataset.tab);
    history.replaceState(history.state, '', location.pathname + location.search + (tab === TABS[0] ? '' : '#' + tab.id));
    show(tab);
  };
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => select(b));
    b.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      const nb = tabs[(i + d + tabs.length) % tabs.length];
      nb.focus();
      select(nb);
    });
  });
  show(start);
}

// ---------- Връзки ----------
export function links() {
  return async (main) => {
    setTitle('Полезни връзки');
    const { links } = await api('/links');
    const groups = {};
    links.forEach((l) => (groups[l.category] ||= []).push(l));
    const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
    main.innerHTML = `
      <div class="wrap">
        <header class="page-head"><h1>Полезни връзки</h1>
          <p>Сайтове с карти, данни и материали по география.</p></header>
        <div class="links-grid">
          ${Object.entries(groups).map(([cat, items]) => `
            <section><h2>${esc(cat)}</h2>
              <div class="link-cards">
                ${items.map((l) => `<a class="link-card" href="${esc(l.url)}" rel="noopener">
                  <strong>${esc(l.title)}</strong><span class="host">${esc(host(l.url))}</span><p>${esc(l.description || '')}</p></a>`).join('')}
              </div></section>`).join('')}
        </div>
      </div>
      ${footer()}`;
  };
}

// ---------- Търсене ----------
export function search() {
  return async (main) => {
    const q = (new URLSearchParams(location.search).get('q') || '').trim();
    setTitle(q ? `Търсене: ${q}` : 'Търсене');
    const { results } = q ? await api('/search?q=' + encodeURIComponent(q)) : { results: [] };
    const input = $('#q');
    if (input) input.value = q;
    const hint = !q
      ? 'Напиши тема, река, планина или държава.'
      : results.length
        ? plural(results.length, 'намерена тема', 'намерени теми')
        : 'Нищо не намерихме. Опитай с друга дума — например име на река, континент или планина.';
    main.innerHTML = `
      <div class="wrap">
        <header class="page-head"><h1>${q ? `Резултати за „${esc(q)}“` : 'Търсене'}</h1>
          <p>${hint}</p>
          <form class="page-search searchbox-page" role="search">
            <label class="visually-hidden" for="q2">Търси</label>
            <input class="input" id="q2" name="q" type="search" value="${esc(q)}" placeholder="напр. Амазонка">
            <button class="btn" type="submit">Търси</button>
          </form></header>
        <ul class="results">
          ${results.map((r) => `<li><a href="/s/${esc(r.slug)}" data-c="${r.grade || 'x'}">
            <span class="class-tag">${r.grade ? r.grade + ' кл.' : 'школи'}</span>
            <span>${r.code ? `<strong style="color:var(--c)">${esc(r.code)}</strong> ` : ''}${esc(r.title)}</span></a></li>`).join('')}
        </ul>
      </div>`;
  };
}

// ---------- Профил ----------
export function profile() {
  return (main) => {
    setTitle('Профил');
    const u = state.user;
    const forced = u.mustChangePassword;
    main.innerHTML = `
      <div class="auth"><div class="auth-card">
        <h1>${forced ? 'Смени временната парола' : 'Профил'}</h1>
        <p class="sub">${forced ? 'Учителят ти е дал временна парола. Избери своя, преди да продължиш.' : `${esc(u.name)}, ${esc(u.email)}`}</p>
        <form class="form" novalidate>
          <div class="field"><label for="current">${forced ? 'Временна парола' : 'Сегашна парола'}</label>
            <input class="input" id="current" name="current" type="password" autocomplete="current-password" required></div>
          <div class="field"><label for="next">Нова парола</label>
            <input class="input" id="next" name="next" type="password" autocomplete="new-password" minlength="8" required>
            <span class="hint">Поне 8 символа.</span></div>
          <div class="error-box" role="alert"></div>
          <button class="btn" type="submit">Запази новата парола</button>
        </form>
      </div></div>`;
    bindForm($('form', main), async (data) => {
      await api('/me/password', { method: 'POST', body: data });
      await refreshMe();
      toast('Паролата е сменена.');
      go('/', { replace: true });
    });
  };
}

// ---------- Грешки ----------
export function notFound(main) {
  setTitle('Няма такава страница');
  main.innerHTML = `<div class="auth"><div class="auth-card" style="text-align:center">
    <div class="pending-map" style="color:var(--ink-faint)">${icon.pin}</div>
    <h1>Тази страница я няма на картата</h1>
    <p class="sub">Може адресът да е сгрешен или темата да е преместена.</p>
    <a class="btn" href="/">Към началото</a></div></div>`;
}

export function errorView(main, err) {
  if (err.status === 404) return notFound(main);
  if (err.status === 401) return go('/vhod', { replace: true });
  main.innerHTML = `<div class="auth"><div class="auth-card">
    <h1>Не успяхме да заредим страницата</h1>
    <p class="sub">${esc(err.message)}</p>
    <button class="btn" type="button" id="retry">Опитай пак</button></div></div>`;
  $('#retry', main).addEventListener('click', () => location.reload());
}
