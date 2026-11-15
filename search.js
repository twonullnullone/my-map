const input = document.getElementById("search-input");
const suggestions = document.getElementById("suggestions");
const clearBtn = document.getElementById("clear-btn");

// === Debounce ===
function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

// === Нормализация ===
function normalize(str) {
  if (!str && str !== "") return "";
  str = String(str).toLowerCase().trim();

  try {
    str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch (e) {}

  str = str.replace(/[-_.,\/\\+]/g, " ");
  str = str.replace(/[^0-9a-z\u0400-\u04FF\s]/g, " ");
  return str.replace(/\s+/g, " ").trim();
}

// === Левенштейн ===
function similarity(a, b) {
  a = normalize(a);
  b = normalize(b);
  if (!a || !b) return 0;
  if (a.includes(b) || b.includes(a)) return 1;

  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return 1 - dp[n][m] / Math.max(n, m);
}

// === Локальный поиск ===
function searchLocalPoints(query) {
  const q = normalize(query);
  if (!q) return [];

  const THRESH = 0.5;

  return points.filter((p) => {
    const name = normalize(p.name || "");
    const desc = normalize(p.description || "");

    if (name.includes(q) || desc.includes(q)) return true;
    if (similarity(name, q) >= THRESH) return true;
    if (similarity(desc, q) >= THRESH) return true;

    const qDigits = q.replace(/\D/g, "");
    if (qDigits) {
      const nameDigits = name.replace(/\D/g, "");
      if (nameDigits.includes(qDigits)) return true;
    }

    return false;
  });
}

// === Очистка подсказок ===
function clearSuggestions() {
  suggestions.innerHTML = "";
  suggestions.style.display = "none";
}

// === Отображение ===
function handleSearch(query) {
  suggestions.innerHTML = "";
  suggestions.style.display = "block";

  const results = searchLocalPoints(query);

  results.forEach((p) => {
    const li = document.createElement("li");
    li.className = "suggestion-item local";
    li.textContent = `📍 ${p.name}: ${p.description}`;

    li.addEventListener("click", () => {
      map.flyTo({ center: [p.lon, p.lat], zoom: 17 });

      const popup = new maplibregl.Popup()
        .setLngLat([p.lon, p.lat])
        .setHTML(`
          <strong>${p.name}</strong><br>
          ${p.description}<br><br>
          <button class="popup-btn-add">Добавить</button>
        `)
        .addTo(map);

      // ⚠️ ждём когда popup появится в DOM
      setTimeout(() => {
        const btn = document.querySelector(".popup-btn-add");
        if (btn) {
          btn.onclick = () => {
            activePoints.push(p);
            saveActivePoints();
            renderMarkers();
            
            popup.remove();
            alert(`Точка "${p.name}" добавлена ✅`);
          };
        }
      }, 50);

      clearSuggestions();
      input.value = "";
      input.blur();
    });

    suggestions.appendChild(li);
  });

  if (!results.length) {
    const li = document.createElement("li");
    li.className = "suggestion-item none";
    li.textContent = "❌ Ничего не найдено";
    suggestions.appendChild(li);
  }
}


// === Ввод ===
input.addEventListener(
  "input",
  debounce((e) => {
    const q = e.target.value;
    if (q && q.trim().length > 1) handleSearch(q);
    else clearSuggestions();
  }, 250)
);

// === Клик вне ===
document.addEventListener("click", (e) => {
  if (
    !suggestions.contains(e.target) &&
    e.target !== input &&
    e.target !== clearBtn
  ) {
    clearSuggestions();
  }
});

// === Очистка ===
clearBtn.addEventListener("click", () => {
  input.value = "";
  clearSuggestions();
  input.focus();
});

suggestions.style.display = "none";

/*const input = document.getElementById("search-input");
const suggestions = document.getElementById("suggestions");
const clearBtn = document.getElementById("clear-btn"); // 🧹 кнопка очистки

// Debounce
function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

// Нормализация строки (без регистра, дефисов и прочего)
function normalize(str) {
  if (!str && str !== "") return "";
  str = String(str).toLowerCase().trim();
  try {
    str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch (e) {}
  str = str.replace(/[-_.,\/\\+]/g, " ");
  str = str.replace(/[^0-9a-z\u0400-\u04FF\s]/g, " ");
  return str.replace(/\s+/g, " ").trim();
}

// Нечёткое сравнение (Левенштейн)
function similarity(a, b) {
  a = normalize(a);
  b = normalize(b);
  if (!a || !b) return 0;
  if (a.includes(b) || b.includes(a)) return 1;

  const n = a.length,
    m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  const dist = dp[n][m];
  return 1 - dist / Math.max(n, m);
}

// Поиск по локальным точкам
function searchLocalPoints(query) {
  const q = normalize(query);
  if (!q) return [];

  const THRESH = 0.5;

  return points.filter((p) => {
    const name = normalize(p.name || "");
    const desc = normalize(p.description || "");
    if (name.includes(q) || desc.includes(q)) return true;
    if (similarity(name, q) >= THRESH || similarity(desc, q) >= THRESH)
      return true;
    const digitsQ = q.replace(/\D/g, "");
    if (digitsQ) {
      const digitsName = name.replace(/\D/g, "");
      if (digitsName && digitsName.includes(digitsQ)) return true;
    }
    return false;
  });
}

// Поиск Nominatim
async function searchNominatim(query) {
  const q = query.trim();
  if (!q) return [];
  const params = new URLSearchParams({
    q: q + ", Shymkent, Kazakhstan",
    format: "json",
    addressdetails: 1,
    limit: 5,
  });
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
    );
    if (!response.ok) return [];
    return await response.json();
  } catch (e) {
    console.warn("Nominatim error:", e);
    return [];
  }
}

// Очистка подсказок
function clearSuggestions() {
  suggestions.innerHTML = "";
  suggestions.style.display = "none";
}

// Основной поиск и отображение
async function handleSearch(query) {
  suggestions.innerHTML = "";
  suggestions.style.display = "block";

  const [nominatimResults, localResults] = await Promise.all([
    searchNominatim(query),
    Promise.resolve(searchLocalPoints(query)),
  ]);

  // Локальные результаты
  localResults.forEach((p) => {
    const li = document.createElement("li");
    li.className = "suggestion-item local";
    li.textContent = `📍 ${p.name}: ${p.description}`;
    li.onclick = () => {
      map.flyTo({ center: [p.lon, p.lat], zoom: 17 });
      new maplibregl.Popup()
        .setLngLat([p.lon, p.lat])
        .setHTML(`<strong>${p.name}</strong><br>${p.description}`)
        .addTo(map);
      clearSuggestions();
      input.value = "";
      input.blur();
    };
    suggestions.appendChild(li);
  });

  // Nominatim
  nominatimResults.forEach((place) => {
    const li = document.createElement("li");
    li.className = "suggestion-item remote";
    li.textContent = `🌍 ${place.display_name}`;
    li.onclick = () => {
      const lon = parseFloat(place.lon);
      const lat = parseFloat(place.lat);
      map.flyTo({ center: [lon, lat], zoom: 17 });
      new maplibregl.Popup()
        .setLngLat([lon, lat])
        .setHTML(`<strong>Адрес:</strong><br>${place.display_name}`)
        .addTo(map);
      clearSuggestions();
      input.value = "";
      input.blur();
    };
    suggestions.appendChild(li);
  });

  if (!suggestions.children.length) {
    const li = document.createElement("li");
    li.className = "suggestion-item none";
    li.textContent = "❌ Ничего не найдено";
    suggestions.appendChild(li);
  }
}

// Обработка ввода
input.addEventListener(
  "input",
  debounce((e) => {
    const query = e.target.value;
    if (query && query.trim().length > 1) handleSearch(query);
    else clearSuggestions();
  }, 250),
);

// Закрытие подсказок при клике вне
document.addEventListener("click", (e) => {
  if (
    !suggestions.contains(e.target) &&
    e.target !== input &&
    e.target !== clearBtn
  ) {
    clearSuggestions();
  }
});

// 🧹 Очистка через кнопку
clearBtn.addEventListener("click", () => {
  input.value = "";
  clearSuggestions();
  input.focus(); // вернуть фокус в поле
});

suggestions.style.display = "none";
*/
