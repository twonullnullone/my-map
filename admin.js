import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://aqxbpnaifdgkqfgbwaaw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_f65ydTnZHMY8y-J86q9QpQ_YNzqldgl';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginBox = document.getElementById('admin-login');
const panelBox = document.getElementById('admin-panel');
const usersTableBody = document.getElementById('users-tbody');
const toggleTrackingBtn = document.getElementById('toggle-tracking-btn');

let currentTrackingState = true;

// 1. Вход админа через Supabase Auth
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    alert('Ошибка входа: ' + error.message);
    return;
  }
  await checkAdminSession();
});

// Выход
document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  loginBox.style.display = 'block';
  panelBox.style.display = 'none';
});

// 2. Проверка активной сессии админа
async function checkAdminSession() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    loginBox.style.display = 'block';
    panelBox.style.display = 'none';
    return;
  }

  loginBox.style.display = 'none';
  panelBox.style.display = 'block';

  await loadSettings();
  await loadUsers();
  subscribeRealtimeAdmin();
}

// 3. Глобальная кнопка отключения/включения отслеживания всех пользователей
async function loadSettings() {
  const { data } = await supabase
    .from('app_settings')
    .select('tracking_enabled')
    .eq('id', 1)
    .single();

  if (data) {
    currentTrackingState = data.tracking_enabled;
    updateTrackingButtonUI();
  }
}

function updateTrackingButtonUI() {
  toggleTrackingBtn.textContent = currentTrackingState
    ? 'Отключить отслеживание всех пользователей'
    : 'Включить отслеживание всех пользователей';
  toggleTrackingBtn.style.background = currentTrackingState ? '#d9534f' : '#28a745';
}

toggleTrackingBtn.addEventListener('click', async () => {
  const newState = !currentTrackingState;
  const { error } = await supabase
    .from('app_settings')
    .update({ tracking_enabled: newState })
    .eq('id', 1);

  if (error) {
    alert('Нет прав или ошибка: ' + error.message);
    return;
  }
  currentTrackingState = newState;
  updateTrackingButtonUI();
});

// 4. Загрузка и рендер всех пользователей
async function loadUsers() {
  const { data: users, error } = await supabase
    .from('devices')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Ошибка загрузки пользователей:', error);
    return;
  }

  usersTableBody.innerHTML = '';
  users.forEach((u) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${u.id}</code></td>
      <td>${escapeHtml(u.name)}</td>
      <td>${new Date(u.first_seen_at).toLocaleString()}</td>
      <td>${u.lat ?? '-'}, ${u.lng ?? '-'}</td>
      <td>${u.gps_updated_at ? new Date(u.gps_updated_at).toLocaleTimeString() : '-'}</td>
      <td>${u.is_blocked ? '🔴 Заблокирован' : (u.status === 'online' ? '🟢 Online' : '⚪ Offline')}</td>
      <td>
        <button data-id="${u.id}" data-blocked="${u.is_blocked}" class="block-btn">
          ${u.is_blocked ? 'Разблокировать' : 'Чёрный экран'}
        </button>
      </td>
    `;
    usersTableBody.appendChild(tr);
  });

  // Обработчики кнопок блокировки
  document.querySelectorAll('.block-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const nextBlocked = btn.dataset.blocked !== 'true';

      const { error } = await supabase
        .from('devices')
        .update({
          is_blocked: nextBlocked,
          status: nextBlocked ? 'blocked' : 'online'
        })
        .eq('id', id);

      if (error) alert('Ошибка блокировки: ' + error.message);
    });
  });
}

// 5. Живое обновление таблицы в админке при движении пользователей
function subscribeRealtimeAdmin() {
  supabase
    .channel('admin-devices')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'devices' },
      () => loadUsers()
    )
    .subscribe();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

checkAdminSession();
