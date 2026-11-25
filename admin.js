import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://aqxbpnaifdgkqfgbwaaw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_f65ydTnZHMY8y-J86q9QpQ_YNzqldgl';

/*
import { createClient } from
'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
*/
// ========================================
// 1. SUPABASE
// ========================================




// ========================================
// 1. CONFIGURATION
// ========================================

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

// UID из Supabase Authentication → Users
const ADMIN_UID = '2a753c18-674f-457d-acb8-91859ed6ca56';


// ========================================
// 2. HTML ELEMENTS
// ========================================

const loginBox = document.getElementById('admin-login');
const panelBox = document.getElementById('admin-panel');

const loginForm = document.getElementById('login-form');

const emailInput = document.getElementById('admin-email');
const passwordInput = document.getElementById('admin-password');

const usersTableBody = document.getElementById('users-tbody');

const toggleTrackingBtn = document.getElementById('toggle-tracking-btn');
const logoutBtn = document.getElementById('logout-btn');


// ========================================
// 3. STATE
// ========================================

let isAdmin = false;

let currentTrackingState = true;

let adminChannel = null;
let settingsChannel = null;

let isLoadingUsers = false;
let reloadRequested = false;


// ========================================
// 4. INTERFACE
// ========================================

function showLogin() {

    isAdmin = false;

    loginBox.style.display = 'flex';
    panelBox.style.display = 'none';
}


function showAdminPanel() {

    isAdmin = true;

    loginBox.style.display = 'none';
    panelBox.style.display = 'block';
}


// ========================================
// 5. LOGIN
// ========================================

loginForm.addEventListener('submit', async (e) => {

    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    const submitBtn = loginForm.querySelector(
        'button[type="submit"]'
    );

    submitBtn.disabled = true;

    try {

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {

            alert('Ошибка входа: ' + error.message);

            return;
        }

        // Проверяем UID
        if (data.user.id !== ADMIN_UID) {

            await supabase.auth.signOut();

            showLogin();

            alert('У вас нет прав администратора');

            return;
        }

        await checkAdminSession();

    } catch (err) {

        console.error('Ошибка входа:', err);

        alert('Ошибка соединения с Supabase');

    } finally {

        submitBtn.disabled = false;
    }
});


// ========================================
// 6. CHECK ADMIN SESSION
// ========================================

async function checkAdminSession() {

    try {

        const {
            data: { session },
            error
        } = await supabase.auth.getSession();

        if (error || !session) {

            showLogin();

            return;
        }

        // Только указанный UID имеет доступ
        if (session.user.id !== ADMIN_UID) {

            await supabase.auth.signOut();

            showLogin();

            alert('Доступ запрещён');

            return;
        }

        console.log(
            'Администратор авторизован:',
            session.user.email
        );

        showAdminPanel();

        await loadSettings();

        await loadUsers();

        subscribeRealtimeAdmin();

        subscribeRealtimeSettings();

    } catch (err) {

        console.error('Ошибка проверки сессии:', err);

        showLogin();
    }
}


// ========================================
// 7. LOGOUT
// ========================================

logoutBtn.addEventListener('click', async () => {

    try {

        if (adminChannel) {
            await supabase.removeChannel(adminChannel);
            adminChannel = null;
        }

        if (settingsChannel) {
            await supabase.removeChannel(settingsChannel);
            settingsChannel = null;
        }

        await supabase.auth.signOut();

        showLogin();

        loginForm.reset();

        console.log('Выход выполнен');

    } catch (err) {

        console.error('Ошибка выхода:', err);
    }
});


// ========================================
// 8. LOAD GLOBAL SETTINGS
// ========================================

async function loadSettings() {

    const { data, error } = await supabase
        .from('app_settings')
        .select('tracking_enabled')
        .eq('id', 1)
        .single();

    if (error) {

        console.error('Ошибка настроек:', error);

        toggleTrackingBtn.textContent = 'Ошибка загрузки';

        return;
    }

    if (!data) return;

    currentTrackingState = data.tracking_enabled;

    updateTrackingButtonUI();
}


// ========================================
// 9. GLOBAL GPS BUTTON
// ========================================

function updateTrackingButtonUI() {

    toggleTrackingBtn.textContent = currentTrackingState
        ? 'Отключить отслеживание всех пользователей'
        : 'Включить отслеживание всех пользователей';

    toggleTrackingBtn.style.background = currentTrackingState
        ? '#d9534f'
        : '#00796B';
}


toggleTrackingBtn.addEventListener('click', async () => {

    if (!isAdmin) return;

    const newState = !currentTrackingState;

    toggleTrackingBtn.disabled = true;

    try {

        const { data, error } = await supabase
            .from('app_settings')
            .update({
                tracking_enabled: newState
            })
            .eq('id', 1)
            .select('tracking_enabled');

        if (error) {

            console.error('Ошибка изменения GPS:', error);

            alert('Ошибка: ' + error.message);

            return;
        }

        if (!data || !data.length) {

            alert('Настройки не изменены. Проверь RLS.');

            return;
        }

        currentTrackingState = data[0].tracking_enabled;

        updateTrackingButtonUI();

    } catch (err) {

        console.error(err);

        alert('Ошибка соединения');

    } finally {

        toggleTrackingBtn.disabled = false;
    }
});


// ========================================
// 10. LOAD USERS
// ========================================

