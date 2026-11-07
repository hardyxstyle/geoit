// Тестове: създаване, решаване, автоматична проверка, резултати, оценка на свободни отговори.
//
// Въпросите се пазят като JSON масив. Видове:
//   single — един верен отговор        { options: [..], correct: [i] }
//   multi  — няколко верни отговора    { options: [..], correct: [i, j] }
//   match  — свързване                 { pairs: [{ left, right, key }] }
//   order  — подреждане                { items: [{ text, key }] }  (в правилния ред)
//   short  — кратък отговор            { answers: ['Земеописание', ..] }
//   open   — свободен отговор, оценява го учителят
// Всеки въпрос има id, text, points и по желание explain (обяснение след предаване).
// Верните отговори не стигат до ученика преди да предаде.
import { json, fail, readJson, clean } from './http.js';
import { currentUser, requireActive, requireStaff } from './auth.js';

const TYPES = ['single', 'multi', 'match', 'order', 'short', 'open'];
const TABS = ['urok', 'karti', 'zadachi', 'materiali'];
const MAX_QUESTIONS = 100;

const isStaff = (u) => u.role === 'teacher' || u.role === 'admin';
const rid = () => [...crypto.getRandomValues(new Uint8Array(5))].map((b) => b.toString(16).padStart(2, '0')).join('');
const okId = (v) => (typeof v === 'string' && /^[a-z0-9]{4,16}$/.test(v) ? v : null);
const round2 = (n) => Math.round(n * 100) / 100;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// разбъркано, но не в правилния ред (иначе подреждането е подарък)
function shuffleNot(arr, same) {
  if (arr.length < 2) return arr;
  for (let k = 0; k < 10; k++) {
    const s = shuffle(arr);
    if (!same(s)) return s;
  }
  return [...arr].reverse();
}

// ---------- Проверка на въпросите при запис ----------
function normQuestion(q, i) {
  const n = i + 1;
  const type = TYPES.includes(q?.type) ? q.type : 'single';
  const text = clean(q?.text, 3000);
  if (!text) fail(400, `Въпрос ${n}: липсва текст на въпроса.`);
  const points = Math.min(100, Math.max(0.5, Number(q.points) || 1));
  const out = { id: okId(q.id) || rid(), type, text, points, explain: clean(q.explain, 1500) || '' };
  const strs = (arr, max = 500) => (Array.isArray(arr) ? arr.map((x) => clean(String(x ?? ''), max)) : []);

  if (type === 'single' || type === 'multi') {
    out.options = strs(q.options).filter(Boolean).slice(0, 10);
    if (out.options.length < 2) fail(400, `Въпрос ${n}: трябват поне 2 отговора за избор.`);
    const correct = [...new Set((Array.isArray(q.correct) ? q.correct : [q.correct]).map(Number))]
      .filter((x) => Number.isInteger(x) && x >= 0 && x < out.options.length)
      .sort((a, b) => a - b);
    if (!correct.length) fail(400, `Въпрос ${n}: отбележи кой е верният отговор.`);
    if (type === 'single' && correct.length > 1) out.type = 'multi';
    out.correct = correct;
  } else if (type === 'match') {
    out.pairs = (Array.isArray(q.pairs) ? q.pairs : [])
      .map((p) => ({ left: clean(p?.left, 500), right: clean(p?.right, 500), key: okId(p?.key) || rid() }))
      .filter((p) => p.left && p.right)
      .slice(0, 12);
    if (out.pairs.length < 2) fail(400, `Въпрос ${n}: трябват поне 2 двойки за свързване.`);
  } else if (type === 'order') {
    out.items = (Array.isArray(q.items) ? q.items : [])
      .map((it) => ({ text: clean(typeof it === 'string' ? it : it?.text, 500), key: okId(it?.key) || rid() }))
      .filter((it) => it.text)
      .slice(0, 12);
    if (out.items.length < 2) fail(400, `Въпрос ${n}: трябват поне 2 неща за подреждане.`);
  } else if (type === 'short') {
    out.answers = strs(q.answers, 200).filter(Boolean).slice(0, 10);
    if (!out.answers.length) fail(400, `Въпрос ${n}: напиши поне един верен отговор.`);
  }
  return out;
}

