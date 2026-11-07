// Генерирано от db/build-seed.mjs — не редактирай на ръка
export const schema = [
 "CREATE TABLE IF NOT EXISTS users ( id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')), status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'blocked')), grade INTEGER CHECK (grade IS NULL OR grade BETWEEN 5 AND 7), class_letter TEXT, must_change_password INTEGER NOT NULL DEFAULT 0, approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL, approved_at TEXT, last_login_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')) )",
 "CREATE INDEX IF NOT EXISTS users_status_role ON users (status, role)",
 "CREATE TABLE IF NOT EXISTS sessions ( token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')) )",
 "CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id)",
 "CREATE TABLE IF NOT EXISTS sections ( id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, parent_id INTEGER REFERENCES sections(id) ON DELETE CASCADE, kind TEXT NOT NULL CHECK (kind IN ('grade', 'theme', 'topic', 'area', 'page')), grade INTEGER, code TEXT, title TEXT NOT NULL, summary TEXT, goals TEXT, body TEXT, body_text TEXT, sort INTEGER NOT NULL DEFAULT 0, lesson_type TEXT, updated_at TEXT, updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL )",
 "CREATE INDEX IF NOT EXISTS sections_parent ON sections (parent_id, sort)",
 "CREATE TABLE IF NOT EXISTS links ( id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, description TEXT, sort INTEGER NOT NULL DEFAULT 0, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')) )",
 "CREATE TABLE IF NOT EXISTS materials ( id INTEGER PRIMARY KEY AUTOINCREMENT, section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE, kind TEXT NOT NULL CHECK (kind IN ('file', 'link')), title TEXT NOT NULL, description TEXT, url TEXT, file_name TEXT, mime TEXT, size INTEGER, chunks INTEGER, chunk_size INTEGER, audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'teachers')), tab TEXT NOT NULL DEFAULT 'materiali', status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('uploading', 'ready')), created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT )",
 "CREATE INDEX IF NOT EXISTS materials_section ON materials (section_id, status)",
 "CREATE INDEX IF NOT EXISTS materials_recent ON materials (status, created_at)",
 "CREATE TABLE IF NOT EXISTS material_chunks ( material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE, idx INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (material_id, idx) )",
 "CREATE TABLE IF NOT EXISTS section_revisions ( id INTEGER PRIMARY KEY AUTOINCREMENT, section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE, tab TEXT NOT NULL DEFAULT 'urok', body TEXT, body_text TEXT, updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL, updated_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')) )",
 "CREATE INDEX IF NOT EXISTS section_revisions_section ON section_revisions (section_id, id)",
 "CREATE TABLE IF NOT EXISTS tab_texts ( section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE, tab TEXT NOT NULL, body TEXT, body_text TEXT, updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL, updated_at TEXT, PRIMARY KEY (section_id, tab) )",
 "CREATE TABLE IF NOT EXISTS quizzes ( id INTEGER PRIMARY KEY AUTOINCREMENT, section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE, tab TEXT NOT NULL DEFAULT 'zadachi', title TEXT NOT NULL, intro TEXT, questions TEXT NOT NULL, max_attempts INTEGER, show_answers INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')), created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL, updated_at TEXT )",
 "CREATE INDEX IF NOT EXISTS quizzes_section ON quizzes (section_id, status)",
 "CREATE TABLE IF NOT EXISTS quiz_attempts ( id INTEGER PRIMARY KEY AUTOINCREMENT, quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, answers TEXT NOT NULL, results TEXT NOT NULL, score REAL NOT NULL, max_score REAL NOT NULL, pending INTEGER NOT NULL DEFAULT 0, feedback TEXT, reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL, reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')) )",
 "CREATE INDEX IF NOT EXISTS quiz_attempts_quiz ON quiz_attempts (quiz_id, user_id)",
 "CREATE INDEX IF NOT EXISTS quiz_attempts_user ON quiz_attempts (user_id, created_at)",
 "CREATE TABLE IF NOT EXISTS lesson_views ( user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE, first_at TEXT NOT NULL DEFAULT (datetime('now')), last_at TEXT NOT NULL DEFAULT (datetime('now')), views INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (user_id, section_id) )",
 "CREATE INDEX IF NOT EXISTS lesson_views_section ON lesson_views (section_id)",
 "CREATE TABLE IF NOT EXISTS meta ( key TEXT PRIMARY KEY, value TEXT )"
];

