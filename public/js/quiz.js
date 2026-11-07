// Тестове в урока: карти, решаване, резултат
import { api } from './api.js';
import { state, go } from './app.js';
import { esc, $, $$, toast, setUnsaved, formatDate } from './ui.js';

const isStaff = () => state.user && (state.user.role === 'teacher' || state.user.role === 'admin');
const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'Й'];
export const pct = (x) => `${Math.round((x || 0) * 100)}%`;
export const level = (x) => (x >= 0.85 ? 'good' : x >= 0.6 ? 'mid' : 'low');
export const fmtPts = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---------- Карти на тестовете ----------
export function quizCards(root, { quizzes, onOpen }) {
  const staff = isStaff();
  if (!quizzes.length) {
    root.innerHTML = '';
    return;
  }
  root.innerHTML = `<div class="quiz-list">${quizzes.map((q) => {
    const meta = [plural(q.questionCount, 'въпрос', 'въпроса'), `${fmtPts(q.maxScore)} т.`, q.maxAttempts ? `до ${plural(q.maxAttempts, 'опит', 'опита')}` : '']
      .filter(Boolean).join(', ');
    let status = '';
    let actions = '';
    if (staff) {
      status = `${q.status === 'draft' ? '<span class="tag draft">Чернова — учениците още не я виждат</span>' : ''}
        <span>${q.students ? `Решили: ${plural(q.students, 'ученик', 'ученици')}` : 'Още никой не го е решавал'}</span>
        ${q.pending ? `<span class="tag warn">${plural(q.pending, 'отговор чака', 'отговора чакат')} оценка</span>` : ''}`;
      actions = `<button class="btn small" type="button" data-q="results" data-id="${q.id}">Резултати</button>
        <button class="btn ghost small" type="button" data-q="try" data-id="${q.id}">Пробвай</button>
        <button class="btn ghost small" type="button" data-q="edit" data-id="${q.id}">Промени</button>
        ${q.canDelete ? `<button class="btn danger small" type="button" data-q="delete" data-id="${q.id}">Изтрий</button>` : ''}`;
    } else {
      const left = q.maxAttempts ? q.maxAttempts - q.attempts : Infinity;
      status = q.attempts
        ? `<span class="score-pill" data-l="${level(q.best)}">Най-добър резултат: ${pct(q.best)}</span>
           ${q.pending ? '<span class="tag warn">Учителят още оценява</span>' : ''}`
        : '<span>Още не си го решавал</span>';
      actions = `${left > 0 ? `<button class="btn small" type="button" data-q="take" data-id="${q.id}">${q.attempts ? 'Реши пак' : 'Започни'}</button>` : '<span class="muted">Опитите свършиха</span>'}
        ${q.lastAttemptId ? `<a class="btn ghost small" href="/opit/${q.lastAttemptId}">Виж последния опит</a>` : ''}`;
    }
    return `
      <article class="quiz-card">
        <div class="qc-main">
          <span class="qc-kind">Тест</span>
          <h3>${esc(q.title)}</h3>
          <p class="qc-meta">${esc(meta)}</p>
          <div class="qc-status">${status}</div>
        </div>
        <div class="qc-actions">${actions}</div>
      </article>`;
  }).join('')}</div>`;
  root.onclick = (e) => {
    const b = e.target.closest('[data-q]');
    if (b) onOpen(b.dataset.q, quizzes.find((q) => q.id === Number(b.dataset.id)));
  };
}

// ---------- Решаване ----------
const draftKey = (quizId) => `gk-quiz-${state.user?.id}-${quizId}`;
const loadDraft = (id) => {
  try {
    return JSON.parse(localStorage.getItem(draftKey(id)) || 'null');
  } catch {
    return null;
  }
};
const saveDraft = (id, v) => {
  try {
    localStorage.setItem(draftKey(id), JSON.stringify(v));
  } catch {
    /* браузърът не пази — няма страшно */
  }
};
const dropDraft = (id) => {
  try {
    localStorage.removeItem(draftKey(id));
  } catch {
    /* */
  }
};

