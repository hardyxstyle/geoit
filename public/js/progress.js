// Напредък: таблица по клас (учители), страница на ученик, „Моят напредък“
import { api } from './api.js';
import { state, APP_NAME } from './app.js';
import { esc, $, formatDate } from './ui.js';
import { pct, level, fmtPts } from './quiz.js';

const isStaff = () => state.user && (state.user.role === 'teacher' || state.user.role === 'admin');
const remember = (k, v) => {
  try {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
  } catch {
    return null;
  }
  return v;
};

export function progressView() {
  return async (main) => {
    if (!isStaff()) return studentPage(main, await api('/progress/me'), true);
    document.title = `Напредък — ${APP_NAME}`;
    let grade = Number(remember('gk-progress-grade')) || 5;
    let letter = remember('gk-progress-letter') || '';

    main.innerHTML = `
      <div class="wrap progress-page">
        <header class="page-head"><h1>Напредък</h1>
          <p>Колко урока е отворил всеки ученик и най-добрият му резултат на всеки тест. Натисни име за подробности.</p></header>
        <div class="progress-filters">
          <div class="segmented grades" style="--n:3" role="radiogroup" aria-label="Клас">
            ${[5, 6, 7].map((g) => `<input type="radio" id="pg${g}" name="pg" value="${g}" ${g === grade ? 'checked' : ''}><label for="pg${g}" data-c="${g}">${g}.<small>клас</small></label>`).join('')}
          </div>
          <div class="subtabs letters" role="group" aria-label="Паралелка"></div>
        </div>
        <div class="progress-body"><div class="loading">Зареждане…</div></div>
      </div>`;

    async function load() {
      const body = $('.progress-body', main);
      body.innerHTML = '<div class="loading">Зареждане…</div>';
      const d = await api(`/progress?grade=${grade}&letter=${encodeURIComponent(letter)}`);
      if (letter && !d.letters.includes(letter)) {
        letter = '';
        remember('gk-progress-letter', '');
      }
      $('.letters', main).innerHTML = d.letters.length
        ? `<button type="button" data-letter="" aria-pressed="${!letter}">Всички</button>${d.letters
            .map((l) => `<button type="button" data-letter="${esc(l)}" aria-pressed="${l === letter}">${grade}${esc(l)}</button>`)
            .join('')}`
        : '';
      if (!d.students.length) {
        body.innerHTML = `<div class="empty"><strong>Няма одобрени ученици в ${grade}${esc(letter)} клас</strong>
          <span>Учениците се появяват тук, след като се регистрират и ги одобриш от „Потребители“.</span></div>`;
        return;
      }
      body.innerHTML = `
        ${d.quizzes.length ? '' : '<p class="notice info">Още няма публикувани тестове за този клас. Засега се вижда само колко урока е отворил всеки ученик.</p>'}
        <div class="table-wrap"><table class="progress-table">
          <thead><tr>
            <th class="sticky">Ученик</th>
            <th>Уроци<br><small>от ${d.lessons}</small></th>
            ${d.quizzes.map((q) => `<th class="qcol" title="${esc((q.section.code ? q.section.code + ' ' : '') + q.section.title + ' — ' + q.title)}">
              <a href="/s/${esc(q.section.slug)}#zadachi">${esc(q.section.code || '★')}</a><span>${esc(q.title)}</span></th>`).join('')}
          </tr></thead>
          <tbody>${d.students.map((s) => `
            <tr>
              <th class="sticky"><a href="/napredak/uchenik/${s.id}">${esc(s.name)}</a>${s.classLetter ? `<small>${grade}${esc(s.classLetter)}</small>` : ''}</th>
              <td><span class="lessons-bar" title="${s.lessonsSeen} от ${d.lessons}"><i style="width:${d.lessons ? Math.round((s.lessonsSeen / d.lessons) * 100) : 0}%"></i></span>${s.lessonsSeen}</td>
              ${d.quizzes.map((q) => {
                const sc = s.scores[q.id];
                if (!sc) return '<td class="none">—</td>';
                return `<td><span class="score-pill" data-l="${level(sc.best)}">${pct(sc.best)}</span>${sc.pending ? '<span class="dot-warn" title="чака оценка"></span>' : ''}</td>`;
              }).join('')}
            </tr>`).join('')}</tbody>
        </table></div>
        <p class="muted small legend-line"><span class="score-pill" data-l="good">85%+</span> <span class="score-pill" data-l="mid">60–84%</span> <span class="score-pill" data-l="low">под 60%</span> „—“ = не е решавал, <span class="dot-warn"></span> = чака оценка от учител</p>`;
    }

    main.addEventListener('change', (e) => {
      if (e.target.name !== 'pg') return;
      grade = Number(e.target.value);
      letter = '';
      remember('gk-progress-grade', grade);
      remember('gk-progress-letter', '');
      load();
    });
    main.addEventListener('click', (e) => {
      const b = e.target.closest('[data-letter]');
      if (!b) return;
      letter = b.dataset.letter;
      remember('gk-progress-letter', letter);
      load();
    });
    await load();
  };
}

