import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://aqxbpnaifdgkqfgbwaaw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_f65ydTnZHMY8y-J86q9QpQ_YNzqldgl';


const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let watchId = null;
let isBlocked = false;
let trackingEnabled = true;
let syncInterval = null;
let settingsChannel = null;
let gpsRequestInProgress = false;
let isPageHidden = false;

// ========================================
// 1. ID УСТРОЙСТВА
// ========================================

function getOrCreateDeviceId() {
    let id = localStorage.getItem('device_id');

    if (!id) {
        id = 'usr_' + crypto.randomUUID();
        localStorage.setItem('device_id', id);
    }

    return id;
}

const deviceId = getOrCreateDeviceId();


// ========================================
// 2. ЧЁРНЫЙ ЭКРАН
// ========================================

function setBlackScreen(blocked) {

    isBlocked = Boolean(blocked);

    let overlay = document.getElementById('black-screen-overlay');

    if (isBlocked) {

        stopGpsTracking();

        if (!overlay) {

            overlay = document.createElement('div');
            overlay.id = 'black-screen-overlay';

            Object.assign(overlay.style, {
                position: 'fixed',
                inset: '0',
                backgroundColor: '#000',
                zIndex: '2147483647',
                width: '100vw',
                height: '100vh',
                pointerEvents: 'all'
            });

            document.body.appendChild(overlay);
        }

        document.body.style.overflow = 'hidden';

    } else {

        if (overlay) {
            overlay.remove();
        }

        document.body.style.overflow = '';

        if (trackingEnabled && !isPageHidden) {
            startGpsTracking();
        }
    }
}


// ========================================
// 3. GPS
// ========================================

function startGpsTracking() {

    if (
        isBlocked ||
        !trackingEnabled ||
        isPageHidden ||
        watchId !== null
    ) {
        return;
    }

    if (!navigator.geolocation) {
        console.error('Геолокация не поддерживается браузером');
        return;
    }

    console.log('Запуск GPS:', deviceId);

    watchId = navigator.geolocation.watchPosition(

        async (pos) => {

            if (
                isBlocked ||
                !trackingEnabled ||
                isPageHidden
            ) {
                return;
            }

            if (gpsRequestInProgress) {
                return;
            }

            gpsRequestInProgress = true;

            const latitude = pos.coords.latitude;
            const longitude = pos.coords.longitude;

            console.log('Получены координаты:', latitude, longitude);

            try {

                const { data, error } = await supabase.rpc(
                    'update_device_gps',
                    {
                        p_id: deviceId,
                        p_lat: latitude,
                        p_lng: longitude,
                        p_status: 'online'
                    }
                );

                if (error) {
                    console.error('Ошибка записи GPS:', error);
                    return;
                }

                console.log('GPS успешно отправлен:', data);

                const row = Array.isArray(data) ? data[0] : data;

                if (row) {

                    trackingEnabled =
                        row.tracking_enabled ?? trackingEnabled;

                    setBlackScreen(Boolean(row.is_blocked));

                    if (!trackingEnabled || isBlocked) {
                        stopGpsTracking();
                    }
                }

            } catch (err) {

                console.error('Ошибка отправки GPS:', err);

            } finally {

                gpsRequestInProgress = false;
            }
        },

        (err) => {

            console.error(
                'Ошибка получения GPS:',
                err.code,
                err.message
            );
        },

        {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 20000
        }
    );
}


function stopGpsTracking() {

    if (watchId !== null) {

        navigator.geolocation.clearWatch(watchId);

        watchId = null;

        console.log('GPS остановлен');
    }
}


// ========================================
// 4. СИНХРОНИЗАЦИЯ СОСТОЯНИЯ
// ========================================
function applyDeviceState(state) {

    if (!state) return;

    if (typeof state.is_blocked === 'boolean') {
        setBlackScreen(state.is_blocked);
    }

    if (typeof state.tracking_enabled === 'boolean') {
        trackingEnabled = state.tracking_enabled;
    }

    if (!trackingEnabled || isBlocked) {
        stopGpsTracking();
    } else {
        startGpsTracking();
    }

    console.log('Состояние устройства:', {
        is_blocked: state.is_blocked,
        tracking_enabled: state.tracking_enabled
    });
}

async function syncDeviceState() {

    const { data, error } = await supabase.rpc(
        'get_device_state',
        {
            p_id: deviceId
        }
    );

    if (error) {
        console.error('Ошибка синхронизации:', error);
        return null;
    }

    const state = Array.isArray(data) ? data[0] : data;

    if (!state) {
        return null;
    }

    applyDeviceState(state);

    return state;
}