function questionHtml(q, i, a) {
  const head = `<div class="q-head"><span class="q-num">Въпрос ${i + 1}</span><span class="q-pts">${fmtPts(q.points)} т.</span></div>
    <p class="q-text">${esc(q.text).replace(/\n/g, '<br>')}</p>`;
  let body = '';
  if (q.type === 'single' || q.type === 'multi') {
    const type = q.type === 'single' ? 'radio' : 'checkbox';
    const chosen = q.type === 'single' ? [a] : a || [];
    body = `${q.type === 'multi' ? '<p class="q-hint">Може да има повече от един верен отговор.</p>' : ''}
      <div class="q-options">${q.options.map((o, k) => `
        <label class="q-opt"><input type="${type}" name="q-${q.id}" value="${k}" ${chosen.includes(k) ? 'checked' : ''}>
          <span class="q-letter">${LETTERS[k] || k + 1}</span><span>${esc(o)}</span></label>`).join('')}</div>`;
  } else if (q.type === 'match') {
    body = `<p class="q-hint">За всяко нещо вляво избери подходящото вдясно.</p>
      <div class="q-match">${q.lefts.map((l, k) => `
        <label class="q-pair"><span class="q-left">${esc(l)}</span>
          <select class="input" data-pair="${k}"><option value="">— избери —</option>
            ${q.rights.map((r) => `<option value="${esc(r.key)}" ${(a || [])[k] === r.key ? 'selected' : ''}>${esc(r.text)}</option>`).join('')}
          </select></label>`).join('')}</div>`;
  } else if (q.type === 'order') {
    const keys = a && a.length === q.items.length ? a : q.items.map((x) => x.key);
    const byKey = Object.fromEntries(q.items.map((x) => [x.key, x.text]));
    body = `<p class="q-hint">Подреди с бутоните ↑ и ↓ — най-горе е първото.</p>
      <ol class="q-order">${keys.map((k, n) => `
        <li data-key="${esc(k)}"><span class="q-onum">${n + 1}</span><span class="q-otext">${esc(byKey[k])}</span>
          <span class="q-obtns"><button type="button" class="btn ghost small" data-move="-1" aria-label="Нагоре">↑</button>
          <button type="button" class="btn ghost small" data-move="1" aria-label="Надолу">↓</button></span></li>`).join('')}</ol>`;
  } else if (q.type === 'short') {
    body = `<input class="input q-short" type="text" maxlength="300" placeholder="Твоят отговор" value="${esc(a || '')}">`;
  } else {
    body = `<p class="q-hint">Напиши отговора си. Учителят ще го прочете и оцени.</p>
      <textarea class="input q-open" rows="5" maxlength="5000" placeholder="Твоят отговор">${esc(a || '')}</textarea>`;
  }
  return `<section class="q-card" data-qid="${q.id}" data-type="${q.type}">${head}${body}</section>`;
}

function readAnswer(card, q) {
  if (q.type === 'single') {
    const c = $('input:checked', card);
    return c ? Number(c.value) : null;
  }
  if (q.type === 'multi') return $$('input:checked', card).map((c) => Number(c.value));
  if (q.type === 'match') return $$('select[data-pair]', card).map((s) => s.value || null);
  if (q.type === 'order') return $$('.q-order li', card).map((li) => li.dataset.key);
  if (q.type === 'short') return $('.q-short', card).value;
  return $('.q-open', card).value;
}

const answered = (q, a) =>
  q.type === 'single' ? a !== null && a !== undefined
  : q.type === 'multi' ? (a || []).length > 0
  : q.type === 'match' ? (a || []).every(Boolean)
  : q.type === 'order' ? !!a?.touched
  : String(a || '').trim().length > 0;

