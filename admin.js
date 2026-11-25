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

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


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

let currentTrackingState = true;

let adminChannel = null;

let isAdmin = false;
let isLoadingUsers = false;


// ========================================
// 4. UI
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
// 5. ADMIN LOGIN
// ========================================

loginForm.addEventListener('submit', async (e) => {

    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    const submitBtn = loginForm.querySelector('button[type="submit"]');

    if (submitBtn) {
        submitBtn.disabled = true;
    }

    try {

        // Вход в существующий аккаунт
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            alert('Ошибка входа: ' + error.message);
            return;
        }

        // Проверяем права администратора
        await checkAdminSession();

    } catch (err) {

        console.error('Ошибка авторизации:', err);

        alert('Ошибка соединения с Supabase');

    } finally {

        if (submitBtn) {
            submitBtn.disabled = false;
        }
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

        // Проверка UID в таблице admins
        const { data: admin, error: adminError } = await supabase
            .from('admins')
            .select('id')
            .eq('id', session.user.id)
            .maybeSingle();

        if (adminError) {

            console.error('Ошибка проверки администратора:', adminError);

            await supabase.auth.signOut();

            showLogin();

            alert('Не удалось проверить права администратора');

            return;
        }

        if (!admin) {

            console.warn('Пользователь не является администратором');

            await supabase.auth.signOut();

            showLogin();

            alert('У вас нет прав администратора');

            return;
        }

        console.log('Администратор авторизован:', session.user.email);

        showAdminPanel();

        await loadSettings();

        await loadUsers();

        subscribeRealtimeAdmin();

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

        await supabase.auth.signOut();

        showLogin();

        loginForm.reset();

        console.log('Администратор вышел');

    } catch (err) {

        console.error('Ошибка выхода:', err);
    }
});


// ========================================
// 8. LOAD GLOBAL GPS SETTINGS
// ========================================

async function loadSettings() {

    const { data, error } = await supabase
        .from('app_settings')
        .select('tracking_enabled')
        .eq('id', 1)
        .single();

    if (error) {

        console.error('Ошибка загрузки настроек:', error);

        toggleTrackingBtn.textContent = 'Ошибка загрузки настроек';

        return;
    }

    if (!data) return;

    currentTrackingState = data.tracking_enabled;

    updateTrackingButtonUI();
}


// ========================================
// 9. UPDATE GLOBAL GPS BUTTON
// ========================================

function updateTrackingButtonUI() {

    toggleTrackingBtn.textContent = currentTrackingState
        ? 'Отключить отслеживание всех пользователей'
        : 'Включить отслеживание всех пользователей';

    toggleTrackingBtn.style.background = currentTrackingState
        ? '#d9534f'
        : '#00796B';
}


// ========================================
// 10. TOGGLE GLOBAL GPS
// ========================================

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

            alert('Нет прав или ошибка: ' + error.message);

            return;
        }

        if (!data || data.length === 0) {

            alert('Настройки не обновлены. Проверь RLS и права доступа.');

            return;
        }

        currentTrackingState = data[0].tracking_enabled;

        updateTrackingButtonUI();

    } catch (err) {

        console.error('Ошибка GPS:', err);

        alert('Ошибка соединения');

    } finally {

        toggleTrackingBtn.disabled = false;
    }
});


// ========================================
// 11. LOAD USERS
// ========================================

async function loadUsers() {

    if (!isAdmin || isLoadingUsers) return;

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
                    <td colspan="7" style="text-align:center;padding:25px;">
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
                <td><code>${escapeHtml(u.id)}</code></td>

                <td>${escapeHtml(u.name || '-')}</td>

                <td>${escapeHtml(firstSeen)}</td>

                <td>${escapeHtml(coordinates)}</td>

                <td>${escapeHtml(gpsTime)}</td>

                <td>${status}</td>

                <td>
                    <button
                        class="block-btn"
                        data-id="${escapeHtml(u.id)}"
                        data-blocked="${Boolean(u.is_blocked)}"
                        style="
                            background:${u.is_blocked ? '#00796B' : '#d9534f'};
                            color:white;
                            padding:8px 12px;
                            border:none;
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
    }
}


// ========================================
// 12. BLOCK / UNBLOCK DEVICE
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

            alert('Ошибка блокировки: ' + error.message);

            return;
        }

        if (!data || data.length === 0) {

            alert('Устройство не обновлено. Проверь права RLS.');

            return;
        }

        await loadUsers();

    } catch (err) {

        console.error('Ошибка:', err);

        alert('Ошибка соединения');

    } finally {

        btn.disabled = false;
    }
});


// ========================================
// 13. REALTIME DEVICES
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

            console.log('Realtime status:', status);
        });
}


// ========================================
// 14. REALTIME SETTINGS
// ========================================

let settingsChannel = null;

function subscribeRealtimeSettings() {

    if (settingsChannel) return;

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

                currentTrackingState = payload.new.tracking_enabled;

                updateTrackingButtonUI();
            }
        )

        .subscribe();
}


// ========================================
// 15. HTML ESCAPE
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
// 16. AUTH STATE CHANGES
// ========================================

supabase.auth.onAuthStateChange((event, session) => {

    if (event === 'SIGNED_OUT') {

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
// 17. INITIALIZATION
// ========================================

async function initAdmin() {

    showLogin();

    await checkAdminSession();

    if (isAdmin) {
        subscribeRealtimeSettings();
    }
}

initAdmin();

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