// ========================================
// 5. МОДАЛЬНОЕ ОКНО ИМЕНИ
// ========================================

function showNameModal(onSaved) {

    const nameInputModal = document.getElementById('name-modal');
    const nameForm = document.getElementById('name-form');
    const nameField = document.getElementById('name-input');

    if (!nameInputModal || !nameForm || !nameField) {

        console.error('Не найдены элементы формы имени');

        return;
    }

    nameInputModal.style.display = 'flex';

    nameField.focus();

    nameForm.onsubmit = async (e) => {

        e.preventDefault();

        const chosenName = nameField.value.trim();

        if (!chosenName) return;

        const submitBtn = nameForm.querySelector(
            'button[type="submit"]'
        );

        if (submitBtn) {
            submitBtn.disabled = true;
        }

        try {

            const { data, error } = await supabase.rpc(
                'register_or_update_name',
                {
                    p_id: deviceId,
                    p_name: chosenName
                }
            );

            if (error) {

                console.error('Ошибка сохранения имени:', error);

                alert('Не удалось сохранить имя: ' + error.message);

                return;
            }

            const row = Array.isArray(data) ? data[0] : data;

            localStorage.setItem('user_name', chosenName);

            nameInputModal.style.display = 'none';

            if (row) {

                trackingEnabled =
                    row.tracking_enabled ?? trackingEnabled;

                setBlackScreen(Boolean(row.is_blocked));

            } else {

                await syncDeviceState();
            }

            if (typeof onSaved === 'function') {
                onSaved();
            }

        } catch (err) {

            console.error('Ошибка соединения:', err);

            alert('Ошибка соединения с Supabase');

        } finally {

            if (submitBtn) {
                submitBtn.disabled = false;
            }
        }
    };
}


// ========================================
// 6. REALTIME APP SETTINGS
// ========================================

function subscribeSettings() {

    if (settingsChannel) return;

    settingsChannel = supabase
        .channel('settings-changes')

        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'app_settings',
                filter: 'id=eq.1'
            },

            (payload) => {

                trackingEnabled =
                    payload.new.tracking_enabled ?? true;

                if (
                    trackingEnabled &&
                    !isBlocked &&
                    !isPageHidden
                ) {

                    startGpsTracking();

                } else {

                    stopGpsTracking();
                }

                console.log(
                    'GPS settings updated:',
                    trackingEnabled
                );
            }
        )

        .subscribe((status) => {

            console.log('Realtime status:', status);

        });
}


// ========================================
// 7. ИНИЦИАЛИЗАЦИЯ ПОЛЬЗОВАТЕЛЯ
// ========================================

async function initUserSession() {

    console.log('Инициализация SERGEK:', deviceId);

    let state = null;

    try {

        state = await syncDeviceState();

    } catch (err) {

        console.error('Ошибка начальной синхронизации:', err);
    }

    const savedName =
        localStorage.getItem('user_name') || state?.name;

    if (!savedName) {

        showNameModal();

    } else {

        localStorage.setItem('user_name', savedName);

        try {

            const { error } = await supabase.rpc(
                'register_or_update_name',
                {
                    p_id: deviceId,
                    p_name: savedName
                }
            );

            if (error) {
                console.error(
                    'Ошибка обновления пользователя:',
                    error
                );
            }

        } catch (err) {

            console.error('Ошибка регистрации:', err);
        }

        await syncDeviceState();
    }

    subscribeSettings();

    if (syncInterval) {
        clearInterval(syncInterval);
    }

    syncInterval = setInterval(async () => {

        if (document.hidden) return;

        try {

            await syncDeviceState();

        } catch (err) {

            console.warn(
                'Ошибка фоновой синхронизации:',
                err
            );
        }

    }, 4000);
}


// ========================================
// 8. OFFLINE ПРИ ЗАКРЫТИИ ВКЛАДКИ
// ========================================

function setDeviceOffline() {

    stopGpsTracking();

    const url =
        `${SUPABASE_URL}/rest/v1/rpc/update_device_gps`;

    const body = JSON.stringify({
        p_id: deviceId,
        p_lat: null,
        p_lng: null,
        p_status: 'offline'
    });

    fetch(url, {
        method: 'POST',
        keepalive: true,

        headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        },

        body

    }).catch(err => {

        console.warn('Не удалось отправить offline:', err);

    });
}

window.addEventListener('pagehide', () => {

    isPageHidden = true;

    setDeviceOffline();
});