async function loadUsers() {

    if (!isAdmin) return;

    // Защита от одновременных запросов
    if (isLoadingUsers) {
        reloadRequested = true;
        return;
    }

    isLoadingUsers = true;

    try {

        const { data: users, error } = await supabase
            .from('devices')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) {

            console.error('Ошибка загрузки пользователей:', error);

            return;
        }

        usersTableBody.innerHTML = '';

        if (!users || users.length === 0) {

            usersTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center;padding:20px;">
                        Пользователей пока нет
                    </td>
                </tr>
            `;

            return;
        }

        users.forEach((u) => {

            const tr = document.createElement('tr');

            const firstSeen = u.first_seen_at
                ? new Date(u.first_seen_at).toLocaleString()
                : '-';

            const gpsTime = u.gps_updated_at
                ? new Date(u.gps_updated_at).toLocaleTimeString()
                : '-';

            const coordinates =
                u.lat != null && u.lng != null
                    ? `${u.lat}, ${u.lng}`
                    : '-';

            let status = '⚪ Offline';

            if (u.is_blocked) {
                status = '🔴 Заблокирован';
            } else if (u.status === 'online') {
                status = '🟢 Online';
            }

            tr.innerHTML = `
                <td>
                    <code>${escapeHtml(u.id)}</code>
                </td>

                <td>
                    ${escapeHtml(u.name || '-')}
                </td>

                <td>
                    ${escapeHtml(firstSeen)}
                </td>

                <td>
                    ${escapeHtml(coordinates)}
                </td>

                <td>
                    ${escapeHtml(gpsTime)}
                </td>

                <td>
                    ${status}
                </td>

                <td>
                    <button
                        class="block-btn"
                        data-id="${escapeHtml(u.id)}"
                        data-blocked="${Boolean(u.is_blocked)}"
                        style="
                            background:${u.is_blocked ? '#00796B' : '#d9534f'};
                            color:white;
                            border:0;
                            padding:8px 12px;
                            border-radius:8px;
                            cursor:pointer;
                        "
                    >
                        ${u.is_blocked ? 'Разблокировать' : 'Чёрный экран'}
                    </button>
                </td>
            `;

            usersTableBody.appendChild(tr);
        });

    } finally {

        isLoadingUsers = false;

        if (reloadRequested) {

            reloadRequested = false;

            loadUsers();
        }
    }
}


// ========================================
// 11. BLOCK / UNBLOCK USERS
// ========================================

usersTableBody.addEventListener('click', async (e) => {

    const btn = e.target.closest('.block-btn');

    if (!btn || !isAdmin) return;

    const id = btn.dataset.id;

    const nextBlocked = btn.dataset.blocked !== 'true';

    btn.disabled = true;

    try {

        const { data, error } = await supabase
            .from('devices')
            .update({
                is_blocked: nextBlocked,
                status: nextBlocked ? 'blocked' : 'online'
            })
            .eq('id', id)
            .select('id');

        if (error) {

            console.error('Ошибка блокировки:', error);

            alert('Ошибка: ' + error.message);

            return;
        }

        if (!data || data.length === 0) {

            alert('Изменения не сохранены. Проверь RLS.');

            return;
        }

        await loadUsers();

    } catch (err) {

        console.error('Ошибка блокировки:', err);

        alert('Ошибка соединения');

    } finally {

        btn.disabled = false;
    }
});


// ========================================
// 12. REALTIME DEVICES
// ========================================

function subscribeRealtimeAdmin() {

    if (!isAdmin || adminChannel) return;

    adminChannel = supabase
        .channel('admin-devices')

        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'devices'
            },
            () => {

                loadUsers();
            }
        )

        .subscribe((status) => {

            console.log('Devices Realtime:', status);
        });
}


// ========================================
// 13. REALTIME SETTINGS
// ========================================

function subscribeRealtimeSettings() {

    if (!isAdmin || settingsChannel) return;

    settingsChannel = supabase
        .channel('admin-settings')

        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'app_settings',
                filter: 'id=eq.1'
            },
            (payload) => {

                currentTrackingState =
                    payload.new.tracking_enabled;

                updateTrackingButtonUI();
            }
        )

        .subscribe((status) => {

            console.log('Settings Realtime:', status);
        });
}


// ========================================
// 14. ESCAPE HTML
// ========================================

function escapeHtml(value) {

    return String(value ?? '').replace(/[&<>"']/g, (m) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m]));
}


// ========================================
// 15. AUTH STATE
// ========================================

supabase.auth.onAuthStateChange((event, session) => {

    if (event === 'SIGNED_OUT') {

        isAdmin = false;

        if (adminChannel) {
            supabase.removeChannel(adminChannel);
            adminChannel = null;
        }

        if (settingsChannel) {
            supabase.removeChannel(settingsChannel);
            settingsChannel = null;
        }

        showLogin();
    }
});


// ========================================
// 16. INITIALIZATION
// ========================================

async function initAdmin() {

    showLogin();

    await checkAdminSession();
}

initAdmin();

// ========================================
// ВХОД / ВЫХОД ИЗ АДМИН-ПАНЕЛИ
// ========================================

const adminEntryBtn = document.getElementById('admin-entry-btn');
const adminLogin = document.getElementById('admin-login');
const adminPanel = document.getElementById('admin-panel');
const cancelAdminLogin = document.getElementById('cancel-admin-login');

adminEntryBtn?.addEventListener('click', () => {
    adminLogin.style.display = 'flex';
});

cancelAdminLogin?.addEventListener('click', () => {
    adminLogin.style.display = 'none';
});

/*
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
*/