function readQuiz(b) {
  const title = clean(b.title, 200);
  if (title.length < 2) fail(400, 'Напиши заглавие на теста.');
  if (!Array.isArray(b.questions) || !b.questions.length) fail(400, 'Добави поне един въпрос.');
  if (b.questions.length > MAX_QUESTIONS) fail(400, `Най-много ${MAX_QUESTIONS} въпроса в един тест.`);
  const questions = b.questions.map(normQuestion);
  const seen = new Set();
  questions.forEach((q) => {
    while (seen.has(q.id)) q.id = rid();
    seen.add(q.id);
  });
  const maxAttempts = Number(b.maxAttempts);
  return {
    title,
    intro: clean(b.intro, 3000) || null,
    questions,
    tab: TABS.includes(b.tab) ? b.tab : 'zadachi',
    maxAttempts: Number.isInteger(maxAttempts) && maxAttempts > 0 ? Math.min(maxAttempts, 50) : null,
    showAnswers: b.showAnswers === false ? 0 : 1,
    status: b.status === 'published' ? 'published' : 'draft',
  };
}

// ---------- Как го вижда ученикът (без верните отговори) ----------
function publicQuestion(q) {
  const base = { id: q.id, type: q.type, text: q.text, points: q.points };
  if (q.type === 'single' || q.type === 'multi') return { ...base, options: q.options };
  if (q.type === 'match') {
    return {
      ...base,
      lefts: q.pairs.map((p) => p.left),
      rights: shuffle(q.pairs.map((p) => ({ key: p.key, text: p.right }))),
    };
  }
  if (q.type === 'order') {
    const correct = q.items.map((i) => i.key).join();
    return {
      ...base,
      items: shuffleNot(q.items.map((i) => ({ key: i.key, text: i.text })), (s) => s.map((i) => i.key).join() === correct),
    };
  }
  return base;
}

// ---------- Проверка на отговорите ----------
const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[„“"'«».,;:!?()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function gradeOne(q, a) {
  const max = q.points;
  const r = { id: q.id, max, points: 0, correct: false };
  if (q.type === 'single') {
    r.correct = Number(a) === q.correct[0];
  } else if (q.type === 'multi') {
    const given = [...new Set((Array.isArray(a) ? a : []).map(Number))].sort((x, y) => x - y);
    r.correct = given.join() === q.correct.join();
  } else if (q.type === 'match') {
    const given = Array.isArray(a) ? a : [];
    const hit = q.pairs.filter((p, i) => given[i] === p.key).length;
    r.points = round2((max * hit) / q.pairs.length);
    r.correct = hit === q.pairs.length;
    return r;
  } else if (q.type === 'order') {
    const given = Array.isArray(a) ? a : [];
    const hit = q.items.filter((it, i) => given[i] === it.key).length;
    r.points = round2((max * hit) / q.items.length);
    r.correct = hit === q.items.length;
    return r;
  } else if (q.type === 'short') {
    const g = norm(a);
    r.correct = !!g && q.answers.some((x) => norm(x) === g);
  } else if (q.type === 'open') {
    r.correct = null; // чака учителя
    r.pending = true;
    return r;
  }
  r.points = r.correct ? max : 0;
  return r;
}

// Какво е отговорил ученикът — пази се изчистено
function cleanAnswer(q, a) {
  if (q.type === 'single') return Number.isInteger(Number(a)) && a !== null && a !== '' ? Number(a) : null;
  if (q.type === 'multi') return Array.isArray(a) ? a.map(Number).filter(Number.isInteger).slice(0, 10) : [];
  if (q.type === 'match' || q.type === 'order') return Array.isArray(a) ? a.map((x) => okId(x)).slice(0, 12) : [];
  return clean(String(a ?? ''), q.type === 'open' ? 5000 : 300);
}

// ---------- Зареждане ----------
async function loadQuiz(env, id) {
  const q = await env.DB.prepare(
    `SELECT q.*, s.slug, s.title AS section_title, s.code, s.grade FROM quizzes q JOIN sections s ON s.id = q.section_id WHERE q.id = ?`,
  )
    .bind(Number(id))
    .first();
  if (!q) fail(404, 'Няма такъв тест.');
  q.questions = JSON.parse(q.questions);
  return q;
}

const summary = (q) => ({
  id: q.id,
  title: q.title,
  intro: q.intro,
  tab: q.tab,
  status: q.status,
  maxAttempts: q.max_attempts,
  showAnswers: !!q.show_answers,
  questionCount: q.questions.length,
  maxScore: round2(q.questions.reduce((s, x) => s + x.points, 0)),
  hasOpen: q.questions.some((x) => x.type === 'open'),
});