export const seed = [
 "INSERT OR IGNORE INTO sections (id, slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type) VALUES (1, 'klas-5', NULL, 'grade', 5, NULL, '5. клас', 'Географска информация, планетата Земя, природата, обществото и стопанството, Африка.', NULL, 0, NULL),\n(2, 'klas-5-tema-1', 1, 'theme', 5, NULL, 'Въведение', 'Преговор от 4. клас, входно ниво и какво изучава географията.', NULL, 0, NULL),\n(3, 'klas-5-u1', 2, 'topic', 5, '1', 'Ние, природата и обществото', NULL, '[\"Преговор на наученото в 4. клас за природата и обществото\"]', 0, 'pregovor'),\n(4, 'klas-5-u2', 2, 'topic', 5, '2', 'Входно ниво за 5. клас', NULL, '[\"Проверка какво помниш от 4. клас\"]', 1, 'kontrol'),\n(5, 'klas-5-1-1', 2, 'topic', 5, '3', 'Географията — древна и съвременна наука', NULL, '[\"Какво изучава географията и защо ни е нужна всеки ден\",\"Великите географски открития: Колумб, Вашку да Гама, Магелан\"]', 2, NULL),\n(6, 'klas-5-tema-2', 1, 'theme', 5, NULL, 'Географска информация', 'Ориентиране, карта, глобус и градусна мрежа — основните инструменти на географа.', NULL, 1, NULL),\n(7, 'klas-5-u4', 6, 'topic', 5, '4', 'Ориентиране по земната повърхност', NULL, '[\"Хоризонт и линия на хоризонта\",\"Главни и междинни посоки на света\",\"Ориентиране по Слънцето, Полярната звезда, компас и карта\"]', 0, NULL),\n(8, 'klas-5-u5', 6, 'topic', 5, '5', 'Важна е първата крачка в нашето близко пространство', 'Урок за дейности на открито.', '[\"Ориентиране и наблюдения в училищния двор и около училището\"]', 1, 'deinosti'),\n(9, 'klas-5-2-1', 6, 'topic', 5, '6–7', 'Географска карта и географски глобус', NULL, '[\"Разлика между глобус и карта\",\"Мащаб и как да измерим разстояние по карта\",\"Как да четем условните знаци на общогеографската карта\"]', 2, NULL),\n(10, 'klas-5-u8', 6, 'topic', 5, '8', 'Картите като географски пътеводител', NULL, '[\"Как да четем и използваме различни карти\"]', 3, 'deinosti'),\n(11, 'klas-5-2-3', 6, 'topic', 5, '9–10', 'Градусна мрежа', NULL, '[\"Екватор, меридиани и паралели\",\"Как да намерим място по географска ширина и дължина\"]', 4, NULL),\n(12, 'klas-5-u11', 6, 'topic', 5, '11', 'Герои в търсенето на съкровища', NULL, '[\"Търсене на места по географски координати\"]', 5, 'deinosti'),\n(13, 'klas-5-u12', 6, 'topic', 5, '12', 'Източници на географска информация', NULL, '[\"Карти, глобус, снимки, GPS и други източници — обобщение\"]', 6, 'obobshtenie'),\n(14, 'klas-5-u13', 6, 'topic', 5, '13', 'Географска информация', NULL, '[\"Проверка на знанията по темата\"]', 7, 'kontrol'),\n(15, 'klas-5-tema-3', 1, 'theme', 5, NULL, 'Планетата Земя', 'Формата, движенията и строежът на Земята, континенти и океани.', NULL, 2, NULL),\n(16, 'klas-5-3-1', 15, 'topic', 5, '14', 'Планетата Земя — форма, размери и движения', NULL, '[\"Мястото на Земята в Слънчевата система\",\"Денонощие и годишни времена като последица от движенията на Земята\",\"Равноденствие и слънцестоене\"]', 0, NULL),\n(17, 'klas-5-3-2', 15, 'topic', 5, '15', 'Строеж на Земята', NULL, '[\"Ядро, мантия и земна кора\",\"Как да начертаем схема на вътрешния строеж\"]', 1, NULL),\n(18, 'klas-5-3-3', 15, 'topic', 5, '16', 'Сушата и водата на Земята — континенти и океани', NULL, '[\"Кои са континентите и океаните\",\"Какво са бряг, брегова линия, остров и залив\",\"Как са се формирали съвременните континенти\"]', 2, NULL),\n(19, 'klas-5-u17', 15, 'topic', 5, '17', 'Земята отвън и отвътре', NULL, '[\"Модели и схеми на строежа и движенията на Земята\"]', 3, 'deinosti'),\n(20, 'klas-5-u18', 15, 'topic', 5, '18', 'Нашата представа за планетата Земя', NULL, '[\"Обобщение на темата „Планетата Земя“\"]', 4, 'obobshtenie'),\n(21, 'klas-5-u19', 15, 'topic', 5, '19', 'Планетата Земя', NULL, '[\"Проверка на знанията по темата\"]', 5, 'kontrol'),\n(22, 'klas-5-tema-4', 1, 'theme', 5, NULL, 'География на природата', 'Релеф, климат, води, почви, растения, животни и природни зони.', NULL, 3, NULL),\n(23, 'klas-5-4-1', 22, 'topic', 5, '20–21', 'Релеф и полезни изкопаеми', NULL, '[\"Основни форми на релефа: планина, хълм, плато, низина, котловина\",\"Вътрешни и външни земни сили; видове скали\",\"Поведение по време на земетресение\"]', 0, NULL),\n(24, 'klas-5-u22', 22, 'topic', 5, '22', 'Разнообразният релеф и подземните богатства на неспокойната Земя', NULL, '[\"Работа с карти и снимки на релефа и полезните изкопаеми\"]', 1, 'deinosti'),\n(25, 'klas-5-4-2', 22, 'topic', 5, '23', 'Климат — фактори и елементи', NULL, '[\"Разлика между време и климат\",\"Температура, валежи, вятър, въздушни маси\",\"Как климатът се мени с географската ширина и височината\"]', 2, NULL),\n(26, 'klas-5-4-3', 22, 'topic', 5, '24', 'Климатични пояси и области', NULL, '[\"Екваториален, тропичен, умерен и полярен пояс\",\"Планинската климатична област\"]', 3, NULL),\n(27, 'klas-5-4-4', 22, 'topic', 5, '25', 'Световен океан', NULL, '[\"Температура, соленост и движения на водата\",\"Защо трябва да опазваме океана\"]', 4, NULL),\n(28, 'klas-5-4-5', 22, 'topic', 5, '26–27', 'Води на сушата', NULL, '[\"Реки, езера, ледници и подземни води\",\"Речна система, водосборен басейн, пълноводие и маловодие\",\"Поведение при наводнение\"]', 5, NULL),\n(29, 'klas-5-u28', 22, 'topic', 5, '28', 'Отправна точка за размисъл: природата под натиск!', NULL, '[\"Как човекът влияе на природата и как да я пазим\"]', 6, 'deinosti'),\n(30, 'klas-5-4-6', 22, 'topic', 5, '29–30', 'Почви, растителен и животински свят', NULL, '[\"Как се образува почвата и основните ѝ типове\",\"Защо да опазваме почвите, растенията и животните\"]', 7, NULL),\n(31, 'klas-5-4-7', 22, 'topic', 5, '31–32', 'Природни зони на Земята', NULL, '[\"Какво е природна зона\",\"Как се сменят зоните от екватора към полюсите\"]', 8, NULL),\n(32, 'klas-5-u33', 22, 'topic', 5, '33', 'Природните контрасти на планетата', NULL, '[\"Сравняване на природни зони по карти, снимки и климатограми\"]', 9, 'deinosti'),\n(33, 'klas-5-u34-35', 22, 'topic', 5, '34–35', 'Нашата географска картина за природата на света', NULL, '[\"Обобщение на темата „География на природата“\"]', 10, 'obobshtenie'),\n(34, 'klas-5-u36', 22, 'topic', 5, '36', 'География на природата', NULL, '[\"Проверка на знанията по темата\"]', 11, 'kontrol'),\n(35, 'klas-5-tema-5', 1, 'theme', 5, NULL, 'География на обществото и стопанството', 'Население, селища, държави и стопанство.', NULL, 4, NULL),\n(36, 'klas-5-5-1', 35, 'topic', 5, '37', 'Население на Земята', NULL, '[\"Брой, гъстота и разпределение на населението\",\"Основни религии и уважение между хората\"]', 0, NULL),\n(37, 'klas-5-5-2', 35, 'topic', 5, '38', 'Селища', NULL, '[\"Град и село — прилики и разлики\",\"Проблеми на селищата: замърсяване, пренаселеност, обезлюдяване\"]', 1, NULL),\n(38, 'klas-5-5-3', 35, 'topic', 5, '39–40', 'Политическа карта на света', NULL, '[\"Държава, република и монархия\",\"ООН, ЕС и НАТО\"]', 2, NULL),\n(39, 'klas-5-u41', 35, 'topic', 5, '41', 'Обитаваната планета — видими места, невидими връзки', NULL, '[\"Връзките между хората, селищата и държавите по света\"]', 3, 'deinosti'),\n(40, 'klas-5-5-4', 35, 'topic', 5, '42', 'Стопанство', NULL, '[\"Добиващи, обработващи и обслужващи дейности\",\"Как природата и обществото влияят на стопанството\"]', 4, NULL),\n(41, 'klas-5-u43', 35, 'topic', 5, '43', 'Стопанството в диаграми', NULL, '[\"Как да четем и чертаем диаграми за стопанството\"]', 5, 'deinosti'),\n(42, 'klas-5-u44-45', 35, 'topic', 5, '44–45', 'Нашата географска представа за обществото и стопанството', NULL, '[\"Обобщение на темата „География на обществото и стопанството“\"]', 6, 'obobshtenie'),\n(43, 'klas-5-u46', 35, 'topic', 5, '46', 'География на обществото и стопанството', NULL, '[\"Проверка на знанията по темата\"]', 7, 'kontrol'),\n(44, 'klas-5-tema-6', 1, 'theme', 5, NULL, 'География на континентите и страните. Африка', 'Първият континент, който изучаваме подробно.', NULL, 5, NULL),\n(45, 'klas-5-6-1', 44, 'topic', 5, '47', 'Географско положение, големина, брегове и опознаване на Африка', NULL, '[\"Географско положение и граници на Африка\",\"Изследователите Вашку да Гама и Дейвид Ливингстън\",\"Бреговете на контурна карта: Гибралтар, Суецки канал, Мадагаскар\"]', 0, NULL),\n(46, 'klas-5-6-2', 44, 'topic', 5, '48–49', 'Релеф и полезни изкопаеми на Африка', NULL, '[\"Сахара, Калахари, Килиманджаро, Атласки планини\",\"Къде се добиват основните полезни изкопаеми\"]', 1, NULL),\n(47, 'klas-5-6-3', 44, 'topic', 5, '50', 'Климат на Африка', NULL, '[\"Кои фактори определят климата на Африка\"]', 2, NULL),\n(48, 'klas-5-6-4', 44, 'topic', 5, '51–52', 'Климатични пояси и области в Африка', NULL, '[\"Екваториален, субекваториален, тропичен и субтропичен пояс\",\"Как да разпознаем пояса по карта\"]', 3, NULL),\n(49, 'klas-5-6-5', 44, 'topic', 5, '53', 'Води на Африка', NULL, '[\"Реките Нил, Конго, Нигер и Замбези\",\"Езерата Виктория, Танганика и Чад; водопадът Виктория\"]', 4, NULL),\n(50, 'klas-5-6-6', 44, 'topic', 5, '54–55', 'Природни зони на Африка', NULL, '[\"Влажни екваториални гори, савана, пустиня, оазис\"]', 5, NULL),\n(51, 'klas-5-u56-57', 44, 'topic', 5, '56–57', 'Уникалността на африканската природа', NULL, '[\"Забележителни природни обекти, растения и животни на Африка\"]', 6, 'deinosti'),\n(52, 'klas-5-6-7', 44, 'topic', 5, '58–59', 'Население и политическа карта на Африка', NULL, '[\"Местно и преселено население; бившите колонии\",\"Проблемите на континента: глад, болести, неграмотност\"]', 7, NULL),\n(53, 'klas-5-6-8', 44, 'topic', 5, '60', 'Стопанство на Африка', NULL, '[\"Основни стопански дейности и къде са разположени\"]', 8, NULL),\n(54, 'klas-5-6-9', 44, 'topic', 5, '61–62', 'Страни в Африка', NULL, '[\"Характеристика на страна по план: Египет и ЮАР\"]', 9, NULL),\n(55, 'klas-5-u63', 44, 'topic', 5, '63', 'Картите като географски пътеводител към места, в които не сме били', NULL, '[\"Пътешествие из Африка по карти\"]', 10, 'deinosti'),\n(56, 'klas-5-u64', 44, 'topic', 5, '64', 'Познатата и непозната Африка', NULL, '[\"Обобщение на темата „Африка“\"]', 11, 'obobshtenie'),\n(57, 'klas-5-u65', 44, 'topic', 5, '65', 'Африка', NULL, '[\"Проверка на знанията по темата\"]', 12, 'kontrol'),\n(58, 'klas-5-tema-7', 1, 'theme', 5, NULL, 'Преговор и изходно ниво', 'Какво научихме в 5. клас.', NULL, 6, NULL),\n(59, 'klas-5-u66-67', 58, 'topic', 5, '66–67', 'Ние и светът, в който живеем', NULL, '[\"Преговор на наученото в 5. клас\"]', 0, 'pregovor'),\n(60, 'klas-5-u68', 58, 'topic', 5, '68', 'Изходно ниво за 5. клас', NULL, '[\"Проверка на знанията в края на годината\"]', 1, 'kontrol'),\n(61, 'klas-6', NULL, 'grade', 6, NULL, '6. клас', 'Южна и Северна Америка, Азия, Австралия и Океания, океаните.', NULL, 1, NULL),\n(62, 'klas-6-tema-1', 61, 'theme', 6, NULL, 'Южна Америка', 'Андите, Амазонка и най-влажните гори на планетата.', NULL, 0, NULL),\n(63, 'klas-6-1-1', 62, 'topic', 6, '1.1', 'Южна Америка — положение, големина, брегове и опознаване', NULL, '[\"Колумб, Магелан и Америго Веспучи\",\"Огнена земя, Галапагос, Магеланов проток, Панамски канал\"]', 0, NULL),\n(64, 'klas-6-1-2', 62, 'topic', 6, '1.2', 'Релеф и полезни изкопаеми', NULL, '[\"Анди, Бразилска и Гвианска планинска земя, Амазонска низина\",\"Пустинята Атакама и Патагония\"]', 1, NULL),\n(65, 'klas-6-1-3', 62, 'topic', 6, '1.3', 'Климат, климатични пояси и планинска област', NULL, '[\"Факторите за климата и поясите на континента\"]', 2, NULL),\n(66, 'klas-6-1-4', 62, 'topic', 6, '1.4', 'Води', NULL, '[\"Амазонка, Парана, Ориноко; Титикака и Маракайбо; Анхел и Игуасу\"]', 3, NULL),\n(67, 'klas-6-1-5', 62, 'topic', 6, '1.5', 'Природни зони', NULL, '[\"Природните зони и пампата\",\"Защо да опазваме Амазония\"]', 4, NULL),\n(68, 'klas-6-1-6', 62, 'topic', 6, '1.6', 'Население и политическа карта', NULL, '[\"Индианци, метиси и мулати\",\"Държавите на континента\"]', 5, NULL),\n(69, 'klas-6-1-7', 62, 'topic', 6, '1.7', 'Стопанство', NULL, '[\"Фактори и състояние на стопанството\"]', 6, NULL),\n(70, 'klas-6-1-8', 62, 'topic', 6, '1.8', 'Страни: Бразилия и Аржентина', NULL, '[\"Характеристика на страна по план\"]', 7, NULL),\n(71, 'klas-6-tema-2', 61, 'theme', 6, NULL, 'Северна Америка', 'Кордилерите, Големите езера и прериите.', NULL, 1, NULL),\n(72, 'klas-6-1-9', 71, 'topic', 6, '1.9', 'Северна Америка — положение, големина, брегове и опознаване', NULL, '[\"Колумб и Витус Беринг\",\"Гренландия, Лабрадор, Флорида, Аляска, Хъдсън и Мексикански залив\"]', 0, NULL),\n(73, 'klas-6-1-10', 71, 'topic', 6, '1.10', 'Релеф и полезни изкопаеми', NULL, '[\"Кордилери, Апалачи, Големите равнини, Мисисипска низина\"]', 1, NULL),\n(74, 'klas-6-1-11', 71, 'topic', 6, '1.11', 'Климат, климатични пояси и области', NULL, '[\"Океански и континентален умерен климат; торнадо\"]', 2, NULL),\n(75, 'klas-6-1-12', 71, 'topic', 6, '1.12', 'Води', NULL, '[\"Мисисипи, Макензи, Колорадо\",\"Големите американски езера и Ниагарският водопад\"]', 3, NULL),\n(76, 'klas-6-1-13', 71, 'topic', 6, '1.13', 'Природни зони', NULL, '[\"Тундра, тайга, прерии\"]', 4, NULL),\n(77, 'klas-6-1-14', 71, 'topic', 6, '1.14', 'Население и политическа карта', NULL, '[\"Състав на населението; ескимоси (инуити)\"]', 5, NULL),\n(78, 'klas-6-1-15', 71, 'topic', 6, '1.15', 'Стопанство', NULL, '[\"Фактори и състояние на стопанството\"]', 6, NULL),\n(79, 'klas-6-1-16', 71, 'topic', 6, '1.16', 'Страни: САЩ и Канада', NULL, '[\"Характеристика на страна по план\"]', 7, NULL),\n(80, 'klas-6-tema-3', 61, 'theme', 6, NULL, 'Азия', 'Най-големият континент — от Хималаите до Сибир.', NULL, 2, NULL),\n(81, 'klas-6-1-17', 80, 'topic', 6, '1.17', 'Азия — положение, големина, брегове и опознаване', NULL, '[\"Марко Поло, Едмънд Хилари и Христо Проданов\",\"Босфор, Дарданели, Арабски полуостров, Индостан, Японски острови\"]', 0, NULL),\n(82, 'klas-6-1-18', 80, 'topic', 6, '1.18', 'Релеф и полезни изкопаеми', NULL, '[\"Хималаи и Тибет, Западносибирска низина, Гоби\"]', 1, NULL),\n(83, 'klas-6-1-19', 80, 'topic', 6, '1.19', 'Климат, климатични пояси и области', NULL, '[\"Мусоните и климатичните пояси на Азия\"]', 2, NULL),\n(84, 'klas-6-1-20', 80, 'topic', 6, '1.20', 'Води', NULL, '[\"Об, Яндзъ, Хуанхъ, Ганг, Тигър и Ефрат\",\"Байкал, Каспийско и Мъртво море\"]', 3, NULL),\n(85, 'klas-6-1-21', 80, 'topic', 6, '1.21', 'Природни зони', NULL, '[\"Вътрешноконтинентални пустини и степи\"]', 4, NULL),\n(86, 'klas-6-1-22', 80, 'topic', 6, '1.22', 'Население и политическа карта', NULL, '[\"Религии, бит и култура; бързо нарастване на населението\",\"Групиране на страните по положение, площ и население\"]', 5, NULL),\n(87, 'klas-6-1-23', 80, 'topic', 6, '1.23', 'Стопанство', NULL, '[\"Фактори и състояние на стопанството\"]', 6, NULL),\n(88, 'klas-6-1-24', 80, 'topic', 6, '1.24', 'Страни: Япония, Китай, Турция, Република Корея', NULL, '[\"Характеристика на страна по план\"]', 7, NULL),\n(89, 'klas-6-tema-4', 61, 'theme', 6, NULL, 'Австралия, Океания и океаните', 'Най-малкият континент, островите на Тихия океан и четирите океана.', NULL, 3, NULL),\n(90, 'klas-6-1-25', 89, 'topic', 6, '1.25', 'Австралия — положение, опознаване и природа', NULL, '[\"Абел Тасман и Джеймс Кук\",\"Голям бариерен риф, Голяма вододелна планина, река Мъри, езеро Еър\"]', 0, NULL),\n(91, 'klas-6-1-26', 89, 'topic', 6, '1.26', 'Население. Австралийски съюз', NULL, '[\"Аборигените; стопанството на Австралийския съюз\"]', 1, NULL),\n(92, 'klas-6-1-27', 89, 'topic', 6, '1.27', 'Океания', NULL, '[\"Меланезия, Микронезия, Полинезия и Нова Зеландия\",\"Маори и папуаси\"]', 2, NULL),\n(93, 'klas-6-1-28', 89, 'topic', 6, '1.28', 'Океаните на Земята', NULL, '[\"Тихи, Атлантически, Индийски и Северен ледовит океан\",\"Значението на океаните за хората\"]', 3, NULL),\n(94, 'klas-7', NULL, 'grade', 7, NULL, '7. клас', 'Европа, Балканският полуостров и България.', NULL, 2, NULL),\n(95, 'klas-7-tema-1', 94, 'theme', 7, NULL, 'Европа', 'Континентът, на който живеем.', NULL, 0, NULL),\n(96, 'klas-7-1-1', 95, 'topic', 7, '1.1', 'Географско положение, граници, големина и брегове на Европа', NULL, '[\"Скандинавски, Пиренейски, Апенински и Балкански полуостров\",\"Британските острови, Исландия, Ла Манш\"]', 0, NULL),\n(97, 'klas-7-1-2', 95, 'topic', 7, '1.2', 'Релеф на Европа', NULL, '[\"Алпи, Карпати, Урал, Кавказ; Източноевропейска равнина\",\"Фиордите\"]', 1, NULL),\n(98, 'klas-7-1-3', 95, 'topic', 7, '1.3', 'Полезни изкопаеми', NULL, '[\"Основните полезни изкопаеми и къде са\"]', 2, NULL),\n(99, 'klas-7-1-4', 95, 'topic', 7, '1.4', 'Климат', NULL, '[\"Факторите и климатичните пояси на Европа\"]', 3, NULL),\n(100, 'klas-7-1-5', 95, 'topic', 7, '1.5', 'Води', NULL, '[\"Волга, Дунав, Рейн, По; Ладожко, Женевско езеро, Балатон\"]', 4, NULL),\n(101, 'klas-7-1-6', 95, 'topic', 7, '1.6', 'Природни зони', NULL, '[\"Природните зони и защо да ги опазваме\"]', 5, NULL),\n(102, 'klas-7-1-7', 95, 'topic', 7, '1.7', 'Население', NULL, '[\"Езикови групи и религии\",\"Застаряване и миграции\"]', 6, NULL),\n(103, 'klas-7-1-8', 95, 'topic', 7, '1.8', 'Политическа карта', NULL, '[\"Групиране на страните по положение, площ и форма на управление\"]', 7, NULL),\n(104, 'klas-7-1-9', 95, 'topic', 7, '1.9', 'Стопанство', NULL, '[\"Основни стопански дейности и къде са разположени\"]', 8, NULL),\n(105, 'klas-7-1-10', 95, 'topic', 7, '1.10', 'Страни в Европа', NULL, '[\"Швеция, Великобритания, Франция, Германия, Италия, Русия\"]', 9, NULL),\n(106, 'klas-7-tema-2', 94, 'theme', 7, NULL, 'Балкански полуостров', 'Съседите на България.', NULL, 1, NULL),\n(107, 'klas-7-1-11', 106, 'topic', 7, '1.11', 'Положение, граници и брегове на Балканския полуостров', NULL, '[\"Адриатическо, Егейско и Йонийско море\",\"Пелопонес, Халкидики, Коринтски канал\"]', 0, NULL),\n(108, 'klas-7-1-12', 106, 'topic', 7, '1.12', 'Природа на Балканския полуостров', NULL, '[\"Динарски планини, Пинд, Олимп; Охридско езеро\"]', 1, NULL),\n(109, 'klas-7-1-13', 106, 'topic', 7, '1.13', 'Население, политическа карта и стопанство', NULL, '[\"Балканските държави и тяхното стопанство\"]', 2, NULL),\n(110, 'klas-7-1-14', 106, 'topic', 7, '1.14', 'Балкански страни', NULL, '[\"Румъния, Сърбия, Северна Македония, Гърция\"]', 3, NULL),\n(111, 'klas-7-tema-3', 94, 'theme', 7, NULL, 'География на България', 'Природни области, население, селища и стопанство на България.', NULL, 2, NULL),\n(112, 'klas-7-2-1', 111, 'topic', 7, '2.1', 'Географско положение, граници и големина', NULL, '[\"Кръстопътното положение на България\",\"Крайни точки и гранични пропускателни пунктове\"]', 0, NULL),\n(113, 'klas-7-2-2', 111, 'topic', 7, '2.2', 'Релеф и полезни изкопаеми', NULL, '[\"Главните черти на релефа\",\"Полезните изкопаеми и къде са\"]', 1, NULL),\n(114, 'klas-7-2-3', 111, 'topic', 7, '2.3', 'Климат и води', NULL, '[\"Климатичните области на България\",\"Искър, Янтра, Марица, Камчия, Струма, Места, Тунджа, Арда\",\"Сребърна, Варненско и Бургаско езеро\"]', 2, NULL),\n(115, 'klas-7-2-4', 111, 'topic', 7, '2.4', 'Почви, растителност, животински свят и опазване', NULL, '[\"Национален парк, природен парк и резерват\",\"Сиви горски почви, смолници, алувиални почви\"]', 3, NULL),\n(116, 'klas-7-2-5', 111, 'topic', 7, '2.5', 'Дунавска равнина', NULL, '[\"Природа, ресурси и екологични проблеми\",\"Резерват „Сребърна“\"]', 4, NULL),\n(117, 'klas-7-2-6', 111, 'topic', 7, '2.6', 'Старопланинска област', NULL, '[\"Природа, ресурси и екологични проблеми\",\"НП „Централен Балкан“\"]', 5, NULL),\n(118, 'klas-7-2-7', 111, 'topic', 7, '2.7', 'Краищенско-Средногорска област', NULL, '[\"Природа, ресурси и екологични проблеми\",\"ПП „Витоша“\"]', 6, NULL),\n(119, 'klas-7-2-8', 111, 'topic', 7, '2.8', 'Тракийско-Странджанска област', NULL, '[\"Природа, ресурси и екологични проблеми\",\"ПП „Странджа“\"]', 7, NULL),\n(120, 'klas-7-2-9', 111, 'topic', 7, '2.9', 'Рило-Родопска област', NULL, '[\"Природа, ресурси и екологични проблеми\",\"НП „Рила“ и НП „Пирин“\"]', 8, NULL),\n(121, 'klas-7-2-10', 111, 'topic', 7, '2.10', 'Българско черноморско крайбрежие', NULL, '[\"Природа, ресурси и екологични проблеми\"]', 9, NULL),\n(122, 'klas-7-2-11', 111, 'topic', 7, '2.11', 'Население и селища в България', NULL, '[\"Брой, разпределение и състав на населението\",\"Застаряване и обезлюдяване\"]', 10, NULL),\n(123, 'klas-7-2-12', 111, 'topic', 7, '2.12', 'Държавно устройство и административно деление', NULL, '[\"Законодателна, изпълнителна и съдебна власт\",\"Област, община, кметство\"]', 11, NULL),\n(124, 'klas-7-2-13', 111, 'topic', 7, '2.13', 'Стопанство на България', NULL, '[\"Етапи на развитие и съвременно стопанство по отрасли\"]', 12, NULL),\n(125, 'shkoli', NULL, 'area', NULL, NULL, 'Школи, състезания и олимпиади', 'Всичко за допълнителната работа с учениците — на едно място.', NULL, 10, NULL),\n(126, 'shkola', 125, 'page', NULL, NULL, 'Школа по география', 'График, теми и материали за извънкласните занимания.', '[\"График на занятията\",\"Теми и задачи за всяка среща\",\"Материали за самоподготовка\"]', 0, NULL),\n(127, 'olimpiada', 125, 'page', NULL, NULL, 'Олимпиада по география и икономика', 'Олимпиадата е за ученици от 5. до 12. клас. Учениците от 5. и 6. клас стигат до областен кръг, а от 7. клас нагоре — и до национален.', '[\"Регламент и срокове за текущата година\",\"Задачи от минали години\",\"Тренировъчни тестове\"]', 1, NULL),\n(128, 'sastezania', 125, 'page', NULL, NULL, 'Състезания и конкурси', 'Конкурси по ГИС, картография, проекти и други състезания.', '[\"Покани и регламенти\",\"Проекти на наши ученици\",\"Резултати и грамоти\"]', 2, NULL)",
 "INSERT OR IGNORE INTO links (id, category, title, url, description, sort) VALUES (1, 'Институции и данни', 'Министерство на образованието и науката', 'https://www.mon.bg', 'Учебни програми, регламенти на олимпиадите, ДЗИ.', 0),\n(2, 'Институции и данни', 'Национален статистически институт', 'https://www.nsi.bg', 'Данни за населението, селищата и стопанството на България.', 1),\n(3, 'Институции и данни', 'Българско географско дружество', 'https://geography.bg', 'Новини, събития и издания на географската общност.', 2),\n(4, 'Карти и ГИС', 'ArcGIS Online', 'https://www.arcgis.com', 'Интерактивни карти и слоеве с данни.', 3),\n(5, 'Карти и ГИС', 'ArcGIS StoryMaps', 'https://storymaps.arcgis.com', 'Разкази с карти — готови и собствени.', 4),\n(6, 'Карти и ГИС', 'Google Earth', 'https://earth.google.com/web', '3D глобус, сателитни снимки и пътешествия.', 5),\n(7, 'Карти и ГИС', 'OpenStreetMap', 'https://www.openstreetmap.org', 'Свободна карта на света.', 6),\n(8, 'Учебни сайтове', 'geograf.bg', 'https://geograf.bg', 'Добавен по предложение — провери адреса и описанието.', 7)"
];