export async function runQuiz(root, quizId, { onDone }) {
  root.innerHTML = '<div class="loading">Зареждане на теста…</div>';
  let data;
  try {
    data = await api(`/quizzes/${quizId}/take`);
  } catch (err) {
    toast(err.message);
    return onDone();
  }
  const quiz = data.quiz;
  const key = `quiz-${quizId}`;
  const draft = data.preview ? null : loadDraft(quizId);
  const answers = draft?.answers || {};
  const touchedOrder = new Set(draft?.touched || []);

  root.innerHTML = `
    <div class="quiz-run">
      <div class="quiz-top">
        <button class="btn ghost small" type="button" data-r="back">← Назад</button>
        <span class="quiz-progress" aria-live="polite"></span>
      </div>
      <header class="quiz-title">
        <span class="qc-kind">Тест${data.preview ? ' — пробваш като учител, резултатът не се записва' : ''}</span>
        <h2>${esc(quiz.title)}</h2>
        ${quiz.intro ? `<p>${esc(quiz.intro).replace(/\n/g, '<br>')}</p>` : ''}
        <p class="muted">${plural(quiz.questionCount, 'въпрос', 'въпроса')}, общо ${fmtPts(quiz.maxScore)} точки${quiz.maxAttempts ? `. Опит ${data.attemptsUsed + 1} от ${quiz.maxAttempts}` : ''}.</p>
      </header>
      <form class="quiz-form" novalidate>
        ${quiz.questions.map((q, i) => questionHtml(q, i, answers[q.id])).join('')}
        <div class="error-box" role="alert"></div>
        <div class="quiz-submit"><button class="btn" type="submit">Предай теста</button></div>
      </form>
    </div>`;
  window.scrollTo({ top: root.getBoundingClientRect().top + window.scrollY - 80 });

  const form = $('.quiz-form', root);
  const collect = () => {
    quiz.questions.forEach((q) => {
      answers[q.id] = readAnswer($(`[data-qid="${q.id}"]`, form), q);
    });
  };
  const progress = () => {
    const n = quiz.questions.filter((q) => (q.type === 'order' ? touchedOrder.has(q.id) : answered(q, answers[q.id]))).length;
    $('.quiz-progress', root).textContent = `Отговорени: ${n} от ${quiz.questions.length}`;
    return n;
  };
  const changed = () => {
    collect();
    setUnsaved(key, true);
    if (!data.preview) saveDraft(quizId, { answers, touched: [...touchedOrder] });
    progress();
  };
  progress();
  form.addEventListener('input', changed);
  form.addEventListener('change', changed);
  form.addEventListener('click', (e) => {
    const b = e.target.closest('[data-move]');
    if (!b) return;
    const li = b.closest('li');
    const list = li.parentElement;
    const d = Number(b.dataset.move);
    const sib = d < 0 ? li.previousElementSibling : li.nextElementSibling;
    if (!sib) return;
    if (d < 0) list.insertBefore(li, sib);
    else list.insertBefore(sib, li);
    $$('li', list).forEach((x, n) => ($('.q-onum', x).textContent = n + 1));
    touchedOrder.add(list.closest('[data-qid]').dataset.qid);
    b.focus();
    changed();
  });

  $('[data-r="back"]', root).addEventListener('click', () => {
    if (!window.confirm('Да излезеш ли от теста? Отговорите ти остават запазени на това устройство.')) return;
    setUnsaved(key, false);
    onDone();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    collect();
    const missing = quiz.questions.length - progress();
    if (missing && !window.confirm(`${plural(missing, 'въпрос е', 'въпроса са')} без отговор. Да предам ли теста така?`)) return;
    const btn = $('button[type="submit"]', form);
    btn.disabled = true;
    try {
      const res = await api(`/quizzes/${quizId}/submit`, { method: 'POST', body: { answers } });
      setUnsaved(key, false);
      dropDraft(quizId);
      showResult(root, { quiz, res, onDone, canRetry: !quiz.maxAttempts || data.attemptsUsed + 1 < quiz.maxAttempts, retry: () => runQuiz(root, quizId, { onDone }) });
    } catch (err) {
      $('.error-box', form).textContent = err.message;
      btn.disabled = false;
    }
  });
}