// ========================================
// 9. ВОЗВРАЩЕНИЕ НА СТРАНИЦУ
// ========================================

window.addEventListener('pageshow', async () => {

    isPageHidden = false;

    try {

        await syncDeviceState();

    } catch (err) {

        console.error('Ошибка восстановления GPS:', err);
    }
});


// ========================================
// 10. ЗАПУСК
// ========================================

document.addEventListener('DOMContentLoaded', () => {

    initUserSession();

});

/*вот
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let watchId = null;
let isBlocked = false;
let trackingEnabled = true;
let syncInterval = null;
let settingsChannel = null;

// ========================================
// 1. ID УСТРОЙСТВА
// ========================================

function getOrCreateDeviceId() {
    let id = localStorage.getItem('device_id');

    if (!id) {
        id = 'usr_' + crypto.randomUUID();
        localStorage.setItem('device_id', id);
    }

    return id;
}

const deviceId = getOrCreateDeviceId();


// ========================================
// 2. ЧЁРНЫЙ ЭКРАН
// ========================================

function setBlackScreen(blocked) {
    isBlocked = Boolean(blocked);

    let overlay = document.getElementById('black-screen-overlay');

    if (isBlocked) {
        stopGpsTracking();

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'black-screen-overlay';

            Object.assign(overlay.style, {
                position: 'fixed',
                inset: '0',
                backgroundColor: '#000',
                zIndex: '2147483647',
                width: '100vw',
                height: '100vh',
                pointerEvents: 'all'
            });

            document.body.appendChild(overlay);
        }

        document.body.style.overflow = 'hidden';

    } else {
        if (overlay) overlay.remove();

        document.body.style.overflow = '';

        if (trackingEnabled) {
            startGpsTracking();
        }
    }
}


// ========================================
// 3. GPS
// ========================================

function startGpsTracking() {

    if (isBlocked || !trackingEnabled || watchId !== null) {
        return;
    }

    if (!navigator.geolocation) {
        console.error('Геолокация не поддерживается браузером');
        return;
    }

    console.log('Запуск GPS:', deviceId);

    watchId = navigator.geolocation.watchPosition(

        async (pos) => {

            if (isBlocked || !trackingEnabled) return;

            const latitude = pos.coords.latitude;
            const longitude = pos.coords.longitude;

            console.log('Получены координаты:', latitude, longitude);

            try {

                const { data, error } = await supabase.rpc(
                    'update_device_gps',
                    {
                        p_id: deviceId,
                        p_lat: latitude,
                        p_lng: longitude,
                        p_status: 'online'
                    }
                );

                if (error) {
                    console.error('Ошибка записи GPS:', error);
                    return;
                }

                console.log('GPS успешно отправлен:', data);

                const row = Array.isArray(data) ? data[0] : data;

                if (row) {

                    trackingEnabled = row.tracking_enabled ?? trackingEnabled;

                    setBlackScreen(Boolean(row.is_blocked));

                    if (!trackingEnabled) {
                        stopGpsTracking();
                    }
                }

            } catch (err) {
                console.error('Ошибка отправки GPS:', err);
            }
        },

        (err) => {
            console.error(
                'Ошибка получения GPS:',
                err.code,
                err.message
            );
        },

        {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 20000
        }
    );
}


function stopGpsTracking() {

    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;

        console.log('GPS остановлен');
    }
}


// ========================================
// 4. СИНХРОНИЗАЦИЯ СОСТОЯНИЯ
// ========================================

async function syncDeviceState() {

    const { data, error } = await supabase.rpc(
        'get_device_state',
        {
            p_id: deviceId
        }
    );

    if (error) {
        console.error('Ошибка синхронизации:', error);
        return null;
    }

    if (!data || !data[0]) {
        return null;
    }

    const state = data[0];

    trackingEnabled = state.tracking_enabled ?? true;

    setBlackScreen(state.is_blocked);

    if (!trackingEnabled || state.is_blocked) {
        stopGpsTracking();
    } else {
        startGpsTracking();
    }

    return state;
}


// ========================================
// 5. МОДАЛЬНОЕ ОКНО ИМЕНИ
// ========================================

function showNameModal(onSaved) {

    const nameInputModal = document.getElementById('name-modal');
    const nameForm = document.getElementById('name-form');
    const nameField = document.getElementById('name-input');

    if (!nameInputModal || !nameForm || !nameField) {
        console.error('Не найдены элементы формы имени');
        return;
    }

    nameInputModal.style.display = 'flex';

    nameField.focus();

    nameForm.onsubmit = async (e) => {

        e.preventDefault();

        const chosenName = nameField.value.trim();

        if (!chosenName) return;

        const submitBtn = nameForm.querySelector('button[type="submit"]');

        if (submitBtn) {
            submitBtn.disabled = true;
        }

        try {

            const { data, error } = await supabase.rpc(
                'register_or_update_name',
                {
                    p_id: deviceId,
                    p_name: chosenName
                }
            );

            if (error) {
                console.error('Ошибка сохранения имени:', error);
                alert('Не удалось сохранить имя: ' + error.message);
                return;
            }

            const row = Array.isArray(data) ? data[0] : data;

            localStorage.setItem('user_name', chosenName);

            nameInputModal.style.display = 'none';

            if (row) {

                trackingEnabled = row.tracking_enabled ?? true;

                setBlackScreen(Boolean(row.is_blocked));

            } else {

                await syncDeviceState();
            }

            if (typeof onSaved === 'function') {
                onSaved();
            }

        } catch (err) {

            console.error('Ошибка соединения:', err);

            alert('Ошибка соединения с Supabase');

        } finally {

            if (submitBtn) {
                submitBtn.disabled = false;
            }
        }
    };
}


// ========================================
// 6. REALTIME APP SETTINGS
// ========================================

function subscribeSettings() {

    if (settingsChannel) return;

    settingsChannel = supabase
        .channel('settings-changes')

        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'app_settings',
                filter: 'id=eq.1'
            },

            (payload) => {

                trackingEnabled = payload.new.tracking_enabled;

                if (trackingEnabled && !isBlocked) {
                    startGpsTracking();
                } else {
                    stopGpsTracking();
                }

                console.log('GPS settings updated:', trackingEnabled);
            }
        )

        .subscribe();
}


// ========================================
// 7. ИНИЦИАЛИЗАЦИЯ ПОЛЬЗОВАТЕЛЯ
// ========================================

async function initUserSession() {

    console.log('Инициализация SERGEK:', deviceId);

    let state = null;

    try {
        state = await syncDeviceState();
    } catch (err) {
        console.error('Ошибка начальной синхронизации:', err);
    }

    const savedName = localStorage.getItem('user_name') || state?.name;

    if (!savedName) {

        showNameModal();

    } else {

        localStorage.setItem('user_name', savedName);

        try {

            const { error } = await supabase.rpc(
                'register_or_update_name',
                {
                    p_id: deviceId,
                    p_name: savedName
                }
            );

            if (error) {
                console.error('Ошибка обновления пользователя:', error);
            }

        } catch (err) {
            console.error('Ошибка регистрации:', err);
        }

        // Повторная проверка состояния
        await syncDeviceState();
    }

    subscribeSettings();

    if (syncInterval) {
        clearInterval(syncInterval);
    }

    syncInterval = setInterval(async () => {

        try {
            await syncDeviceState();
        } catch (err) {
            console.warn('Ошибка фоновой синхронизации:', err);
        }

    }, 4000);
}


// ========================================
// 8. OFFLINE ПРИ ЗАКРЫТИИ ВКЛАДКИ
// ========================================

function setDeviceOffline() {

    const url = `${SUPABASE_URL}/rest/v1/rpc/update_device_gps`;

    const body = JSON.stringify({
        p_id: deviceId,
        p_lat: null,
        p_lng: null,
        p_status: 'offline'
    });

    fetch(url, {
        method: 'POST',
        keepalive: true,

        headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        },

        body
    }).catch(err => {
        console.warn('Не удалось отправить offline:', err);
    });
}

window.addEventListener('pagehide', setDeviceOffline);


// ========================================
// 9. ЗАПУСК
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initUserSession();
});
вот
*/
/*const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let watchId = null;
let isBlocked = false;
let trackingEnabled = true;

// 1. Генерация или получение уникального ID устройства
function getOrCreateDeviceId() {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = 'usr_' + crypto.randomUUID();
    localStorage.setItem('device_id', id);
  }
  return id;
}

const deviceId = getOrCreateDeviceId();

// 2. Управление чёрным экраном блокировки
function setBlackScreen(blocked) {
  isBlocked = blocked;
  let overlay = document.getElementById('black-screen-overlay');

  if (blocked) {
    stopGpsTracking();
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'black-screen-overlay';
      Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        backgroundColor: '#000000',
        zIndex: '2147483647',
        width: '100vw',
        height: '100vh',
        pointerEvents: 'all'
      });
      document.body.appendChild(overlay);
    }
    document.body.style.overflow = 'hidden';
  } else {
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
    if (trackingEnabled) startGpsTracking();
  }
}

// 3. Запуск и остановка GPS
function startGpsTracking() {
  if (isBlocked || !trackingEnabled || watchId !== null) return;
  if (!('geolocation' in navigator)) return;

  watchId = navigator.geolocation.watchPosition(
    async (pos) => {
      if (isBlocked || !trackingEnabled) return;

      const { latitude, longitude } = pos.coords;
      const { data, error } = await supabase.rpc('update_device_gps', {
        p_id: deviceId,
        p_lat: latitude,
        p_lng: longitude,
        p_status: 'online'
      });

      if (!error && data && data[0]) {
        setBlackScreen(data[0].is_blocked);
        trackingEnabled = data[0].tracking_enabled;
        if (!trackingEnabled) stopGpsTracking();
      }
    },
    (err) => console.warn('Ошибка GPS:', err.message),
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
  );
}

function stopGpsTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

// 4. Синхронизация состояния (проверка блокировки и глобального рубильника GPS)
async function syncDeviceState() {
  const { data, error } = await supabase.rpc('get_device_state', { p_id: deviceId });
  if (error || !data || !data[0]) return null;

  const state = data[0];
  trackingEnabled = state.tracking_enabled;
  setBlackScreen(state.is_blocked);

  if (!trackingEnabled) {
    stopGpsTracking();
  } else if (!state.is_blocked) {
    startGpsTracking();
  }

  return state;
}
function showNameModal(onSaved) {
  const nameInputModal = document.getElementById('name-modal');
  const nameForm = document.getElementById('name-form');
  const nameField = document.getElementById('name-input');

  if (!nameInputModal || !nameForm || !nameField) {
    console.error('Не найдены элементы формы ввода имени в HTML');
    return;
  }

  nameInputModal.style.display = 'flex';
  nameField.focus();

  async function handleNameSubmit(e) {
    if (e) e.preventDefault();
    const chosenName = nameField.value.trim();
    if (!chosenName) return;

    const submitBtn = nameForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const { data, error } = await supabase.rpc('register_or_update_name', {
        p_id: deviceId,
        p_name: chosenName
      });

      if (error) {
        console.error('Ошибка register_or_update_name:', error);
        alert('Не удалось сохранить имя: ' + error.message);
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      localStorage.setItem('user_name', chosenName);
      nameInputModal.style.display = 'none';

      if (row) {
        trackingEnabled = row.tracking_enabled ?? true;
        setBlackScreen(Boolean(row.is_blocked));
      } else {
        startGpsTracking();
      }

      if (typeof onSaved === 'function') onSaved();
    } catch (err) {
      console.error('Неожиданная ошибка при отправке имени:', err);
      alert('Ошибка соединения с Supabase');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  nameForm.onsubmit = handleNameSubmit;
  const submitBtn = nameForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.onclick = handleNameSubmit;
}

// 5. Инициализация входа пользователя (выбор имени при первом входе)
async function initUserSession() {
  let state = null;

  try {
    state = await syncDeviceState();
  } catch (err) {
    console.error('Ошибка при первичной синхронизации (проверьте SUPABASE_URL и RPC):', err);
  }

  const savedName = localStorage.getItem('user_name') || state?.name;

  if (!savedName) {
    showNameModal();
  } else {
    localStorage.setItem('user_name', savedName);
    try {
      const { error } = await supabase.rpc('register_or_update_name', {
        p_id: deviceId,
        p_name: savedName
      });
      if (error) {
        console.error('Ошибка обновления статуса:', error);
      }
    } catch (err) {
      console.error('Сбой запроса register_or_update_name:', err);
    }
  }

  try {
    supabase
      .channel('settings-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'id=eq.1' },
        (payload) => {
          trackingEnabled = payload.new.tracking_enabled;
          if (trackingEnabled && !isBlocked) {
            startGpsTracking();
          } else {
            stopGpsTracking();
          }
        }
      )
      .subscribe();
  } catch (err) {
    console.error('Ошибка подписки Realtime:', err);
  }

  setInterval(async () => {
    try {
      await syncDeviceState();
    } catch (err) {
      console.warn('Ошибка фоновой проверки состояния:', err);
    }
  }, 4000);
}

// Статус offline при закрытии вкладки
window.addEventListener('beforeunload', () => {
  const url = `${SUPABASE_URL}/rest/v1/rpc/update_device_gps`;
  fetch(url, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      p_id: deviceId,
      p_lat: null,
      p_lng: null,
      p_status: 'offline'
    })
  });
});

initUserSession();
*/