export const structureVersion = 1;

export const sync = [
 [
  "UPDATE sections SET title = ?, summary = ? WHERE slug = ?",
  [
   "5. клас",
   "Географска информация, планетата Земя, природата, обществото и стопанството, Африка.",
   "klas-5"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-tema-1",
   "klas-5",
   "theme",
   5,
   null,
   "Въведение",
   "Преговор от 4. клас, входно ниво и какво изучава географията.",
   null,
   0,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u1",
   "klas-5-tema-1",
   "topic",
   5,
   "1",
   "Ние, природата и обществото",
   null,
   "[\"Преговор на наученото в 4. клас за природата и обществото\"]",
   0,
   "pregovor"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u2",
   "klas-5-tema-1",
   "topic",
   5,
   "2",
   "Входно ниво за 5. клас",
   null,
   "[\"Проверка какво помниш от 4. клас\"]",
   1,
   "kontrol"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-1-1",
   "klas-5-tema-1",
   "topic",
   5,
   "3",
   "Географията — древна и съвременна наука",
   null,
   "[\"Какво изучава географията и защо ни е нужна всеки ден\",\"Великите географски открития: Колумб, Вашку да Гама, Магелан\"]",
   2,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-tema-2",
   "klas-5",
   "theme",
   5,
   null,
   "Географска информация",
   "Ориентиране, карта, глобус и градусна мрежа — основните инструменти на географа.",
   null,
   1,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u4",
   "klas-5-tema-2",
   "topic",
   5,
   "4",
   "Ориентиране по земната повърхност",
   null,
   "[\"Хоризонт и линия на хоризонта\",\"Главни и междинни посоки на света\",\"Ориентиране по Слънцето, Полярната звезда, компас и карта\"]",
   0,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u5",
   "klas-5-tema-2",
   "topic",
   5,
   "5",
   "Важна е първата крачка в нашето близко пространство",
   "Урок за дейности на открито.",
   "[\"Ориентиране и наблюдения в училищния двор и около училището\"]",
   1,
   "deinosti"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-2-1",
   "klas-5-tema-2",
   "topic",
   5,
   "6–7",
   "Географска карта и географски глобус",
   null,
   "[\"Разлика между глобус и карта\",\"Мащаб и как да измерим разстояние по карта\",\"Как да четем условните знаци на общогеографската карта\"]",
   2,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u8",
   "klas-5-tema-2",
   "topic",
   5,
   "8",
   "Картите като географски пътеводител",
   null,
   "[\"Как да четем и използваме различни карти\"]",
   3,
   "deinosti"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-2-3",
   "klas-5-tema-2",
   "topic",
   5,
   "9–10",
   "Градусна мрежа",
   null,
   "[\"Екватор, меридиани и паралели\",\"Как да намерим място по географска ширина и дължина\"]",
   4,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u11",
   "klas-5-tema-2",
   "topic",
   5,
   "11",
   "Герои в търсенето на съкровища",
   null,
   "[\"Търсене на места по географски координати\"]",
   5,
   "deinosti"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u12",
   "klas-5-tema-2",
   "topic",
   5,
   "12",
   "Източници на географска информация",
   null,
   "[\"Карти, глобус, снимки, GPS и други източници — обобщение\"]",
   6,
   "obobshtenie"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u13",
   "klas-5-tema-2",
   "topic",
   5,
   "13",
   "Географска информация",
   null,
   "[\"Проверка на знанията по темата\"]",
   7,
   "kontrol"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-tema-3",
   "klas-5",
   "theme",
   5,
   null,
   "Планетата Земя",
   "Формата, движенията и строежът на Земята, континенти и океани.",
   null,
   2,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-3-1",
   "klas-5-tema-3",
   "topic",
   5,
   "14",
   "Планетата Земя — форма, размери и движения",
   null,
   "[\"Мястото на Земята в Слънчевата система\",\"Денонощие и годишни времена като последица от движенията на Земята\",\"Равноденствие и слънцестоене\"]",
   0,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-3-2",
   "klas-5-tema-3",
   "topic",
   5,
   "15",
   "Строеж на Земята",
   null,
   "[\"Ядро, мантия и земна кора\",\"Как да начертаем схема на вътрешния строеж\"]",
   1,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-3-3",
   "klas-5-tema-3",
   "topic",
   5,
   "16",
   "Сушата и водата на Земята — континенти и океани",
   null,
   "[\"Кои са континентите и океаните\",\"Какво са бряг, брегова линия, остров и залив\",\"Как са се формирали съвременните континенти\"]",
   2,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u17",
   "klas-5-tema-3",
   "topic",
   5,
   "17",
   "Земята отвън и отвътре",
   null,
   "[\"Модели и схеми на строежа и движенията на Земята\"]",
   3,
   "deinosti"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u18",
   "klas-5-tema-3",
   "topic",
   5,
   "18",
   "Нашата представа за планетата Земя",
   null,
   "[\"Обобщение на темата „Планетата Земя“\"]",
   4,
   "obobshtenie"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u19",
   "klas-5-tema-3",
   "topic",
   5,
   "19",
   "Планетата Земя",
   null,
   "[\"Проверка на знанията по темата\"]",
   5,
   "kontrol"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-tema-4",
   "klas-5",
   "theme",
   5,
   null,
   "География на природата",
   "Релеф, климат, води, почви, растения, животни и природни зони.",
   null,
   3,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-4-1",
   "klas-5-tema-4",
   "topic",
   5,
   "20–21",
   "Релеф и полезни изкопаеми",
   null,
   "[\"Основни форми на релефа: планина, хълм, плато, низина, котловина\",\"Вътрешни и външни земни сили; видове скали\",\"Поведение по време на земетресение\"]",
   0,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u22",
   "klas-5-tema-4",
   "topic",
   5,
   "22",
   "Разнообразният релеф и подземните богатства на неспокойната Земя",
   null,
   "[\"Работа с карти и снимки на релефа и полезните изкопаеми\"]",
   1,
   "deinosti"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-4-2",
   "klas-5-tema-4",
   "topic",
   5,
   "23",
   "Климат — фактори и елементи",
   null,
   "[\"Разлика между време и климат\",\"Температура, валежи, вятър, въздушни маси\",\"Как климатът се мени с географската ширина и височината\"]",
   2,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-4-3",
   "klas-5-tema-4",
   "topic",
   5,
   "24",
   "Климатични пояси и области",
   null,
   "[\"Екваториален, тропичен, умерен и полярен пояс\",\"Планинската климатична област\"]",
   3,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-4-4",
   "klas-5-tema-4",
   "topic",
   5,
   "25",
   "Световен океан",
   null,
   "[\"Температура, соленост и движения на водата\",\"Защо трябва да опазваме океана\"]",
   4,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-4-5",
   "klas-5-tema-4",
   "topic",
   5,
   "26–27",
   "Води на сушата",
   null,
   "[\"Реки, езера, ледници и подземни води\",\"Речна система, водосборен басейн, пълноводие и маловодие\",\"Поведение при наводнение\"]",
   5,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u28",
   "klas-5-tema-4",
   "topic",
   5,
   "28",
   "Отправна точка за размисъл: природата под натиск!",
   null,
   "[\"Как човекът влияе на природата и как да я пазим\"]",
   6,
   "deinosti"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-4-6",
   "klas-5-tema-4",
   "topic",
   5,
   "29–30",
   "Почви, растителен и животински свят",
   null,
   "[\"Как се образува почвата и основните ѝ типове\",\"Защо да опазваме почвите, растенията и животните\"]",
   7,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-4-7",
   "klas-5-tema-4",
   "topic",
   5,
   "31–32",
   "Природни зони на Земята",
   null,
   "[\"Какво е природна зона\",\"Как се сменят зоните от екватора към полюсите\"]",
   8,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u33",
   "klas-5-tema-4",
   "topic",
   5,
   "33",
   "Природните контрасти на планетата",
   null,
   "[\"Сравняване на природни зони по карти, снимки и климатограми\"]",
   9,
   "deinosti"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u34-35",
   "klas-5-tema-4",
   "topic",
   5,
   "34–35",
   "Нашата географска картина за природата на света",
   null,
   "[\"Обобщение на темата „География на природата“\"]",
   10,
   "obobshtenie"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u36",
   "klas-5-tema-4",
   "topic",
   5,
   "36",
   "География на природата",
   null,
   "[\"Проверка на знанията по темата\"]",
   11,
   "kontrol"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-tema-5",
   "klas-5",
   "theme",
   5,
   null,
   "География на обществото и стопанството",
   "Население, селища, държави и стопанство.",
   null,
   4,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-5-1",
   "klas-5-tema-5",
   "topic",
   5,
   "37",
   "Население на Земята",
   null,
   "[\"Брой, гъстота и разпределение на населението\",\"Основни религии и уважение между хората\"]",
   0,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-5-2",
   "klas-5-tema-5",
   "topic",
   5,
   "38",
   "Селища",
   null,
   "[\"Град и село — прилики и разлики\",\"Проблеми на селищата: замърсяване, пренаселеност, обезлюдяване\"]",
   1,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-5-3",
   "klas-5-tema-5",
   "topic",
   5,
   "39–40",
   "Политическа карта на света",
   null,
   "[\"Държава, република и монархия\",\"ООН, ЕС и НАТО\"]",
   2,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u41",
   "klas-5-tema-5",
   "topic",
   5,
   "41",
   "Обитаваната планета — видими места, невидими връзки",
   null,
   "[\"Връзките между хората, селищата и държавите по света\"]",
   3,
   "deinosti"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-5-4",
   "klas-5-tema-5",
   "topic",
   5,
   "42",
   "Стопанство",
   null,
   "[\"Добиващи, обработващи и обслужващи дейности\",\"Как природата и обществото влияят на стопанството\"]",
   4,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u43",
   "klas-5-tema-5",
   "topic",
   5,
   "43",
   "Стопанството в диаграми",
   null,
   "[\"Как да четем и чертаем диаграми за стопанството\"]",
   5,
   "deinosti"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u44-45",
   "klas-5-tema-5",
   "topic",
   5,
   "44–45",
   "Нашата географска представа за обществото и стопанството",
   null,
   "[\"Обобщение на темата „География на обществото и стопанството“\"]",
   6,
   "obobshtenie"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u46",
   "klas-5-tema-5",
   "topic",
   5,
   "46",
   "География на обществото и стопанството",
   null,
   "[\"Проверка на знанията по темата\"]",
   7,
   "kontrol"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-tema-6",
   "klas-5",
   "theme",
   5,
   null,
   "География на континентите и страните. Африка",
   "Първият континент, който изучаваме подробно.",
   null,
   5,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-6-1",
   "klas-5-tema-6",
   "topic",
   5,
   "47",
   "Географско положение, големина, брегове и опознаване на Африка",
   null,
   "[\"Географско положение и граници на Африка\",\"Изследователите Вашку да Гама и Дейвид Ливингстън\",\"Бреговете на контурна карта: Гибралтар, Суецки канал, Мадагаскар\"]",
   0,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-6-2",
   "klas-5-tema-6",
   "topic",
   5,
   "48–49",
   "Релеф и полезни изкопаеми на Африка",
   null,
   "[\"Сахара, Калахари, Килиманджаро, Атласки планини\",\"Къде се добиват основните полезни изкопаеми\"]",
   1,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-6-3",
   "klas-5-tema-6",
   "topic",
   5,
   "50",
   "Климат на Африка",
   null,
   "[\"Кои фактори определят климата на Африка\"]",
   2,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-6-4",
   "klas-5-tema-6",
   "topic",
   5,
   "51–52",
   "Климатични пояси и области в Африка",
   null,
   "[\"Екваториален, субекваториален, тропичен и субтропичен пояс\",\"Как да разпознаем пояса по карта\"]",
   3,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-6-5",
   "klas-5-tema-6",
   "topic",
   5,
   "53",
   "Води на Африка",
   null,
   "[\"Реките Нил, Конго, Нигер и Замбези\",\"Езерата Виктория, Танганика и Чад; водопадът Виктория\"]",
   4,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-6-6",
   "klas-5-tema-6",
   "topic",
   5,
   "54–55",
   "Природни зони на Африка",
   null,
   "[\"Влажни екваториални гори, савана, пустиня, оазис\"]",
   5,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u56-57",
   "klas-5-tema-6",
   "topic",
   5,
   "56–57",
   "Уникалността на африканската природа",
   null,
   "[\"Забележителни природни обекти, растения и животни на Африка\"]",
   6,
   "deinosti"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-6-7",
   "klas-5-tema-6",
   "topic",
   5,
   "58–59",
   "Население и политическа карта на Африка",
   null,
   "[\"Местно и преселено население; бившите колонии\",\"Проблемите на континента: глад, болести, неграмотност\"]",
   7,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-6-8",
   "klas-5-tema-6",
   "topic",
   5,
   "60",
   "Стопанство на Африка",
   null,
   "[\"Основни стопански дейности и къде са разположени\"]",
   8,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-6-9",
   "klas-5-tema-6",
   "topic",
   5,
   "61–62",
   "Страни в Африка",
   null,
   "[\"Характеристика на страна по план: Египет и ЮАР\"]",
   9,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u63",
   "klas-5-tema-6",
   "topic",
   5,
   "63",
   "Картите като географски пътеводител към места, в които не сме били",
   null,
   "[\"Пътешествие из Африка по карти\"]",
   10,
   "deinosti"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u64",
   "klas-5-tema-6",
   "topic",
   5,
   "64",
   "Познатата и непозната Африка",
   null,
   "[\"Обобщение на темата „Африка“\"]",
   11,
   "obobshtenie"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u65",
   "klas-5-tema-6",
   "topic",
   5,
   "65",
   "Африка",
   null,
   "[\"Проверка на знанията по темата\"]",
   12,
   "kontrol"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-tema-7",
   "klas-5",
   "theme",
   5,
   null,
   "Преговор и изходно ниво",
   "Какво научихме в 5. клас.",
   null,
   6,
   null
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u66-67",
   "klas-5-tema-7",
   "topic",
   5,
   "66–67",
   "Ние и светът, в който живеем",
   null,
   "[\"Преговор на наученото в 5. клас\"]",
   0,
   "pregovor"
  ]
 ],
 [
  "INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)\n  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)\n  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,\n    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,\n    sort = excluded.sort, lesson_type = excluded.lesson_type",
  [
   "klas-5-u68",
   "klas-5-tema-7",
   "topic",
   5,
   "68",
   "Изходно ниво за 5. клас",
   null,
   "[\"Проверка на знанията в края на годината\"]",
   1,
   "kontrol"
  ]
 ],
 [
  "DELETE FROM lesson_views WHERE section_id IN (SELECT id FROM sections\n    WHERE grade = ? AND kind = 'topic' AND slug NOT IN ('klas-5-u1', 'klas-5-u2', 'klas-5-1-1', 'klas-5-u4', 'klas-5-u5', 'klas-5-2-1', 'klas-5-u8', 'klas-5-2-3', 'klas-5-u11', 'klas-5-u12', 'klas-5-u13', 'klas-5-3-1', 'klas-5-3-2', 'klas-5-3-3', 'klas-5-u17', 'klas-5-u18', 'klas-5-u19', 'klas-5-4-1', 'klas-5-u22', 'klas-5-4-2', 'klas-5-4-3', 'klas-5-4-4', 'klas-5-4-5', 'klas-5-u28', 'klas-5-4-6', 'klas-5-4-7', 'klas-5-u33', 'klas-5-u34-35', 'klas-5-u36', 'klas-5-5-1', 'klas-5-5-2', 'klas-5-5-3', 'klas-5-u41', 'klas-5-5-4', 'klas-5-u43', 'klas-5-u44-45', 'klas-5-u46', 'klas-5-6-1', 'klas-5-6-2', 'klas-5-6-3', 'klas-5-6-4', 'klas-5-6-5', 'klas-5-6-6', 'klas-5-u56-57', 'klas-5-6-7', 'klas-5-6-8', 'klas-5-6-9', 'klas-5-u63', 'klas-5-u64', 'klas-5-u65', 'klas-5-u66-67', 'klas-5-u68') AND (body IS NULL OR body = '')\n    AND NOT EXISTS (SELECT 1 FROM materials m WHERE m.section_id = sections.id)\n    AND NOT EXISTS (SELECT 1 FROM quizzes z WHERE z.section_id = sections.id)\n    AND NOT EXISTS (SELECT 1 FROM tab_texts x WHERE x.section_id = sections.id AND x.body <> ''))",
  [
   5
  ]
 ],
 [
  "DELETE FROM section_revisions WHERE section_id IN (SELECT id FROM sections\n    WHERE grade = ? AND kind = 'topic' AND slug NOT IN ('klas-5-u1', 'klas-5-u2', 'klas-5-1-1', 'klas-5-u4', 'klas-5-u5', 'klas-5-2-1', 'klas-5-u8', 'klas-5-2-3', 'klas-5-u11', 'klas-5-u12', 'klas-5-u13', 'klas-5-3-1', 'klas-5-3-2', 'klas-5-3-3', 'klas-5-u17', 'klas-5-u18', 'klas-5-u19', 'klas-5-4-1', 'klas-5-u22', 'klas-5-4-2', 'klas-5-4-3', 'klas-5-4-4', 'klas-5-4-5', 'klas-5-u28', 'klas-5-4-6', 'klas-5-4-7', 'klas-5-u33', 'klas-5-u34-35', 'klas-5-u36', 'klas-5-5-1', 'klas-5-5-2', 'klas-5-5-3', 'klas-5-u41', 'klas-5-5-4', 'klas-5-u43', 'klas-5-u44-45', 'klas-5-u46', 'klas-5-6-1', 'klas-5-6-2', 'klas-5-6-3', 'klas-5-6-4', 'klas-5-6-5', 'klas-5-6-6', 'klas-5-u56-57', 'klas-5-6-7', 'klas-5-6-8', 'klas-5-6-9', 'klas-5-u63', 'klas-5-u64', 'klas-5-u65', 'klas-5-u66-67', 'klas-5-u68') AND (body IS NULL OR body = '')\n    AND NOT EXISTS (SELECT 1 FROM materials m WHERE m.section_id = sections.id)\n    AND NOT EXISTS (SELECT 1 FROM quizzes z WHERE z.section_id = sections.id)\n    AND NOT EXISTS (SELECT 1 FROM tab_texts x WHERE x.section_id = sections.id AND x.body <> ''))",
  [
   5
  ]
 ],
 [
  "DELETE FROM tab_texts WHERE section_id IN (SELECT id FROM sections\n    WHERE grade = ? AND kind = 'topic' AND slug NOT IN ('klas-5-u1', 'klas-5-u2', 'klas-5-1-1', 'klas-5-u4', 'klas-5-u5', 'klas-5-2-1', 'klas-5-u8', 'klas-5-2-3', 'klas-5-u11', 'klas-5-u12', 'klas-5-u13', 'klas-5-3-1', 'klas-5-3-2', 'klas-5-3-3', 'klas-5-u17', 'klas-5-u18', 'klas-5-u19', 'klas-5-4-1', 'klas-5-u22', 'klas-5-4-2', 'klas-5-4-3', 'klas-5-4-4', 'klas-5-4-5', 'klas-5-u28', 'klas-5-4-6', 'klas-5-4-7', 'klas-5-u33', 'klas-5-u34-35', 'klas-5-u36', 'klas-5-5-1', 'klas-5-5-2', 'klas-5-5-3', 'klas-5-u41', 'klas-5-5-4', 'klas-5-u43', 'klas-5-u44-45', 'klas-5-u46', 'klas-5-6-1', 'klas-5-6-2', 'klas-5-6-3', 'klas-5-6-4', 'klas-5-6-5', 'klas-5-6-6', 'klas-5-u56-57', 'klas-5-6-7', 'klas-5-6-8', 'klas-5-6-9', 'klas-5-u63', 'klas-5-u64', 'klas-5-u65', 'klas-5-u66-67', 'klas-5-u68') AND (body IS NULL OR body = '')\n    AND NOT EXISTS (SELECT 1 FROM materials m WHERE m.section_id = sections.id)\n    AND NOT EXISTS (SELECT 1 FROM quizzes z WHERE z.section_id = sections.id)\n    AND NOT EXISTS (SELECT 1 FROM tab_texts x WHERE x.section_id = sections.id AND x.body <> ''))",
  [
   5
  ]
 ],
 [
  "DELETE FROM sections WHERE grade = ? AND kind = 'topic' AND slug NOT IN ('klas-5-u1', 'klas-5-u2', 'klas-5-1-1', 'klas-5-u4', 'klas-5-u5', 'klas-5-2-1', 'klas-5-u8', 'klas-5-2-3', 'klas-5-u11', 'klas-5-u12', 'klas-5-u13', 'klas-5-3-1', 'klas-5-3-2', 'klas-5-3-3', 'klas-5-u17', 'klas-5-u18', 'klas-5-u19', 'klas-5-4-1', 'klas-5-u22', 'klas-5-4-2', 'klas-5-4-3', 'klas-5-4-4', 'klas-5-4-5', 'klas-5-u28', 'klas-5-4-6', 'klas-5-4-7', 'klas-5-u33', 'klas-5-u34-35', 'klas-5-u36', 'klas-5-5-1', 'klas-5-5-2', 'klas-5-5-3', 'klas-5-u41', 'klas-5-5-4', 'klas-5-u43', 'klas-5-u44-45', 'klas-5-u46', 'klas-5-6-1', 'klas-5-6-2', 'klas-5-6-3', 'klas-5-6-4', 'klas-5-6-5', 'klas-5-6-6', 'klas-5-u56-57', 'klas-5-6-7', 'klas-5-6-8', 'klas-5-6-9', 'klas-5-u63', 'klas-5-u64', 'klas-5-u65', 'klas-5-u66-67', 'klas-5-u68') AND (body IS NULL OR body = '')\n    AND NOT EXISTS (SELECT 1 FROM materials m WHERE m.section_id = sections.id)\n    AND NOT EXISTS (SELECT 1 FROM quizzes z WHERE z.section_id = sections.id)\n    AND NOT EXISTS (SELECT 1 FROM tab_texts x WHERE x.section_id = sections.id AND x.body <> '')",
  [
   5
  ]
 ],
 [
  "UPDATE sections SET code = NULL, sort = 900 + sort WHERE grade = ? AND kind = 'topic' AND slug NOT IN ('klas-5-u1', 'klas-5-u2', 'klas-5-1-1', 'klas-5-u4', 'klas-5-u5', 'klas-5-2-1', 'klas-5-u8', 'klas-5-2-3', 'klas-5-u11', 'klas-5-u12', 'klas-5-u13', 'klas-5-3-1', 'klas-5-3-2', 'klas-5-3-3', 'klas-5-u17', 'klas-5-u18', 'klas-5-u19', 'klas-5-4-1', 'klas-5-u22', 'klas-5-4-2', 'klas-5-4-3', 'klas-5-4-4', 'klas-5-4-5', 'klas-5-u28', 'klas-5-4-6', 'klas-5-4-7', 'klas-5-u33', 'klas-5-u34-35', 'klas-5-u36', 'klas-5-5-1', 'klas-5-5-2', 'klas-5-5-3', 'klas-5-u41', 'klas-5-5-4', 'klas-5-u43', 'klas-5-u44-45', 'klas-5-u46', 'klas-5-6-1', 'klas-5-6-2', 'klas-5-6-3', 'klas-5-6-4', 'klas-5-6-5', 'klas-5-6-6', 'klas-5-u56-57', 'klas-5-6-7', 'klas-5-6-8', 'klas-5-6-9', 'klas-5-u63', 'klas-5-u64', 'klas-5-u65', 'klas-5-u66-67', 'klas-5-u68') AND sort < 900",
  [
   5
  ]
 ],
 [
  "DELETE FROM sections WHERE grade = ? AND kind = 'theme' AND slug NOT IN ('klas-5-tema-1', 'klas-5-tema-2', 'klas-5-tema-3', 'klas-5-tema-4', 'klas-5-tema-5', 'klas-5-tema-6', 'klas-5-tema-7')\n    AND NOT EXISTS (SELECT 1 FROM sections c WHERE c.parent_id = sections.id)",
  [
   5
  ]
 ]
];