// ---------- Резултат и преглед на отговорите ----------
export function reviewHtml(items, { showRight = true } = {}) {
  return items.map((it, i) => {
    const mark = it.pending ? 'pending' : it.correct ? 'right' : it.points > 0 ? 'part' : 'wrong';
    const label = { pending: 'Чака оценка', right: 'Вярно', part: 'Частично вярно', wrong: 'Грешно' }[mark];
    let body = '';
    if (it.type === 'single' || it.type === 'multi') {
      body = `<ul class="rv-options">${it.options.map((o, k) => {
        const given = it.given.includes(k);
        const right = it.right?.includes(k);
        return `<li class="${given ? 'given' : ''} ${right ? 'right' : ''} ${given && it.right && !right ? 'wrong' : ''}">
          <span class="q-letter">${LETTERS[k] || k + 1}</span><span>${esc(o)}</span>
          ${given ? '<em>твоят отговор</em>' : ''}${right && showRight ? '<em class="ok">верен</em>' : ''}</li>`;
      }).join('')}</ul>`;
    } else if (it.type === 'match') {
      body = `<table class="rv-table"><tbody>${it.lefts.map((l, k) => `
        <tr><th>${esc(l)}</th><td class="${it.right ? (it.given[k] === it.right[k] ? 'ok' : 'bad') : ''}">${esc(it.given[k] || '— без отговор —')}</td>
        ${it.right && it.given[k] !== it.right[k] ? `<td class="ok">вярно: ${esc(it.right[k])}</td>` : ''}</tr>`).join('')}</tbody></table>`;
    } else if (it.type === 'order') {
      body = `<div class="rv-cols"><div><strong>Твоят ред</strong><ol>${it.given.map((g, k) => `<li class="${it.right ? (g === it.right[k] ? 'ok' : 'bad') : ''}">${esc(g || '—')}</li>`).join('')}</ol></div>
        ${it.right ? `<div><strong>Верният ред</strong><ol>${it.right.map((g) => `<li>${esc(g)}</li>`).join('')}</ol></div>` : ''}</div>`;
    } else {
      body = `<blockquote class="rv-text">${esc(it.given || '— без отговор —').replace(/\n/g, '<br>')}</blockquote>
        ${it.right ? `<p class="muted">Приемат се: ${it.right.map(esc).join(', ')}</p>` : ''}`;
    }
    return `<section class="rv-card" data-mark="${mark}" data-qid="${it.id}">
      <div class="q-head"><span class="q-num">Въпрос ${i + 1}</span>
        <span class="rv-mark">${label}, ${fmtPts(it.points)} от ${fmtPts(it.max)} т.</span></div>
      <p class="q-text">${esc(it.text).replace(/\n/g, '<br>')}</p>
      ${body}
      ${it.explain ? `<p class="rv-explain"><strong>Обяснение:</strong> ${esc(it.explain)}</p>` : ''}
      ${it.comment ? `<p class="rv-comment"><strong>Учителят:</strong> ${esc(it.comment)}</p>` : ''}
      <div class="rv-extra"></div>
    </section>`;
  }).join('');
}

export function cheer(p) {
  return p >= 0.9 ? 'Отлично!' : p >= 0.75 ? 'Много добре!' : p >= 0.5 ? 'Добре, но може и по-добре.' : 'Прегледай урока и опитай пак.';
}

function showResult(root, { quiz, res, onDone, canRetry, retry }) {
  const p = res.maxScore ? res.score / res.maxScore : 0;
  root.innerHTML = `
    <div class="quiz-run">
      <div class="result-hero" data-l="${level(p)}">
        <div class="result-num">${pct(p)}</div>
        <div><h2>${res.pending ? 'Тестът е предаден' : cheer(p)}</h2>
          <p>${fmtPts(res.score)} от ${fmtPts(res.maxScore)} точки${res.pending ? `. ${plural(res.pending, 'отговор чака', 'отговора чакат')} оценка от учителя — резултатът може да се вдигне.` : '.'}</p>
          ${res.preview ? '<p class="muted">Пробваш като учител — резултатът не се записва.</p>' : ''}</div>
      </div>
      <div class="result-actions">
        ${canRetry ? '<button class="btn" type="button" data-r="retry">Реши пак</button>' : ''}
        <button class="btn ghost" type="button" data-r="done">Назад към урока</button>
      </div>
      <h3 class="rv-title">${quiz.showAnswers || res.preview ? 'Твоите отговори и верните' : 'Твоите отговори'}</h3>
      ${reviewHtml(res.review)}
    </div>`;
  window.scrollTo({ top: root.getBoundingClientRect().top + window.scrollY - 80 });
  $('[data-r="done"]', root).addEventListener('click', onDone);
  $('[data-r="retry"]', root)?.addEventListener('click', retry);
}

