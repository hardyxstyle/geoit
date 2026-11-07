-- ГеоКомпас — схема на базата (Cloudflare D1 / SQLite)
-- Сайтът създава тези таблици сам при първото отваряне (виж server/setup.js)


-- Потребители: ученици, учители, админ
CREATE TABLE IF NOT EXISTS users (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  email                 TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name                  TEXT NOT NULL,
  password_hash         TEXT NOT NULL,
  password_salt         TEXT NOT NULL,
  role                  TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'blocked')),
  grade                 INTEGER CHECK (grade IS NULL OR grade BETWEEN 5 AND 7),
  class_letter          TEXT,
  must_change_password  INTEGER NOT NULL DEFAULT 0,
  approved_by           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at           TEXT,
  last_login_at         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS users_status_role ON users (status, role);

-- Сесии (бисквитка с произволен токен; в базата пазим само хеша му)
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,            -- unix време в ms
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

-- Дърво на съдържанието:
--   grade (5., 6., 7. клас) → theme (тема от програмата) → topic (подтема / урок)
--   area (Школи, състезания, олимпиади) → page
CREATE TABLE IF NOT EXISTS sections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  parent_id   INTEGER REFERENCES sections(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('grade', 'theme', 'topic', 'area', 'page')),
  grade       INTEGER,
  code        TEXT,                        -- номерация по програмата, напр. 1.3
  title       TEXT NOT NULL,
  summary     TEXT,                        -- едно-две изречения за темата
  goals       TEXT,                        -- JSON масив: „Какво ще научиш“
  body        TEXT,                        -- текстът на урока (HTML от редактора)
  body_text   TEXT,                        -- същият текст без форматиране — за търсенето
  sort        INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT,
  updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS sections_parent ON sections (parent_id, sort);

-- Полезни връзки (външни сайтове)
CREATE TABLE IF NOT EXISTS links (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  category     TEXT NOT NULL,
  title        TEXT NOT NULL,
  url          TEXT NOT NULL,
  description  TEXT,
  sort         INTEGER NOT NULL DEFAULT 0,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Материали към урок или страница: качен файл или линк
CREATE TABLE IF NOT EXISTS materials (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id   INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('file', 'link')),
  title        TEXT NOT NULL,
  description  TEXT,
  url          TEXT,                       -- само за линк
  file_name    TEXT,
  mime         TEXT,
  size         INTEGER,                    -- байтове
  chunks       INTEGER,                    -- на колко части е разделен файлът
  chunk_size   INTEGER,                    -- байта в една част
  audience     TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'teachers')),
  tab          TEXT NOT NULL DEFAULT 'materiali',  -- urok, karti, zadachi, materiali
  status       TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('uploading', 'ready')),
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT
);
CREATE INDEX IF NOT EXISTS materials_section ON materials (section_id, status);
CREATE INDEX IF NOT EXISTS materials_recent ON materials (status, created_at);

-- Съдържанието на файловете: части до 256 KB, записани като base64 текст
CREATE TABLE IF NOT EXISTS material_chunks (
  material_id  INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  idx          INTEGER NOT NULL,
  data         TEXT NOT NULL,
  PRIMARY KEY (material_id, idx)
);

-- Предишни версии на текста на урока (пазим последните 5)
CREATE TABLE IF NOT EXISTS section_revisions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id  INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  tab         TEXT NOT NULL DEFAULT 'urok',
  body        TEXT,
  body_text   TEXT,
  updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS section_revisions_section ON section_revisions (section_id, id);

-- Текст в табовете „Карти и графики“, „Задачи и тестове“, „Материали“
-- (текстът на таб „Урок“ е в sections.body)
CREATE TABLE IF NOT EXISTS tab_texts (
  section_id  INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  tab         TEXT NOT NULL,
  body        TEXT,
  body_text   TEXT,
  updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TEXT,
  PRIMARY KEY (section_id, tab)
);

-- Тестове. Въпросите са в JSON (виж server/routes-quizzes.js)
CREATE TABLE IF NOT EXISTS quizzes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id    INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  tab           TEXT NOT NULL DEFAULT 'zadachi',
  title         TEXT NOT NULL,
  intro         TEXT,
  questions     TEXT NOT NULL,
  max_attempts  INTEGER,                       -- NULL = без ограничение
  show_answers  INTEGER NOT NULL DEFAULT 1,    -- показва верните отговори след предаване
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at    TEXT
);
CREATE INDEX IF NOT EXISTS quizzes_section ON quizzes (section_id, status);

-- Опити на учениците
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id      INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers      TEXT NOT NULL,                  -- JSON: отговорите
  results      TEXT NOT NULL,                  -- JSON: точки по въпрос
  score        REAL NOT NULL,
  max_score    REAL NOT NULL,
  pending      INTEGER NOT NULL DEFAULT 0,     -- свободни отговори, които чакат оценка
  feedback     TEXT,                           -- коментар от учителя
  reviewed_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS quiz_attempts_quiz ON quiz_attempts (quiz_id, user_id);
CREATE INDEX IF NOT EXISTS quiz_attempts_user ON quiz_attempts (user_id, created_at);

-- Кои уроци е отворил ученикът
CREATE TABLE IF NOT EXISTS lesson_views (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_id  INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  first_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_at     TEXT NOT NULL DEFAULT (datetime('now')),
  views       INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, section_id)
);
CREATE INDEX IF NOT EXISTS lesson_views_section ON lesson_views (section_id);
