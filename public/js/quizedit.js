// Създаване и промяна на тест: конструктор + поставяне на готов текст
import { api } from './api.js';
import { esc, $, $$, toast, setUnsaved } from './ui.js';
import { TAB_NAMES } from './materials.js';

const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'Й'];
const TYPE_NAMES = {
  single: 'Избор на отговор',
  multi: 'Избор на отговор',
  match: 'Свързване',
  order: 'Подреждане',
  short: 'Кратък отговор',
  open: 'Свободен отговор',
};

const blank = (type) => {
  const q = { type, text: '', points: type === 'open' ? 3 : 1, explain: '' };
  if (type === 'single' || type === 'multi') Object.assign(q, { options: ['', '', '', ''], correct: [] });
  if (type === 'match') q.pairs = [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }];
  if (type === 'order') q.items = [{ text: '' }, { text: '' }, { text: '' }];
  if (type === 'short') q.answers = [''];
  return q;
};

// ---------- Разпознаване на поставен текст ----------
// Разбира: „Въпрос 1.“ / „1.“ / „Задача 2.“ в началото на въпрос,
// отговори „А) …“, „Б. …“, „a) …“; верен отговор със * накрая/в началото или ред „Отговор: Б“.
const Q_START = /^\s*(?:(?:въпрос|задача|question)\s*)?(\d{1,3})\s*[.)]\s*(.*)$/i;
const OPT = /^\s*([*+]?)\s*([А-ИA-Ja-iа-и])\s*[).]\s+(.+?)\s*$/;
const KEY = /^\s*(?:верен\s+)?отговор\s*[:-]\s*(.+)$/i;
const LETTER_IDX = (ch) => {
  const c = ch.toUpperCase();
  const cy = LETTERS.indexOf(c);
  return cy >= 0 ? cy : 'ABCDEFGHIJ'.indexOf(c);
};
const isHeading = (line) => /^[\p{Extended_Pictographic}\s]*[^\p{L}\d]*$/u.test(line) || /^\s*[\p{Extended_Pictographic}]/u.test(line);

export function parseQuizText(raw) {
  const lines = String(raw).replace(/\r/g, '').split('\n').map((l) => l.trim());
  const blocks = [];
  let cur = null;
  let title = '';
  for (const line of lines) {
    if (!line) continue;
    const qs = line.match(Q_START);
    // „1. Нещо“ е въпрос само ако не сме в списък с отговори, който е номериран
    if (qs && !(cur && cur.options.length && /^\d/.test(line) && !/^(въпрос|задача)/i.test(line))) {
      cur = { textLines: qs[2] ? [qs[2]] : [], options: [], marks: [], key: null };
      blocks.push(cur);
      continue;
    }
    if (!cur) {
      // текст преди първия въпрос — може да е заглавие
      if (!title) title = line.replace(/^[\p{Extended_Pictographic}\s]+/u, '').replace(/[:：]\s*$/, '');
      continue;
    }
    const key = line.match(KEY);
    if (key) {
      cur.key = key[1];
      continue;
    }
    const opt = line.match(OPT);
    if (opt) {
      let text = opt[3];
      let mark = !!opt[1];
      if (/\s*(\*|\(верен\)|✓|✔)$/i.test(text)) {
        mark = true;
        text = text.replace(/\s*(\*|\(верен\)|✓|✔)$/i, '');
      }
      cur.options.push(text);
      cur.marks.push(mark);
      continue;
    }
    if (isHeading(line)) {
      cur = null; // ново заглавие (напр. „📝 Кратък тест“) → край на въпроса
      continue;
    }
    if (cur.options.length) {
      // продължение на последния отговор
      cur.options[cur.options.length - 1] += ' ' + line;
    } else cur.textLines.push(line);
  }

  const questions = blocks
    .filter((b) => b.textLines.length || b.options.length)
    .map((b) => {
      const text = b.textLines.join('\n');
      if (b.options.length >= 2) {
        let correct = b.marks.map((m, i) => (m ? i : -1)).filter((i) => i >= 0);
        if (!correct.length && b.key) {
          correct = b.key.split(/[,\s]+/).map((x) => LETTER_IDX(x.replace(/[).]/g, ''))).filter((i) => i >= 0 && i < b.options.length);
        }
        return { type: correct.length > 1 ? 'multi' : 'single', text, points: 1, options: b.options, correct, explain: '' };
      }
      if (b.key) return { type: 'short', text, points: 1, answers: [b.key], explain: '' };
      return { type: 'open', text: [text, ...b.options].join('\n'), points: 3, explain: '' };
    });
  return { title, questions };
}

