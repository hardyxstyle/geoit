// Резултатите от един тест (за учители)
import { api } from './api.js';
import { esc, $, formatDate } from './ui.js';
import { pct, level, fmtPts } from './quiz.js';

const TYPE_NAMES = { single: 'избор', multi: 'избор', match: 'свързване', order: 'подреждане', short: 'кратък отговор', open: 'свободен отговор' };

export async function showResults(root, quizId, { onDone }) {
  root.innerHTML = '<div class="loading">Зареждане на резултатите…</div>';
  const data = await api(`/quizzes/${quizId}/results`);
  const q = data.quiz;
  // Учениците от класа, които още не са решили (само за уроци с клас)
  let notYet = [];
  let letters = [];
  if (q.section.grade) {
    try {
      const pr = await api(`/progress?grade=${q.section.grade}`);
      const done = new Set(data.students.map((s) => s.userId));
      notYet = pr.students.filter((s) => !done.has(s.id));
      letters = pr.letters;
    } catch {
      /* без списък на нерешилите */
    }
  }
  // паралелките само от класа на урока (тест в урок за 5. клас → 5А, 5Б…)
  const own = data.students.filter((s) => !q.section.grade || s.grade === q.section.grade);
  letters = [...new Set([...letters, ...own.map((s) => s.classLetter).filter(Boolean)])].sort();
  let letter = '';

  const draw = () => {
    const st = data.students.filter((s) => !letter || (s.classLetter === letter && s.grade === q.section.grade));
    const ny = notYet.filter((s) => !letter || s.classLetter === letter);
    const avg = st.length ? st.reduce((a, s) => a + s.best, 0) / st.length : null;
    $('.res-body', root).innerHTML = `
      <div class="stat-row">
        <div><b>${st.length}</b> решили</div>
        ${q.section.grade ? `<div><b>${ny.length}</b> още не са</div>` : ''}
        <div><b>${avg === null ? '—' : pct(avg)}</b> среден най-добър резултат</div>
        <div><b>${st.reduce((a, s) => a + (s.pending ? 1 : 0), 0)}</b> чакат оценка</div>
      </div>
      ${st.length ? `
        <div class="table-wrap"><table class="utable res-table">
          <thead><tr><th>Ученик</th><th>Клас</th><th>Най-добър</th><th>Последен опит</th><th>Опити</th><th></th></tr></thead>
          <tbody>${st.map((s) => `
            <tr>
              <td><a href="/napredak/uchenik/${s.userId}"><strong>${esc(s.name)}</strong></a></td>
              <td>${s.grade ? `${s.grade}${esc(s.classLetter || '')}` : ''}</td>
              <td><span class="score-pill" data-l="${level(s.best)}">${pct(s.best)}</span></td>
              <td>${fmtPts(s.last.score)} от ${fmtPts(s.last.maxScore)} т., ${formatDate(s.last.at)}
                ${s.last.pending ? '<span class="tag warn">чака оценка</span>' : ''}</td>
              <td>${s.attempts}</td>
              <td><a class="btn ${s.last.pending ? '' : 'ghost'} small" href="/opit/${s.last.id}">${s.last.pending ? 'Оцени' : 'Виж'}</a></td>
            </tr>`).join('')}</tbody></table></div>`
        : '<div class="empty"><strong>Още никой не е решил теста</strong></div>'}
      ${ny.length ? `<details class="notyet"><summary>Още не са решили (${ny.length})</summary>
        <p>${ny.map((s) => `${esc(s.name)}${s.classLetter ? ` (${esc(s.classLetter)})` : ''}`).join(', ')}</p></details>` : ''}
      <h3 class="rv-title">Как се справят с всеки въпрос</h3>
      <p class="muted small">По последния опит на всеки ученик. Ниският процент подсказва кое да се преговори.</p>
      <ol class="qstats">${data.questions.map((x) => `
        <li><span class="qs-text">${esc(x.text.split('\n')[0])} <small>(${TYPE_NAMES[x.type]})</small></span>
          ${x.pct === null ? '<span class="muted">—</span>' : `<span class="bar" data-l="${level(x.pct)}"><i style="width:${Math.round(x.pct * 100)}%"></i></span><b>${pct(x.pct)}</b>`}
        </li>`).join('')}</ol>`;
  };

  root.innerHTML = `
    <div class="quiz-results">
      <div class="quiz-top">
        <button class="btn ghost small" type="button" data-r="back">← Назад</button>
      </div>
      <header class="quiz-title">
        <span class="qc-kind">Резултати</span>
        <h2>${esc(q.title)}</h2>
        <p class="muted">${q.questionCount} въпроса, ${fmtPts(q.maxScore)} точки${q.status === 'draft' ? '. Тестът е чернова — учениците още не го виждат.' : ''}</p>
      </header>
      ${letters.length > 1 ? `<div class="subtabs" role="group" aria-label="Паралелка">
        <button type="button" data-letter="" aria-pressed="true">Всички</button>
        ${letters.map((l) => `<button type="button" data-letter="${esc(l)}" aria-pressed="false">${q.section.grade}${esc(l)}</button>`).join('')}</div>` : ''}
      <div class="res-body"></div>
    </div>`;
  $('[data-r="back"]', root).addEventListener('click', onDone);
  root.querySelector('.subtabs')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-letter]');
    if (!b) return;
    letter = b.dataset.letter;
    root.querySelectorAll('[data-letter]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    draw();
  });
  draw();
}
