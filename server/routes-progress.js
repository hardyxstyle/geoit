// Напредък: кои уроци е отворил ученикът и как се справя с тестовете
import { json, fail } from './http.js';
import { currentUser, requireActive, requireStaff } from './auth.js';

// Ученикът отвори урок — записваме го (за учители и админ не броим)
export async function view(env, request, slug) {
  const me = requireActive(await currentUser(env, request));
  if (me.role !== 'student') return json({ ok: true });
  const s = await env.DB.prepare("SELECT id FROM sections WHERE slug = ? AND kind IN ('topic', 'page')").bind(slug).first();
  if (!s) return json({ ok: true });
  await env.DB.prepare(
    `INSERT INTO lesson_views (user_id, section_id) VALUES (?, ?)
     ON CONFLICT (user_id, section_id) DO UPDATE SET views = views + 1, last_at = datetime('now')`,
  )
    .bind(me.id, s.id)
    .run();
  return json({ ok: true });
}

// Таблица за клас: ученици × тестове + колко урока са отворили
export async function classProgress(env, request) {
  requireStaff(await currentUser(env, request));
  const url = new URL(request.url);
  const grade = Number(url.searchParams.get('grade'));
  if (![5, 6, 7].includes(grade)) fail(400, 'Избери клас.');
  const letter = (url.searchParams.get('letter') || '').trim().toUpperCase().slice(0, 1);

  const { results: students } = await env.DB.prepare(
    `SELECT id, name, class_letter, last_login_at FROM users
      WHERE role = 'student' AND status = 'active' AND grade = ?1 AND (?2 = '' OR class_letter = ?2)
      ORDER BY class_letter, name`,
  )
    .bind(grade, letter)
    .all();

  const { n: lessons } = await env.DB.prepare("SELECT COUNT(*) AS n FROM sections WHERE kind = 'topic' AND grade = ?").bind(grade).first();

  // Тестовете от уроците на класа + от „Школи и състезания“
  const { results: quizzes } = await env.DB.prepare(
    `SELECT q.id, q.title, s.slug, s.code, s.title AS section_title, s.grade
       FROM quizzes q JOIN sections s ON s.id = q.section_id
       LEFT JOIN sections th ON th.id = s.parent_id
      WHERE q.status = 'published' AND (s.grade = ?1 OR s.grade IS NULL OR EXISTS (
              SELECT 1 FROM quiz_attempts a JOIN users u ON u.id = a.user_id
               WHERE a.quiz_id = q.id AND u.grade = ?1 AND (?2 = '' OR u.class_letter = ?2)))
      ORDER BY s.grade IS NULL, s.grade <> ?1, th.sort, s.sort, q.id`,
  )
    .bind(grade, letter)
    .all();

  let views = [];
  let scores = [];
  let classes = [];
  if (students.length) {
    ({ results: views } = await env.DB.prepare(
      `SELECT v.user_id, COUNT(*) AS n, MAX(v.last_at) AS last FROM lesson_views v
         JOIN sections s ON s.id = v.section_id JOIN users u ON u.id = v.user_id
        WHERE s.grade = ?1 AND u.grade = ?1 AND (?2 = '' OR u.class_letter = ?2) GROUP BY v.user_id`,
    )
      .bind(grade, letter)
      .all());
    ({ results: scores } = await env.DB.prepare(
      `SELECT a.user_id, a.quiz_id, MAX(a.score / a.max_score) AS best, COUNT(*) AS n, SUM(a.pending > 0) AS pending
         FROM quiz_attempts a JOIN users u ON u.id = a.user_id
        WHERE u.grade = ?1 AND (?2 = '' OR u.class_letter = ?2) GROUP BY a.user_id, a.quiz_id`,
    )
      .bind(grade, letter)
      .all());
  }
  ({ results: classes } = await env.DB.prepare(
    "SELECT DISTINCT class_letter FROM users WHERE role = 'student' AND status = 'active' AND grade = ? AND class_letter IS NOT NULL ORDER BY class_letter",
  )
    .bind(grade)
    .all());

  const used = new Set(scores.map((s) => s.quiz_id));
  return json({
    grade,
    letter,
    letters: classes.map((c) => c.class_letter),
    lessons,
    // в таблицата — само тестове от класа или такива, които някой от тези ученици е решавал
    quizzes: quizzes
      .filter((q) => q.grade === grade || used.has(q.id))
      .map((q) => ({ id: q.id, title: q.title, section: { slug: q.slug, code: q.code, title: q.section_title, grade: q.grade } })),
    students: students.map((s) => {
      const v = views.find((x) => x.user_id === s.id);
      return {
        id: s.id,
        name: s.name,
        classLetter: s.class_letter,
        lastLogin: s.last_login_at,
        lessonsSeen: v?.n || 0,
        lastSeen: v?.last || null,
        scores: Object.fromEntries(
          scores.filter((x) => x.user_id === s.id).map((x) => [x.quiz_id, { best: x.best, attempts: x.n, pending: x.pending }]),
        ),
      };
    }),
  });
}

// Подробно за един ученик (учител) или за себе си (ученик)
async function studentDetail(env, userId) {
  const u = await env.DB.prepare("SELECT id, name, grade, class_letter, last_login_at FROM users WHERE id = ? AND role = 'student'")
    .bind(userId)
    .first();
  if (!u) fail(404, 'Няма такъв ученик.');
  const { results: lessons } = await env.DB.prepare(
    `SELECT s.slug, s.code, s.title, s.grade, v.first_at, v.last_at, v.views
       FROM lesson_views v JOIN sections s ON s.id = v.section_id WHERE v.user_id = ? ORDER BY v.last_at DESC LIMIT 300`,
  )
    .bind(u.id)
    .all();
  const { results: attempts } = await env.DB.prepare(
    `SELECT a.id, a.score, a.max_score, a.pending, a.feedback, a.created_at, q.id AS quiz_id, q.title, q.tab,
            s.slug, s.code, s.title AS section_title, s.grade
       FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id JOIN sections s ON s.id = q.section_id
      WHERE a.user_id = ? ORDER BY a.id DESC LIMIT 300`,
  )
    .bind(u.id)
    .all();
  const total = u.grade
    ? (await env.DB.prepare("SELECT COUNT(*) AS n FROM sections WHERE kind = 'topic' AND grade = ?").bind(u.grade).first()).n
    : 0;
  return {
    student: { id: u.id, name: u.name, grade: u.grade, classLetter: u.class_letter, lastLogin: u.last_login_at },
    lessonsTotal: total,
    lessons: lessons.map((l) => ({ slug: l.slug, code: l.code, title: l.title, grade: l.grade, firstAt: l.first_at, lastAt: l.last_at, views: l.views })),
    attempts: attempts.map((a) => ({
      id: a.id,
      quizId: a.quiz_id,
      title: a.title,
      tab: a.tab,
      score: a.score,
      maxScore: a.max_score,
      pending: a.pending,
      feedback: a.feedback,
      createdAt: a.created_at,
      section: { slug: a.slug, code: a.code, title: a.section_title, grade: a.grade },
    })),
  };
}

export async function student(env, request, id) {
  requireStaff(await currentUser(env, request));
  return json(await studentDetail(env, Number(id)));
}

export async function mine(env, request) {
  const me = requireActive(await currentUser(env, request));
  if (me.role !== 'student') fail(400, 'Напредъкът се води само за ученици.');
  return json(await studentDetail(env, me.id));
}