// ---------- Списък на тестовете в урок ----------
export async function listForSection(env, me, sectionId) {
  const staff = isStaff(me);
  const { results } = await env.DB.prepare(
    `SELECT q.*, u.name AS author FROM quizzes q LEFT JOIN users u ON u.id = q.created_by
      WHERE q.section_id = ?1 AND (q.status = 'published' OR ?2) ORDER BY q.created_at, q.id`,
  )
    .bind(sectionId, staff ? 1 : 0)
    .all();
  if (!results.length) return [];
  const ids = results.map((r) => r.id);
  const marks = ids.map(() => '?').join(',');
  // За ученика — неговите опити; за учителя — колко ученици са решили
  const stats = staff
    ? await env.DB.prepare(
        `SELECT quiz_id, COUNT(DISTINCT user_id) AS students, COUNT(*) AS attempts, SUM(pending > 0) AS pending
           FROM quiz_attempts WHERE quiz_id IN (${marks}) GROUP BY quiz_id`,
      ).bind(...ids).all()
    : await env.DB.prepare(
        `SELECT quiz_id, COUNT(*) AS attempts, MAX(score / max_score) AS best, SUM(pending > 0) AS pending,
                (SELECT id FROM quiz_attempts b WHERE b.quiz_id = a.quiz_id AND b.user_id = ?1 ORDER BY b.id DESC LIMIT 1) AS last_id
           FROM quiz_attempts a WHERE user_id = ?1 AND quiz_id IN (${ids.map((_, i) => '?' + (i + 2)).join(',')}) GROUP BY quiz_id`,
      ).bind(me.id, ...ids).all();
  const by = Object.fromEntries(stats.results.map((s) => [s.quiz_id, s]));
  return results.map((r) => {
    r.questions = JSON.parse(r.questions);
    const st = by[r.id] || {};
    return {
      ...summary(r),
      author: r.author,
      canDelete: me.role === 'admin' || r.created_by === me.id,
      ...(staff
        ? { students: st.students || 0, attempts: st.attempts || 0, pending: st.pending || 0 }
        : { attempts: st.attempts || 0, best: st.best ?? null, pending: st.pending || 0, lastAttemptId: st.last_id || null }),
    };
  });
}

// ---------- Учител: създаване и промяна ----------
export async function get(env, request, id) {
  requireStaff(await currentUser(env, request));
  const q = await loadQuiz(env, id);
  return json({ quiz: { ...summary(q), questions: q.questions } });
}