// ---------- Отделна страница за един опит: /opit/:id ----------
export function attemptView(id) {
  return async (main) => {
    const data = await api(`/attempts/${id}`);
    const a = data.attempt;
    const q = data.quiz;
    const staff = isStaff();
    const p = a.maxScore ? a.score / a.maxScore : 0;
    document.title = `${q.title} — ${a.student.name}`;
    const back = q.section ? `/s/${q.section.slug}#${q.tab}` : '/';
    main.innerHTML = `
      <div class="wrap page-narrow" data-c="${q.section?.grade || 'x'}">
        <nav class="crumbs-back"><a href="${staff ? '/napredak/uchenik/' + a.student.id : '/napredak'}">← ${staff ? esc(a.student.name) : 'Моят напредък'}</a>
          <a href="${back}">${esc((q.section?.code ? q.section.code + ' ' : '') + (q.section?.title || ''))}</a></nav>
        <div class="result-hero" data-l="${level(p)}">
          <div class="result-num">${pct(p)}</div>
          <div><h1>${esc(q.title)}</h1>
            <p>${staff ? `${esc(a.student.name)}${a.student.grade ? `, ${a.student.grade}${esc(a.student.classLetter || '')} клас` : ''}. ` : ''}${fmtPts(a.score)} от ${fmtPts(a.maxScore)} точки, ${formatDate(a.createdAt)}
            ${a.pending ? `<span class="tag warn">${plural(a.pending, 'отговор чака', 'отговора чакат')} оценка</span>` : ''}</p></div>
        </div>
        ${a.feedback ? `<p class="rv-comment big"><strong>${esc(a.reviewer || 'Учителят')}:</strong> ${esc(a.feedback)}</p>` : ''}
        ${staff ? `<form class="review-form">` : ''}
        <div class="rv-list">${reviewHtml(data.review)}</div>
        ${staff ? `
          <div class="panel review-panel">
            <h2>Оценка</h2>
            <p class="muted">Тук поставяш точки за свободните отговори. Можеш да промениш точките и на всеки друг въпрос.</p>
            <div class="field"><label for="fb">Коментар към ученика <span class="opt">(по желание)</span></label>
              <textarea class="input" id="fb" name="feedback" rows="3" maxlength="2000">${esc(a.feedback || '')}</textarea></div>
            <div class="error-box" role="alert"></div>
            <button class="btn" type="submit">Запази оценката</button>
          </div></form>` : ''}
      </div>`;

    if (!staff) return;
    // поле за точки и коментар към всеки въпрос
    data.review.forEach((it) => {
      const box = $(`.rv-card[data-qid="${it.id}"] .rv-extra`, main);
      box.innerHTML = `<div class="rv-grade ${it.pending ? 'needs' : ''}">
        <label>Точки <input class="input" type="number" min="0" max="${it.max}" step="0.5" name="p-${it.id}" value="${it.pending ? '' : it.points}" placeholder="0–${fmtPts(it.max)}"> от ${fmtPts(it.max)}</label>
        <label class="grow">Коментар <input class="input" name="c-${it.id}" maxlength="1000" value="${esc(it.comment || '')}"></label></div>`;
    });
    $('.review-form', main).addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const points = {};
      const comments = {};
      data.review.forEach((it) => {
        const pv = fd.get(`p-${it.id}`);
        if (pv !== '' && Number(pv) !== it.points) points[it.id] = Number(pv);
        if (it.pending && pv !== '') points[it.id] = Number(pv);
        const cv = fd.get(`c-${it.id}`);
        if (cv !== (it.comment || '')) comments[it.id] = cv;
      });
      try {
        const r = await api(`/attempts/${a.id}/review`, { method: 'POST', body: { points, comments, feedback: fd.get('feedback') } });
        toast(r.pending ? `Запазено. Още ${r.pending} без оценка.` : 'Оценката е запазена.');
        go(location.pathname, { replace: true });
      } catch (err) {
        $('.error-box', main).textContent = err.message;
      }
    });
  };
}
