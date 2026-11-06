// Потребители: одобрение, спиране, нова парола, клас и роля
import { api } from './api.js';
import { state, refreshMe } from './app.js';
import { esc, $, $$, toast, roleName, formatDate } from './ui.js';

const TABS = [
  ['pending', 'Чакащи'],
  ['active', 'Активни'],
  ['blocked', 'Спрени'],
];

export function usersView() {
  return async (main) => {
    document.title = 'Потребители — ГеоКомпас';
    const isAdmin = state.user.role === 'admin';
    const ui = { status: state.pendingCount ? 'pending' : 'active', role: '', grade: '', q: '' };

    main.innerHTML = `
      <div class="wrap" style="padding-bottom:3rem">
        <header class="page-head">
          <h1>Потребители</h1>
          <p>${isAdmin ? 'Одобряваш учителите и учениците.' : 'Одобряваш и управляваш учениците. Учителите се одобряват от администратора.'}</p>
        </header>
        <div class="subtabs" role="group" aria-label="Състояние"></div>
        <div class="filters">
          ${isAdmin ? `<select class="input" name="role" aria-label="Роля">
            <option value="">Всички роли</option><option value="student">Ученици</option>
            <option value="teacher">Учители</option><option value="admin">Администратори</option></select>` : ''}
          <select class="input" name="grade" aria-label="Клас">
            <option value="">Всички класове</option><option value="5">5. клас</option><option value="6">6. клас</option><option value="7">7. клас</option></select>
          <input class="input" name="q" type="search" placeholder="Търси по име или имейл" aria-label="Търси">
        </div>
        <div id="ulist"></div>
      </div>
      <dialog id="dlg"></dialog>`;

    let all = [];

    async function load() {
      const { users } = await api('/users');
      all = users;
      draw();
    }

    function draw() {
      const counts = Object.fromEntries(TABS.map(([k]) => [k, all.filter((u) => u.status === k).length]));
      $('.subtabs', main).innerHTML = TABS.map(
        ([k, label]) => `<button type="button" data-status="${k}" aria-pressed="${ui.status === k}">${label} (${counts[k]})</button>`,
      ).join('');

      const q = ui.q.toLowerCase();
      const list = all.filter(
        (u) =>
          u.status === ui.status &&
          (!ui.role || u.role === ui.role) &&
          (!ui.grade || String(u.grade) === ui.grade) &&
          (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
      );

      const box = $('#ulist', main);
      if (!list.length) {
        const msg = { pending: 'Няма чакащи профили.', active: 'Няма активни потребители по тези филтри.', blocked: 'Няма спрени профили.' };
        box.innerHTML = `<div class="empty"><strong>${msg[ui.status]}</strong></div>`;
        return;
      }
      box.innerHTML = `
        <table class="utable">
          <thead><tr><th>Име</th><th>Роля и клас</th><th>${ui.status === 'pending' ? 'Регистриран' : 'Последен вход'}</th><th><span class="visually-hidden">Действия</span></th></tr></thead>
          <tbody>${list.map(row).join('')}</tbody>
        </table>`;
    }

    const canManage = (u) => u.id !== state.user.id && (isAdmin || u.role === 'student');

    function row(u) {
      const tag =
        u.role === 'student'
          ? `<span class="class-tag" data-c="${u.grade}">${u.grade}${esc(u.classLetter || '')} клас</span>`
          : `<span class="role-tag" data-c="${u.role === 'admin' ? 'x' : '5'}">${roleName[u.role]}</span>`;
      let actions = '';
      if (canManage(u)) {
        if (u.status === 'pending') {
          actions = `<button class="btn ok small" data-act="approve" data-id="${u.id}">Одобри</button>
                     <button class="btn danger small" data-act="delete" data-id="${u.id}">Откажи</button>`;
        } else if (u.status === 'active') {
          actions = `<button class="btn ghost small" data-act="edit" data-id="${u.id}">Промени</button>
                     <button class="btn ghost small" data-act="reset" data-id="${u.id}">Нова парола</button>
                     <button class="btn danger small" data-act="block" data-id="${u.id}">Спри</button>`;
        } else {
          actions = `<button class="btn ghost small" data-act="unblock" data-id="${u.id}">Активирай</button>
                     <button class="btn danger small" data-act="delete" data-id="${u.id}">Изтрий</button>`;
        }
      }
      const when = ui.status === 'pending' ? formatDate(u.createdAt) : formatDate(u.lastLoginAt);
      return `<tr>
        <td><strong>${esc(u.name)}</strong>${u.id === state.user.id ? ' (ти)' : ''}<div class="email">${esc(u.email)}</div></td>
        <td>${tag}</td>
        <td>${when}</td>
        <td><div class="actions">${actions}</div></td>
      </tr>`;
    }

    // ---- Диалози ----
    const dlg = $('#dlg', main);
    function confirmDialog(title, text, okLabel, danger = false) {
      return new Promise((resolve) => {
        dlg.innerHTML = `<h2>${esc(title)}</h2><p>${esc(text)}</p>
          <div class="buttons"><button class="btn ghost" value="no">Отказ</button>
          <button class="btn ${danger ? 'danger' : ''}" value="yes">${esc(okLabel)}</button></div>`;
        $$('button', dlg).forEach((b) => b.addEventListener('click', () => { dlg.close(); resolve(b.value === 'yes'); }));
        dlg.showModal();
      });
    }

    function editDialog(u) {
      dlg.innerHTML = `<h2>${esc(u.name)}</h2>
        <form class="form" method="dialog" novalidate>
          ${isAdmin ? `<div class="field"><label for="d-role">Роля</label>
            <select class="input" id="d-role" name="role">
              ${['student', 'teacher', 'admin'].map((r) => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${roleName[r]}</option>`).join('')}
            </select></div>` : ''}
          <div class="row d-student">
            <div class="field"><label for="d-grade">Клас</label>
              <select class="input" id="d-grade" name="grade">
                ${[5, 6, 7].map((g) => `<option value="${g}" ${u.grade === g ? 'selected' : ''}>${g}. клас</option>`).join('')}
              </select></div>
            <div class="field"><label for="d-letter">Паралелка</label>
              <input class="input" id="d-letter" name="classLetter" maxlength="1" value="${esc(u.classLetter || '')}"></div>
          </div>
          <div class="error-box" role="alert"></div>
          <div class="buttons"><button class="btn ghost" type="button" value="cancel">Отказ</button><button class="btn" type="submit">Запази</button></div>
        </form>`;
      const form = $('form', dlg);
      const sync = () => { $('.d-student', form).hidden = form.role && form.role.value !== 'student'; };
      sync();
      form.addEventListener('change', sync);
      $('[value="cancel"]', form).addEventListener('click', () => dlg.close());
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        try {
          await api('/users/' + u.id, { method: 'PATCH', body: data });
          dlg.close();
          toast('Промените са запазени.');
          await load();
        } catch (err) {
          $('.error-box', form).textContent = err.message;
        }
      });
      dlg.showModal();
    }

    function showTempPassword(u, temp) {
      dlg.innerHTML = `<h2>Нова парола за ${esc(u.name)}</h2>
        <p>Дай тази временна парола на ${u.role === 'student' ? 'ученика' : 'колегата'}. При първия вход системата ще поиска да си избере нова.</p>
        <p class="temp-pass" style="margin-top:1rem">${esc(temp)}</p>
        <p style="color:var(--ink-soft);font-size:.88rem;margin-top:.6rem">Паролата се показва само сега.</p>
        <div class="buttons"><button class="btn ghost" type="button" id="copy">Копирай</button><button class="btn" type="button" id="done">Готово</button></div>`;
      $('#copy', dlg).addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(temp); toast('Паролата е копирана.'); } catch { toast('Копирай паролата ръчно.'); }
      });
      $('#done', dlg).addEventListener('click', () => dlg.close());
      dlg.showModal();
    }

    // ---- Действия ----
    main.addEventListener('click', async (e) => {
      const tab = e.target.closest('[data-status]');
      if (tab) { ui.status = tab.dataset.status; draw(); return; }
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const u = all.find((x) => x.id === Number(btn.dataset.id));
      const act = btn.dataset.act;
      try {
        if (act === 'approve') {
          await api(`/users/${u.id}/approve`, { method: 'POST' });
          toast(`${u.name} е одобрен${u.role === 'student' ? '' : ' като ' + roleName[u.role].toLowerCase()}.`);
        } else if (act === 'delete') {
          const ok = await confirmDialog(
            u.status === 'pending' ? 'Откажи регистрацията?' : 'Изтрий профила?',
            `Профилът на ${u.name} ще бъде изтрит. Човекът може да се регистрира отново.`,
            u.status === 'pending' ? 'Откажи' : 'Изтрий', true);
          if (!ok) return;
          await api(`/users/${u.id}`, { method: 'DELETE' });
          toast('Профилът е изтрит.');
        } else if (act === 'block') {
          const ok = await confirmDialog('Спри профила?', `${u.name} няма да може да влиза, докато не го активираш отново.`, 'Спри', true);
          if (!ok) return;
          await api(`/users/${u.id}/block`, { method: 'POST' });
          toast('Профилът е спрян.');
        } else if (act === 'unblock') {
          await api(`/users/${u.id}/unblock`, { method: 'POST' });
          toast('Профилът е активиран.');
        } else if (act === 'reset') {
          const ok = await confirmDialog('Нова парола?', `Ще създадем временна парола за ${u.name}. Старата спира да работи.`, 'Създай парола');
          if (!ok) return;
          const { tempPassword } = await api(`/users/${u.id}/reset-password`, { method: 'POST' });
          showTempPassword(u, tempPassword);
        } else if (act === 'edit') {
          editDialog(u);
          return;
        }
        await load();
        await refreshMe();
        // обнови брояча в горната лента, без да губим текущия таб
        const n = state.pendingCount;
        $$('.badge-count').forEach((b) => (n ? (b.textContent = n) : b.remove()));
      } catch (err) {
        toast(err.message);
      }
    });

    main.addEventListener('input', (e) => {
      if (['role', 'grade', 'q'].includes(e.target.name)) {
        ui[e.target.name] = e.target.value;
        draw();
      }
    });

    await load();
  };
}