export async function create(env, request) {
  const me = requireStaff(await currentUser(env, request));
  const b = await readJson(request);
  const s = await env.DB.prepare("SELECT id FROM sections WHERE slug = ? AND kind IN ('topic', 'page')").bind(clean(b.section, 120)).first();
  if (!s) fail(404, 'Няма такъв урок.');
  const d = readQuiz(b);
  const res = await env.DB.prepare(
    `INSERT INTO quizzes (section_id, tab, title, intro, questions, max_attempts, show_answers, status, created_by, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
  )
    .bind(s.id, d.tab, d.title, d.intro, JSON.stringify(d.questions), d.maxAttempts, d.showAnswers, d.status, me.id, me.id)
    .run();
  return json({ id: res.meta.last_row_id }, 201);
}

export async function update(env, request, id) {
  const me = requireStaff(await currentUser(env, request));
  const q = await loadQuiz(env, id);
  const d = readQuiz(await readJson(request));
  await env.DB.prepare(
    `UPDATE quizzes SET tab = ?, title = ?, intro = ?, questions = ?, max_attempts = ?, show_answers = ?, status = ?,
            updated_by = ?, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(d.tab, d.title, d.intro, JSON.stringify(d.questions), d.maxAttempts, d.showAnswers, d.status, me.id, q.id)
    .run();
  return json({ ok: true });
}

export async function remove(env, request, id) {
  const me = requireStaff(await currentUser(env, request));
  const q = await loadQuiz(env, id);
  if (me.role !== 'admin' && q.created_by !== me.id) fail(403, 'Само този, който е направил теста, или администраторът може да го изтрие.');
  await env.DB.batch([
    env.DB.prepare('DELETE FROM quiz_attempts WHERE quiz_id = ?').bind(q.id),
    env.DB.prepare('DELETE FROM quizzes WHERE id = ?').bind(q.id),
  ]);
  return json({ ok: true });
}

// ---------- Ученик: решаване ----------
async function attemptsUsed(env, quizId, userId) {
  return (await env.DB.prepare('SELECT COUNT(*) AS n FROM quiz_attempts WHERE quiz_id = ? AND user_id = ?').bind(quizId, userId).first()).n;
}

export async function take(env, request, id) {
  const me = requireActive(await currentUser(env, request));
  const q = await loadQuiz(env, id);
  const staff = isStaff(me);
  if (q.status !== 'published' && !staff) fail(404, 'Няма такъв тест.');
  const used = staff ? 0 : await attemptsUsed(env, q.id, me.id);
  if (q.max_attempts && used >= q.max_attempts) fail(403, 'Изчерпа опитите за този тест.');
  return json({
    quiz: { ...summary(q), questions: q.questions.map(publicQuestion) },
    attemptsUsed: used,
    preview: staff,
  });
}

export async function submit(env, request, id) {
  const me = requireActive(await currentUser(env, request));
  const q = await loadQuiz(env, id);
  const staff = isStaff(me);
  if (q.status !== 'published' && !staff) fail(404, 'Няма такъв тест.');
  const b = await readJson(request);
  const given = b.answers && typeof b.answers === 'object' ? b.answers : {};

  const answers = {};
  const results = q.questions.map((qq) => {
    answers[qq.id] = cleanAnswer(qq, given[qq.id]);
    return gradeOne(qq, answers[qq.id]);
  });
  const score = round2(results.reduce((s, r) => s + r.points, 0));
  const maxScore = round2(results.reduce((s, r) => s + r.max, 0));
  const pending = results.filter((r) => r.pending).length;

  let attemptId = null;
  if (!staff) {
    if (q.max_attempts && (await attemptsUsed(env, q.id, me.id)) >= q.max_attempts) fail(403, 'Изчерпа опитите за този тест.');
    const res = await env.DB.prepare(
      'INSERT INTO quiz_attempts (quiz_id, user_id, answers, results, score, max_score, pending) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(q.id, me.id, JSON.stringify(answers), JSON.stringify(results), score, maxScore, pending)
      .run();
    attemptId = res.meta.last_row_id;
  }
  return json({
    attemptId,
    preview: staff,
    score,
    maxScore,
    pending,
    review: detail(q, { answers, results }, staff || !!q.show_answers),
  });
}

// Въпрос по въпрос: какво е отговорено, колко точки, кое е вярно
function detail(q, att, showCorrect) {
  const res = Object.fromEntries(att.results.map((r) => [r.id, r]));
  return q.questions.map((qq) => {
    const r = res[qq.id] || { points: 0, max: qq.points, correct: false };
    const a = att.answers[qq.id];
    const item = { id: qq.id, type: qq.type, text: qq.text, points: r.points, max: r.max, correct: r.correct, pending: !!r.pending, comment: r.comment || '' };
    if (qq.type === 'single' || qq.type === 'multi') {
      item.options = qq.options;
      item.given = qq.type === 'single' ? (a === null || a === undefined ? [] : [a]) : a || [];
      if (showCorrect) item.right = qq.correct;
    } else if (qq.type === 'match') {
      const byKey = Object.fromEntries(qq.pairs.map((p) => [p.key, p.right]));
      item.lefts = qq.pairs.map((p) => p.left);
      item.given = qq.pairs.map((_, i) => byKey[(a || [])[i]] || null);
      if (showCorrect) item.right = qq.pairs.map((p) => p.right);
    } else if (qq.type === 'order') {
      const byKey = Object.fromEntries(qq.items.map((i) => [i.key, i.text]));
      item.given = (a || []).map((k) => byKey[k] || null);
      if (showCorrect) item.right = qq.items.map((i) => i.text);
    } else {
      item.given = a ?? '';
      if (showCorrect && qq.type === 'short') item.right = qq.answers;
    }
    if (showCorrect && qq.explain) item.explain = qq.explain;
    return item;
  });
}

// ---------- Резултати ----------
export async function results(env, request, id) {
  requireStaff(await currentUser(env, request));
  const q = await loadQuiz(env, id);
  const { results: rows } = await env.DB.prepare(
    `SELECT a.id, a.user_id, a.score, a.max_score, a.pending, a.results, a.created_at, a.feedback,
            u.name, u.grade, u.class_letter
       FROM quiz_attempts a JOIN users u ON u.id = a.user_id
      WHERE a.quiz_id = ? ORDER BY u.grade, u.class_letter, u.name, a.id`,
  )
    .bind(q.id)
    .all();

  // По ученик: брой опити, най-добър и последен резултат
  const students = new Map();
  const qStats = Object.fromEntries(q.questions.map((x) => [x.id, { answered: 0, points: 0, max: 0 }]));
  for (const r of rows) {
    const pct = r.max_score ? r.score / r.max_score : 0;
    const s = students.get(r.user_id) || {
      userId: r.user_id, name: r.name, grade: r.grade, classLetter: r.class_letter, attempts: 0, best: 0, last: null, pending: 0,
    };
    s.attempts += 1;
    s.best = Math.max(s.best, pct);
    s.last = { id: r.id, pct, score: r.score, maxScore: r.max_score, at: r.created_at, pending: r.pending };
    s.pending += r.pending ? 1 : 0;
    students.set(r.user_id, s);
  }
  // Колко добре се справят с всеки въпрос (по последния опит на всеки ученик)
  for (const s of students.values()) {
    const last = rows.find((r) => r.id === s.last.id);
    for (const res of JSON.parse(last.results)) {
      const st = qStats[res.id];
      if (!st || res.pending) continue;
      st.answered += 1;
      st.points += res.points;
      st.max += res.max;
    }
  }
  return json({
    quiz: { ...summary(q), section: { slug: q.slug, title: q.section_title, code: q.code, grade: q.grade } },
    students: [...students.values()],
    questions: q.questions.map((x, i) => ({
      n: i + 1,
      id: x.id,
      text: x.text,
      type: x.type,
      answered: qStats[x.id].answered,
      pct: qStats[x.id].max ? qStats[x.id].points / qStats[x.id].max : null,
    })),
  });
}

export async function attempt(env, request, id) {
  const me = requireActive(await currentUser(env, request));
  const a = await env.DB.prepare(
    `SELECT a.*, u.name, u.grade, u.class_letter, r.name AS reviewer FROM quiz_attempts a
       JOIN users u ON u.id = a.user_id LEFT JOIN users r ON r.id = a.reviewed_by WHERE a.id = ?`,
  )
    .bind(Number(id))
    .first();
  if (!a || (a.user_id !== me.id && !isStaff(me))) fail(404, 'Няма такъв опит.');
  const q = await loadQuiz(env, a.quiz_id);
  const att = { answers: JSON.parse(a.answers), results: JSON.parse(a.results) };
  return json({
    attempt: {
      id: a.id,
      student: { id: a.user_id, name: a.name, grade: a.grade, classLetter: a.class_letter },
      score: a.score,
      maxScore: a.max_score,
      pending: a.pending,
      feedback: a.feedback,
      reviewer: a.reviewer,
      createdAt: a.created_at,
    },
    quiz: { ...summary(q), section: { slug: q.slug, title: q.section_title, code: q.code, grade: q.grade } },
    review: detail(q, att, isStaff(me) || !!q.show_answers),
  });
}

// Учителят оценява свободните отговори (и може да промени точките на всеки въпрос)
export async function review(env, request, id) {
  const me = requireStaff(await currentUser(env, request));
  const a = await env.DB.prepare('SELECT * FROM quiz_attempts WHERE id = ?').bind(Number(id)).first();
  if (!a) fail(404, 'Няма такъв опит.');
  const b = await readJson(request);
  const pts = b.points && typeof b.points === 'object' ? b.points : {};
  const comments = b.comments && typeof b.comments === 'object' ? b.comments : {};
  const results = JSON.parse(a.results).map((r) => {
    if (pts[r.id] !== undefined && pts[r.id] !== null && pts[r.id] !== '') {
      const p = Math.min(r.max, Math.max(0, Number(pts[r.id]) || 0));
      r.points = round2(p);
      r.correct = p >= r.max;
      delete r.pending;
    }
    if (comments[r.id] !== undefined) r.comment = clean(String(comments[r.id]), 1000) || undefined;
    return r;
  });
  const score = round2(results.reduce((s, r) => s + r.points, 0));
  const pending = results.filter((r) => r.pending).length;
  await env.DB.prepare(
    "UPDATE quiz_attempts SET results = ?, score = ?, pending = ?, feedback = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?",
  )
    .bind(JSON.stringify(results), score, pending, clean(b.feedback, 2000) || null, me.id, a.id)
    .run();
  return json({ ok: true, score, pending });
}
