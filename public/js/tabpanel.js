// Един таб на урока: текст + тестове + файлове, и бутонът „Добави“ за учителите
import { api } from './api.js';
import { state } from './app.js';
import { $, toast, confirmLeave } from './ui.js';
import { textBlock } from './textblock.js';
import { materialsPanel } from './materials.js';
import { quizCards, runQuiz } from './quiz.js';
import { editQuiz } from './quizedit.js';
import { showResults } from './quizresults.js';

const isStaff = () => state.user && (state.user.role === 'teacher' || state.user.role === 'admin');

const EMPTY = {
  urok: ['Урокът още не е добавен', 'Учителят ще го напише или качи скоро.'],
  karti: ['Още няма карти и графики', 'Тук ще има карти, инфографики и диаграми към урока.'],
  zadachi: ['Още няма задачи', 'Тук ще има задачи и тестове към урока.'],
  materiali: ['Още няма материали', 'Тук ще има презентации, работни листове и други материали.'],
};

const inTab = (tab) => (x) => (x.tab || 'materiali') === tab;

/**
 * data = { materials, quizzes, texts } — общо за всички табове на урока, променя се на място
 * onChange() — когато се промени броят на нещата (за надписите на табовете)
 */
export function tabPanel(root, { section, tab, data, onChange }) {
  const staff = isStaff();
  const text = (data.texts[tab] ||= { body: null, updatedAt: null, updatedBy: null });

  root.innerHTML = `
    <div class="tabp">
      ${staff ? `
        <div class="tab-tools">
          <div class="text-tools"></div>
          <details class="add-menu">
            <summary class="btn">+ Добави</summary>
            <div class="menu" role="menu">
              <button type="button" role="menuitem" data-add="quiz"><strong>Тест</strong><span>въпроси с автоматична проверка</span></button>
              <button type="button" role="menuitem" data-add="upload"><strong>Файл</strong><span>PDF, Word, презентация, снимка</span></button>
              <button type="button" role="menuitem" data-add="link"><strong>Линк</strong><span>YouTube, Google Drive, ArcGIS…</span></button>
              <button type="button" role="menuitem" data-add="site"><strong>Файл от сайта</strong><span>от папката в GitHub</span></button>
            </div>
          </details>
        </div>` : ''}
      <div class="tb-text"></div>
      <div class="tb-quizzes"></div>
      <div class="tb-files"></div>
      <div class="tb-empty"></div>
    </div>
    <div class="tabp-alt" hidden></div>`;

  const main = $('.tabp', root);
  const alt = $('.tabp-alt', root);

  const tb = textBlock($('.tb-text', root), $('.text-tools', root), {
    slug: section.slug,
    tab,
    text,
    onMode: (m) => {
      main.classList.toggle('editing', m === 'edit');
      if (m === 'view') emptyState();
    },
  });

  const mats = materialsPanel($('.tb-files', root), {
    slug: section.slug,
    tab,
    all: data.materials,
    inline: tab === 'urok',
    actions: false,
    quietEmpty: true,
    onChange: (list) => {
      data.materials = list;
      emptyState();
      onChange?.();
    },
  });

  function drawQuizzes() {
    quizCards($('.tb-quizzes', root), { quizzes: data.quizzes.filter(inTab(tab)), onOpen: quizAction });
  }

  function emptyState() {
    const has = text.body || data.quizzes.some(inTab(tab)) || data.materials.some(inTab(tab));
    const box = $('.tb-empty', root);
    if (has || main.classList.contains('editing')) {
      box.innerHTML = '';
      return;
    }
    box.innerHTML = staff
      ? `<div class="empty"><strong>Тук още няма нищо</strong><span>${tab === 'urok' ? 'Напиши урока, внеси го от Word или качи готов урок с „Добави“ → „Файл“.' : 'Напиши текст (задачи, указания, „Запомни!“), направи тест или качи файл с „Добави“.'}</span></div>`
      : `<div class="empty"><strong>${EMPTY[tab][0]}</strong><span>${EMPTY[tab][1]}</span></div>`;
  }

  async function reload() {
    const fresh = await api('/sections/' + encodeURIComponent(section.slug));
    data.quizzes = fresh.quizzes;
    data.materials = fresh.materials;
    drawQuizzes();
    emptyState();
    onChange?.();
  }

  // Режим „на цял екран“ в таба: решаване, създаване, резултати
  function openAlt(render) {
    main.hidden = true;
    alt.hidden = false;
    render(alt, async (changed = true) => {
      alt.hidden = true;
      alt.innerHTML = '';
      main.hidden = false;
      if (changed) await reload().catch(() => {});
      root.scrollIntoView({ block: 'start' });
    });
  }

  async function quizAction(act, q) {
    if (act === 'take' || act === 'try') openAlt((box, done) => runQuiz(box, q.id, { onDone: () => done(true) }));
    else if (act === 'edit') openAlt((box, done) => editQuiz(box, { slug: section.slug, tab, quizId: q.id, onDone: done }));
    else if (act === 'results') openAlt((box, done) => showResults(box, q.id, { onDone: () => done(false) }).catch((e) => (toast(e.message), done(false))));
    else if (act === 'delete') {
      if (!window.confirm(`Да изтрия ли теста „${q.title}“? Ще се изтрият и всички резултати от него.`)) return;
      try {
        await api(`/quizzes/${q.id}`, { method: 'DELETE' });
        toast('Тестът е изтрит.');
        await reload();
      } catch (e) {
        toast(e.message);
      }
    }
  }

  if (staff) {
    const menu = $('.add-menu', root);
    menu.addEventListener('click', (e) => {
      const b = e.target.closest('[data-add]');
      if (!b) return;
      menu.open = false;
      const what = b.dataset.add;
      if (what === 'quiz') {
        if (!confirmLeave()) return;
        openAlt((box, done) => editQuiz(box, { slug: section.slug, tab, onDone: done }));
      } else mats.open(what);
    });
    const outside = (e) => {
      if (!menu.isConnected) return document.removeEventListener('click', outside);
      if (menu.open && !menu.contains(e.target)) menu.open = false;
    };
    document.addEventListener('click', outside);
  }

  drawQuizzes();
  emptyState();
  return { hasText: () => tb.hasText() };
}

export const tabCount = (data, tab) =>
  data.quizzes.filter(inTab(tab)).length + data.materials.filter(inTab(tab)).length;