// ---------- Конструкторът ----------
export async function editQuiz(root, { slug, tab, quizId = null, onDone }) {
  const key = `quiz-edit-${quizId || 'new'}`;
  let model;
  if (quizId) {
    root.innerHTML = '<div class="loading">Зареждане…</div>';
    const { quiz } = await api(`/quizzes/${quizId}`);
    model = { ...quiz };
  } else {
    model = { title: '', intro: '', tab, maxAttempts: null, showAnswers: true, status: 'draft', questions: [] };
  }
  const dirty = (v = true) => setUnsaved(key, v);

  root.innerHTML = `
    <div class="quiz-edit">
      <div class="editor-bar">
        <strong>${quizId ? 'Промяна на теста' : 'Нов тест'}</strong>
        <span class="spacer"></span>
        <button class="btn ghost small" type="button" data-e="cancel">Отказ</button>
        <button class="btn ghost small" type="button" data-e="save-draft">Запази като чернова</button>
        <button class="btn small" type="button" data-e="publish">Публикувай</button>
      </div>
      <div class="panel qe-settings">
        <div class="field"><label for="qe-title">Заглавие</label>
          <input class="input" id="qe-title" maxlength="200" value="${esc(model.title)}" placeholder="напр. Какво знам за географията?"></div>
        <div class="field"><label for="qe-intro">Указания <span class="opt">(по желание)</span></label>
          <textarea class="input" id="qe-intro" rows="2" maxlength="3000">${esc(model.intro || '')}</textarea></div>
        <div class="row3">
          <div class="field"><label for="qe-tab">В кой таб</label>
            <select class="input" id="qe-tab">${Object.entries(TAB_NAMES).map(([k, v]) => `<option value="${k}" ${k === model.tab ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div class="field"><label for="qe-att">Опити</label>
            <select class="input" id="qe-att">${[['', 'Без ограничение'], ['1', '1 опит'], ['2', '2 опита'], ['3', '3 опита'], ['5', '5 опита']]
              .map(([v, l]) => `<option value="${v}" ${String(model.maxAttempts || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <label class="check"><input type="checkbox" id="qe-show" ${model.showAnswers ? 'checked' : ''}> След предаване ученикът вижда верните отговори</label>
        </div>
      </div>
      <div class="qe-paste">
        <button class="btn ghost" type="button" data-e="paste">Постави готов текст</button>
        <span class="muted">Копираш въпросите от Word или от другаде — сайтът ги разпознава сам.</span>
      </div>
      <ol class="qe-list"></ol>
      <div class="qe-add">
        <span class="label">Добави въпрос:</span>
        <button class="btn ghost small" type="button" data-add="single">Избор на отговор</button>
        <button class="btn ghost small" type="button" data-add="match">Свързване</button>
        <button class="btn ghost small" type="button" data-add="order">Подреждане</button>
        <button class="btn ghost small" type="button" data-add="short">Кратък отговор</button>
        <button class="btn ghost small" type="button" data-add="open">Свободен отговор</button>
      </div>
      <div class="error-box" role="alert"></div>
      <dialog class="qe-dlg"></dialog>
    </div>`;

  const list = $('.qe-list', root);

  function optRows(q, i) {
    const multi = q.type === 'multi';
    return `${q.options.map((o, k) => `
      <div class="qe-opt">
        <label class="qe-correct" title="Верен отговор"><input type="${multi ? 'checkbox' : 'radio'}" name="c-${i}" data-f="correct" data-k="${k}" ${q.correct.includes(k) ? 'checked' : ''}><span>${LETTERS[k] || k + 1}</span></label>
        <input class="input" data-f="option" data-k="${k}" value="${esc(o)}" placeholder="Отговор ${LETTERS[k] || k + 1}">
        <button class="btn ghost small icon-btn" type="button" data-do="del-opt" data-k="${k}" aria-label="Махни отговора">×</button>
      </div>`).join('')}
      <div class="qe-row-actions">
        <button class="btn ghost small" type="button" data-do="add-opt">+ Отговор</button>
        <label class="check small"><input type="checkbox" data-f="multi" ${multi ? 'checked' : ''}> Повече от един верен отговор</label>
      </div>
      ${q.correct.length ? '' : '<p class="qe-warn">Отбележи верния отговор (кръгчето пред него).</p>'}`;
  }

  function qHtml(q, i) {
    let body = '';
    if (q.type === 'single' || q.type === 'multi') body = optRows(q, i);
    else if (q.type === 'match') {
      body = `${q._check ? '<p class="qe-warn">Пренесох нещата от текста, но не знам кое с кое е свързано. Провери дали всяка двойка на един ред е вярна.</p>' : ''}
        <p class="muted small">Напиши двойките правилно — за учениците дясната колона се разбърква.</p>
        ${q.pairs.map((p, k) => `
        <div class="qe-pairrow">
          <input class="input" data-f="left" data-k="${k}" value="${esc(p.left)}" placeholder="напр. Христофор Колумб">
          <span aria-hidden="true">↔</span>
          <input class="input" data-f="right" data-k="${k}" value="${esc(p.right)}" placeholder="напр. Достига Америка през 1492 г.">
          <button class="btn ghost small icon-btn" type="button" data-do="del-pair" data-k="${k}" aria-label="Махни двойката">×</button>
        </div>`).join('')}
        <div class="qe-row-actions"><button class="btn ghost small" type="button" data-do="add-pair">+ Двойка</button></div>`;
    } else if (q.type === 'order') {
      body = `${q._check ? '<p class="qe-warn">Пренесох ги от текста. Подреди ги в правилния ред с бутона ↑.</p>' : ''}
        <p class="muted small">Напиши ги в <b>правилния</b> ред — за учениците се разбъркват.</p>
        ${q.items.map((it, k) => `
        <div class="qe-orderrow">
          <span class="q-onum">${k + 1}</span>
          <input class="input" data-f="item" data-k="${k}" value="${esc(it.text)}">
          <button class="btn ghost small icon-btn" type="button" data-do="up-item" data-k="${k}" aria-label="Нагоре">↑</button>
          <button class="btn ghost small icon-btn" type="button" data-do="del-item" data-k="${k}" aria-label="Махни">×</button>
        </div>`).join('')}
        <div class="qe-row-actions"><button class="btn ghost small" type="button" data-do="add-item">+ Добави</button></div>`;
    } else if (q.type === 'short') {
      body = `<div class="field"><label>Верни отговори <span class="opt">(по един на ред; главни/малки букви и препинателни знаци нямат значение)</span></label>
        <textarea class="input" data-f="answers" rows="2">${esc((q.answers || []).join('\n'))}</textarea></div>`;
    } else {
      body = '<p class="muted small">Ученикът пише свободно. Ти поставяш точките от „Резултати“.</p>';
    }
    return `
      <li class="qe-card" data-i="${i}">
        <div class="qe-head">
          <span class="q-num">Въпрос ${i + 1}</span>
          <select class="input qe-type" data-f="type" aria-label="Вид въпрос">
            ${['single', 'match', 'order', 'short', 'open'].map((t) => `<option value="${t}" ${(q.type === 'multi' ? 'single' : q.type) === t ? 'selected' : ''}>${TYPE_NAMES[t]}</option>`).join('')}
          </select>
          <label class="qe-pts">Точки <input class="input" type="number" min="0.5" max="100" step="0.5" data-f="points" value="${q.points}"></label>
          <span class="spacer"></span>
          <button class="btn ghost small icon-btn" type="button" data-do="up" aria-label="Премести нагоре">↑</button>
          <button class="btn ghost small icon-btn" type="button" data-do="down" aria-label="Премести надолу">↓</button>
          <button class="btn danger small" type="button" data-do="del">Изтрий</button>
        </div>
        <textarea class="input qe-text" data-f="text" rows="2" placeholder="Текст на въпроса">${esc(q.text)}</textarea>
        ${body}
        <details class="qe-explain" ${q.explain ? 'open' : ''}><summary>Обяснение след предаване <span class="opt">(по желание)</span></summary>
          <textarea class="input" data-f="explain" rows="2" maxlength="1500">${esc(q.explain || '')}</textarea></details>
      </li>`;
  }

  const draw = () => {
    list.innerHTML = model.questions.length
      ? model.questions.map(qHtml).join('')
      : '<li class="empty"><strong>Още няма въпроси</strong><span>Добави въпрос с бутоните отдолу или постави готов текст.</span></li>';
  };

  // Промени, при които трябва да се прерисува въпросът
  const redrawOne = (i) => {
    const li = list.querySelector(`.qe-card[data-i="${i}"]`);
    if (li) li.outerHTML = qHtml(model.questions[i], i);
  };

  list.addEventListener('input', (e) => {
    const li = e.target.closest('.qe-card');
    if (!li) return;
    const q = model.questions[Number(li.dataset.i)];
    const f = e.target.dataset.f;
    const k = Number(e.target.dataset.k);
    if (f === 'text') q.text = e.target.value;
    else if (f === 'points') q.points = Number(e.target.value) || 1;
    else if (f === 'option') q.options[k] = e.target.value;
    else if (f === 'left') (q.pairs[k].left = e.target.value), delete q._check;
    else if (f === 'right') (q.pairs[k].right = e.target.value), delete q._check;
    else if (f === 'item') q.items[k].text = e.target.value;
    else if (f === 'answers') q.answers = e.target.value.split('\n');
    else if (f === 'explain') q.explain = e.target.value;
    if (f === 'left' || f === 'right') li.querySelector('.qe-warn')?.remove();
    dirty();
  });

  list.addEventListener('change', (e) => {
    const li = e.target.closest('.qe-card');
    if (!li) return;
    const i = Number(li.dataset.i);
    let q = model.questions[i];
    const f = e.target.dataset.f;
    if (f === 'type') {
      const t = e.target.value;
      const nq = blank(t);
      nq.text = q.text;
      // свободният отговор е по 3 точки по подразбиране, другите — по 1
      nq.points = (q.type === 'open') !== (t === 'open') ? nq.points : q.points;
      nq.explain = q.explain;
      if (q.id) nq.id = q.id;
      // Пренасяме каквото може: отговорите стават десни части/неща за подреждане;
      // редовете от текста след последното „…:“ стават неща за подреждане
      const opts = (q.options || []).filter((o) => o.trim());
      const lines = q.text.split('\n').map((l) => l.trim()).filter(Boolean);
      const lastColon = lines.map((l) => /[:：]$/.test(l)).lastIndexOf(true);
      const tail = lines.length > 1 ? lines.slice(lastColon >= 0 ? lastColon + 1 : 1) : [];
      if (t === 'match' && opts.length) {
        // имената между първия и следващия ред с „:“ (напр. „Мореплаватели:“) стават лявата колона
        const first = lines.findIndex((l) => /[:：]$/.test(l));
        const next = first >= 0 ? lines.findIndex((l, n) => n > first && /[:：]$/.test(l)) : -1;
        const lefts = first >= 0 ? lines.slice(first + 1, next > first ? next : undefined) : [];
        nq.pairs = opts.map((o, n) => ({ left: lefts.length === opts.length ? lefts[n] : '', right: o }));
        if (lefts.length === opts.length) nq.text = lines.slice(0, first).join('\n') || q.text;
        nq._check = true;
      }
      if (t === 'order' && (opts.length || tail.length)) {
        const src = opts.length ? opts : tail;
        nq.items = src.map((x) => ({ text: x }));
        if (!opts.length) nq.text = lines.slice(0, lines.length - tail.length).join('\n');
        nq._check = true;
      }
      if (t === 'single' && (q.items || q.pairs)) {
        nq.options = (q.items || []).map((x) => x.text).concat((q.pairs || []).map((p) => p.right)).filter(Boolean);
        while (nq.options.length < 2) nq.options.push('');
      }
      model.questions[i] = nq;
      redrawOne(i);
    } else if (f === 'correct') {
      const k = Number(e.target.dataset.k);
      if (q.type === 'multi') q.correct = e.target.checked ? [...new Set([...q.correct, k])] : q.correct.filter((x) => x !== k);
      else q.correct = [k];
      li.querySelector('.qe-warn')?.remove();
    } else if (f === 'multi') {
      q.type = e.target.checked ? 'multi' : 'single';
      if (q.type === 'single') q.correct = q.correct.slice(0, 1);
      redrawOne(i);
    }
    dirty();
  });

  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-do]');
    if (!b) return;
    const li = b.closest('.qe-card');
    const i = Number(li.dataset.i);
    const q = model.questions[i];
    const k = Number(b.dataset.k);
    const act = b.dataset.do;
    if (act === 'del') {
      if (!window.confirm(`Да изтрия ли въпрос ${i + 1}?`)) return;
      model.questions.splice(i, 1);
      draw();
    } else if (act === 'up' || act === 'down') {
      const j = act === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= model.questions.length) return;
      [model.questions[i], model.questions[j]] = [model.questions[j], model.questions[i]];
      draw();
      list.querySelector(`.qe-card[data-i="${j}"] [data-do="${act}"]`)?.focus();
    } else {
      if (act === 'add-opt') q.options.push('');
      if (act === 'del-opt') {
        q.options.splice(k, 1);
        q.correct = q.correct.filter((x) => x !== k).map((x) => (x > k ? x - 1 : x));
      }
      if (act === 'add-pair') q.pairs.push({ left: '', right: '' });
      if (act === 'del-pair') q.pairs.splice(k, 1);
      if (act === 'add-item') q.items.push({ text: '' });
      if (act === 'del-item') q.items.splice(k, 1);
      if (act === 'up-item' && k > 0) [q.items[k - 1], q.items[k]] = [q.items[k], q.items[k - 1]];
      if (act === 'up-item' || act.endsWith('-pair')) delete q._check;
      redrawOne(i);
    }
    dirty();
  });

  $('.qe-add', root).addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    model.questions.push(blank(b.dataset.add));
    draw();
    dirty();
    const last = list.querySelector('.qe-card:last-child .qe-text');
    last?.focus();
    last?.scrollIntoView({ block: 'center' });
  });

  // ---- Поставяне на готов текст ----
  function pasteDialog() {
    const dlg = $('.qe-dlg', root);
    dlg.innerHTML = `
      <h2>Постави готов текст</h2>
      <p class="muted">Всеки въпрос започва с номер („Въпрос 1.“ или „1.“), а отговорите — с буква („А)“, „Б)“…).
        Верния отговор можеш да отбележиш със * накрая или с ред „Отговор: Б“. Ако не го отбележиш, ще го посочиш после.</p>
      <textarea class="input" rows="12" placeholder="Въпрос 1. Какво означава думата „география“?
А) Изучаване на звездите
Б) Земеописание *
В) Изследване на времето"></textarea>
      <p class="paste-preview muted"></p>
      <div class="buttons"><button class="btn ghost" type="button" data-close>Отказ</button>
        <button class="btn" type="button" data-ok disabled>Добави въпросите</button></div>`;
    const ta = $('textarea', dlg);
    const prev = $('.paste-preview', dlg);
    const ok = $('[data-ok]', dlg);
    let parsed = { questions: [] };
    ta.addEventListener('input', () => {
      parsed = parseQuizText(ta.value);
      const qs = parsed.questions;
      const choice = qs.filter((q) => q.type === 'single' || q.type === 'multi');
      const noKey = choice.filter((q) => !q.correct.length).length;
      const open = qs.filter((q) => q.type === 'open').length;
      prev.textContent = qs.length
        ? `Разпознати: ${qs.length} въпроса (${choice.length} с избор на отговор${open ? `, ${open} със свободен отговор` : ''}).${noKey ? ` На ${noKey} ще трябва да отбележиш верния отговор.` : ''}`
        : 'Още не разпознавам въпроси. Провери дали започват с номер.';
      ok.disabled = !qs.length;
    });
    $('[data-close]', dlg).addEventListener('click', () => dlg.close());
    ok.addEventListener('click', () => {
      model.questions.push(...parsed.questions);
      if (!model.title && parsed.title) {
        model.title = parsed.title;
        $('#qe-title', root).value = parsed.title;
      }
      dlg.close();
      draw();
      dirty();
      toast(`Добавени са ${parsed.questions.length} въпроса. Провери ги и отбележи верните отговори.`);
      list.querySelector('.qe-warn')?.closest('.qe-card')?.scrollIntoView({ block: 'center' });
    });
    dlg.showModal();
    ta.focus();
  }

  // ---- Запис ----
  async function save(status) {
    const err = $('.error-box', root);
    err.textContent = '';
    model.title = $('#qe-title', root).value;
    model.intro = $('#qe-intro', root).value;
    model.tab = $('#qe-tab', root).value;
    model.maxAttempts = $('#qe-att', root).value ? Number($('#qe-att', root).value) : null;
    model.showAnswers = $('#qe-show', root).checked;
    // празните редове не се пращат
    const questions = model.questions.map(({ _check, ...q }) => ({
      ...q,
      ...(q.options ? (() => {
        const keep = q.options.map((o, k) => [o.trim(), k]).filter(([o]) => o);
        return { options: keep.map(([o]) => o), correct: q.correct.map((c) => keep.findIndex(([, k]) => k === c)).filter((x) => x >= 0) };
      })() : {}),
      ...(q.pairs ? { pairs: q.pairs.filter((p) => p.left.trim() || p.right.trim()) } : {}),
      ...(q.items ? { items: q.items.filter((it) => it.text.trim()) } : {}),
      ...(q.answers ? { answers: q.answers.map((a) => a.trim()).filter(Boolean) } : {}),
    }));
    const body = { ...model, questions, status, section: slug };
    $$('.editor-bar button', root).forEach((b) => (b.disabled = true));
    try {
      if (quizId) await api(`/quizzes/${quizId}`, { method: 'PUT', body });
      else await api('/quizzes', { method: 'POST', body });
      dirty(false);
      toast(status === 'published' ? 'Тестът е публикуван — учениците вече го виждат.' : 'Тестът е запазен като чернова.');
      onDone(true);
    } catch (ex) {
      err.textContent = ex.message;
      err.scrollIntoView({ block: 'center' });
      // покажи кой въпрос е проблемът
      const n = ex.message.match(/^Въпрос (\d+)/)?.[1];
      if (n) list.querySelector(`.qe-card[data-i="${Number(n) - 1}"]`)?.scrollIntoView({ block: 'center' });
    } finally {
      $$('.editor-bar button', root).forEach((b) => (b.disabled = false));
    }
  }

  root.querySelector('.editor-bar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-e]');
    if (!b) return;
    if (b.dataset.e === 'cancel') {
      if (!window.confirm('Да се откажа ли? Незапазените промени ще се изгубят.')) return;
      dirty(false);
      onDone(false);
    } else if (b.dataset.e === 'save-draft') save('draft');
    else if (b.dataset.e === 'publish') save('published');
  });
  $('[data-e="paste"]', root).addEventListener('click', pasteDialog);
  ['#qe-title', '#qe-intro', '#qe-tab', '#qe-att', '#qe-show'].forEach((s) => $(s, root).addEventListener('change', () => dirty()));

  draw();
  if (!quizId) $('#qe-title', root).focus();
}