export function studentProgressView(id) {
  return async (main) => studentPage(main, await api(`/progress/students/${id}`), false);
}

function studentPage(main, d, self) {
  const s = d.student;
  document.title = `${self ? 'Моят напредък' : s.name} — ${APP_NAME}`;
  const done = d.attempts.length;
  const best = new Map();
  d.attempts.forEach((a) => best.set(a.quizId, Math.max(best.get(a.quizId) ?? 0, a.maxScore ? a.score / a.maxScore : 0)));
  const avg = best.size ? [...best.values()].reduce((x, y) => x + y, 0) / best.size : null;
  const seenGrade = d.lessons.filter((l) => l.grade === s.grade).length;

  main.innerHTML = `
    <div class="wrap page-narrow" data-c="${s.grade || 'x'}">
      ${self ? '' : '<nav class="crumbs-back"><a href="/napredak">← Напредък</a></nav>'}
      <header class="page-head">
        <h1>${self ? 'Моят напредък' : esc(s.name)}</h1>
        <p>${s.grade ? `${s.grade}${esc(s.classLetter || '')} клас` : ''}${!self && s.lastLogin ? `, последно влизане ${formatDate(s.lastLogin)}` : ''}</p>
      </header>
      <div class="stat-row">
        <div><b>${seenGrade}</b> от ${d.lessonsTotal} урока отворени</div>
        <div><b>${best.size}</b> решени ${best.size === 1 ? 'тест' : 'теста'}</div>
        <div><b>${avg === null ? '—' : pct(avg)}</b> среден най-добър резултат</div>
      </div>
      <section class="panel">
        <h2>Тестове</h2>
        ${done ? `<ul class="att-list">${d.attempts.map((a) => {
          const p = a.maxScore ? a.score / a.maxScore : 0;
          return `<li>
            <span class="score-pill" data-l="${level(p)}">${pct(p)}</span>
            <div class="att-main"><a href="/opit/${a.id}"><strong>${esc(a.title)}</strong></a>
              <small>${esc((a.section.code ? a.section.code + ' ' : '') + a.section.title)}, ${formatDate(a.createdAt)}, ${fmtPts(a.score)} от ${fmtPts(a.maxScore)} т.</small>
              ${a.feedback ? `<span class="att-fb">Учителят: ${esc(a.feedback)}</span>` : ''}</div>
            ${a.pending ? '<span class="tag warn">чака оценка</span>' : ''}
          </li>`;
        }).join('')}</ul>` : `<p class="muted">${self ? 'Още не си решавал тестове. Ще ги намериш в уроците, в таба „Задачи и тестове“.' : 'Още не е решавал тестове.'}</p>`}
      </section>
      <section class="panel">
        <h2>Отворени уроци</h2>
        ${d.lessons.length ? `<ul class="seen-list">${d.lessons.map((l) => `
          <li><a href="/s/${esc(l.slug)}" data-c="${l.grade || 'x'}"><span class="code">${esc(l.code || '')}</span>${esc(l.title)}</a>
            <small>${formatDate(l.lastAt)}${l.views > 1 ? `, ${l.views} пъти` : ''}</small></li>`).join('')}</ul>`
        : `<p class="muted">${self ? 'Още не си отварял уроци.' : 'Още не е отварял уроци.'}</p>`}
      </section>
    </div>`;
}

