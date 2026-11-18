/*
https://styles.trailsta.sh/maptiler-toner.json
https://styles.trailsta.sh/fiord-color.json
*/
// код карты

let allPoints = [];
let activePoints = JSON.parse(localStorage.getItem("activePoints") || "[]");
let markers = [];
let userMarker = null;
let userLocation = [69.629393, 42.348473];
let routeLayerId = null;
const hexColors = [
  "#000", // 0 локация
  "#aeddbd", // 1 трава
  "#fff", // 2 здания
  "#000", // 3 маркеры points
  "#004e72", // 4 ползователская локация
  "#eeeeec", // 5 цвет текста дорог
  "#eeeeec", // 6 цвет текста дорог обводка
  "#526972", // 7 дороги
  "#526972", // 8 обводка дорог
  "#d54e26", // 9 маршрут
];

/* Loading points.js */
/*
function loadPointsAsync() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "points.js";
    script.onload = () =>
      typeof points !== "undefined"
        ? resolve(points)
        : reject("points not defined");
    script.onerror = () => reject("Failed to load points.js");
    document.head.appendChild(script);
  });
}*/

async function loadPointsAsync() {
    try {
        const url = `coords.json?v=${Date.now()}`;

        const response = await fetch(url, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();

    } catch (err) {
        console.error("Ошибка загрузки координат:", err);
        throw err;
    }
}
/* Loading points.js*/

/* Инициализация MapLibre */
const map = new maplibregl.Map({
  container: "map",
style: "mapstyle/black3.json"
,
  center: [69.5869, 42.3417],
  zoom: 10,
  pitch: 40,
  maxPitch: 85,
  bearing: -20,
  antialias: true,
  renderWorldCopies: true,


});

map.addControl(new maplibregl.NavigationControl(), "bottom-right");

map.on("style.load", () => {
  map.setProjection({ type: "globe" });
});

document.getElementById("project").addEventListener("click", () => {
  const currentProjection = map.getProjection();
  map.setProjection({
    type: currentProjection.type === "globe" ? "mercator" : "globe",
  });
});
/* Инициализация MapLibre */

/* Search */
////////////////
/* Search end */

/* Menu buttons */
document.addEventListener("DOMContentLoaded", () => {
  const checkbox = document.querySelector('#menuToggle input[type="checkbox"]');
  if (!checkbox) {
    console.warn("checkbox внутри #menuToggle не найден");
    return;
  }

  checkbox.addEventListener("change", () => {
   // const controlPanel = document.getElementById("controlPanel");
   // const searchPanel = document.getElementById("search-panel");
   // const glass = document.querySelector(".glass-container");
   // const glassContainer = document.querySelector(".glass-radio-group");

 /*   if (controlPanel) controlPanel.classList.toggle("active");
    if (searchPanel) searchPanel.classList.toggle("searchActive");
    if (glass) glass.classList.toggle("glass-container-active");*/
  /*  if (glassContainer)
      glassContainer.classList.toggle("glass-radio-group-active");*/
  });
});

/* Menu buttons END*/

/* Local Stroage */
function saveActivePoints() {
  localStorage.setItem("activePoints", JSON.stringify(activePoints));
}
function clearActivePoints() {
  activePoints = [];
  localStorage.removeItem("activePoints");
  renderMarkers();
  renderFilterList(allPoints);
}
/* Local Stroage END*/

/* Popup */
////////////////
/* Popup END */

/* category */
////////////////
/*Caterogory END*/

/* Location */
//////////////////
/* Location  END*/

/*Menu filter */
document.getElementById("filterBtn").onclick = () => {
  renderFilterList(allPoints);
  openModal("filterModal");
};

function renderFilterList(data) {
  const list = document.getElementById("filterList");
  list.innerHTML = "";
  data.forEach((p) => {
    const div = document.createElement("div");
    div.className = "point-item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = activePoints.some((a) => a.lat === p.lat && a.lon === p.lon);
    cb.onchange = () => {
      if (cb.checked) {
        if (!activePoints.some((a) => a.lat === p.lat && a.lon === p.lon))
          activePoints.push(p);
      } else {
        activePoints = activePoints.filter(
          (a) => !(a.lat === p.lat && a.lon === p.lon),
        );
      }
      saveActivePoints();
      renderMarkers();
    };
    const lbl = document.createElement("label");
    lbl.innerText = `${p.name} - ${p.description}`;
    lbl.style.marginLeft = "8px";
    div.append(cb, lbl);
    list.appendChild(div);
  });
}

document.getElementById("filterSearch").addEventListener("input", (e) => {
  let text = e.target.value.toLowerCase();
  let filtered = allPoints.filter(
    (p) =>
      p.name.toLowerCase().includes(text) ||
      p.description.toLowerCase().includes(text),
  );
  renderFilterList(filtered);
});
document.getElementById("resetFilterBtn").onclick = () => {
  if (confirm("Сбросить все выбранные точки ?")) clearActivePoints();
};
/*Menu filter END*/

/* Camera button */
document.getElementById("cameraBtn").onclick = () => {
  const list = document.getElementById("cameraList");
  list.innerHTML = "";
  activePoints.forEach((p) => {
    const div = document.createElement("div");
    div.className = "point-item";
    div.innerText = `${p.name} - ${p.description}`;
    div.onclick = () => {
      map.flyTo({ center: [p.lon, p.lat], zoom: 15 });
      closeModal("cameraModal");
    };
    list.appendChild(div);
  });
  openModal("cameraModal");
};
/* Camera button END*/

/* textScan */
document.getElementById("textScan").onclick = () => {
    const modal = document.getElementById("searchModal");
    const contents = modal.querySelector(".modal-contents");

    modal.style.display = "block";

    requestAnimationFrame(() => {
        modal.classList.add("active");
        contents.classList.add("active");
    });
};
document.getElementById("okBtn").onclick = () => {

    const text = document.getElementById("searchText").value;

    if (!text) return;


     document.getElementById("searchText").value = ""; // очистить
    document.getElementById("searchModal").style.display = "none";

    // Здесь вставляется ВЕСЬ ваш код поиска,
    // начиная с:
    // const matches = text.match(...)

  // Ищем коды
  const matches = text.match(
    /(ОВН|OVN|ЛУ|LU|П|P)\s*-?\s*\d+/gi
  );

  console.log(matches);

  if (!matches) {
    alert("Ничего не найдено");
    return;
  }

  // Нормализация
  function normalizeCode(str) {

    let code = str.toUpperCase();

    // Кириллица -> латиница
    code = code.replace(/ОВН/g, "OVN");
    code = code.replace(/ЛУ/g, "LU");

    // П -> P
    code = code.replace(/^П/g, "P");

    // убрать -
    code = code.replace(/-/g, " ");

    // убрать двойные пробелы
    code = code.replace(/\s+/g, " ").trim();

    return code;
  }

  let added = 0;

  matches.forEach(match => {

    const searchCode = normalizeCode(match);

    console.log("SEARCH:", searchCode);

    const point = allPoints.find(p => {

      const pointCode = normalizeCode(p.name);

      console.log(pointCode);

      return pointCode === searchCode;
    });

    if (point) {

      const exists = activePoints.some(
        p => normalizeCode(p.name) === searchCode
      );

      if (!exists) {
        activePoints.push(point);
        added++;
      }
    }
  });

  localStorage.setItem(
    "activePoints",
    JSON.stringify(activePoints)
  );

  renderMarkers();
  renderFilterList(allPoints);

  alert(`Добавлено: ${added}`);
};

document.getElementById("cancelBtn").onclick = () => {
    const modal = document.getElementById("searchModal");
    const contents = modal.querySelector(".modal-contents");

    modal.classList.remove("active");
    contents.classList.remove("active");

    setTimeout(() => {
        modal.style.display = "none";
        document.getElementById("searchText").value = "";
    }, 350);
};
/* textScan END */

/* Style */
/* Style END */

/*Scan */
/*Scan END*/

/* Luch */
/* Luch END */
/*
loadPointsAsync().then((data) => {
  allPoints = data;
  renderMarkers();
  //document.getElementById("loadingScreen").classList.add("hidden");
 // setTimeout(() => document.getElementById("loadingScreen").remove(), 10000);
setTimeout(() => {
  const el = document.querySelector(".gggg");
  if (!el) return;
  el.classList.add("hide");
  setTimeout(() => el.remove(), 500);
}, 3000);


});
*/


const slider = document.getElementById("bottomSlider");

const slides = [
    document.getElementById("bottomBar"),
    document.getElementById("controlPanel"),
    document.getElementById("search-panel")
];

let currentSlide = 0;

function showSlide(index) {

    currentSlide = (index + slides.length) % slides.length;

    slides.forEach((slide, i) => {

        slide.classList.remove("active", "prev", "next");

        if (i === currentSlide) {
            slide.classList.add("active");
        } 
        else if (i < currentSlide) {
            slide.classList.add("prev");
        } 
        else {
            slide.classList.add("next");
        }

    });
}

let touchStartX = 0;
let touchEndX = 0;

slider.addEventListener("touchstart", (e) => {

    touchStartX = e.changedTouches[0].screenX;

}, { passive: true });

slider.addEventListener("touchend", (e) => {

    touchEndX = e.changedTouches[0].screenX;

    const difference = touchEndX - touchStartX;

    if (Math.abs(difference) < 50) return;

    if (difference < 0) {
        // Свайп влево
        showSlide(currentSlide + 1);
    } 
    else {
        // Свайп вправо
        showSlide(currentSlide - 1);
    }

}, { passive: true });


document.getElementById("jsonedit").addEventListener("click", function () {
    Android.openJsonEditor();
});

async function reloadPoints() {
    allPoints = await loadPointsAsync();
   window.points = allPoints;
    //clearMarkers();
    renderMarkers();
}

reloadPoints().then(() => {

    setTimeout(() => {
        const el = document.querySelector(".containerLoader");
        if (!el) return;
        el.classList.add("hide");
        setTimeout(() => el.remove(), 500);
    }, 3000);

});




const themeOpen = document.getElementById("mapStyle");
const themeClose = document.getElementById("sergek-theme-close");
const themeSheet = document.getElementById("sergek-theme-sheet");
const themeOverlay = document.getElementById("sergek-theme-overlay");

const THEME_STORAGE_KEY = "sergekMapTheme";

const themePaths = {
    default: "mapstyle/black.json",
    black3: "mapstyle/black3.json",
    blue: "mapstyle/blue.json",
    green: "mapstyle/black3.json",
    white: "mapstyle/test10.json",
    dark: "mapstyle/top1.json",
    light: "mapstyle/light.json",
    gray: "mapstyle/pattern.json",
    night: "mapstyle/night.json",
    pastel: "mapstyle/pastel.json",
    retro: "mapstyle/retro.json",
    terrain: "mapstyle/terrain.json",
    satellite: "mapstyle/satellite.json",
    minimal: "mapstyle/minimal.json",
    contrast: "mapstyle/contrast.json"
};

// Получение сохранённой темы
function getSavedTheme() {
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);

        if (saved && themePaths[saved]) {
            return saved;
        }
    } catch (error) {
        console.warn("Не удалось прочитать тему:", error);
    }

    return "black3";
}

// Применение темы
function applyMapTheme(theme, save = true) {
    const path = themePaths[theme];

    if (!path || !map) return;

    map.setStyle(path);

    if (save) {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch (error) {
            console.warn("Не удалось сохранить тему:", error);
        }
    }
}

// Восстановление темы при запуске
const savedTheme = getSavedTheme();

const savedRadio = document.querySelector(
    `input[name="sergek-theme"][value="${savedTheme}"]`
);

if (savedRadio) {
    savedRadio.checked = true;
}

// Применяем сохранённый стиль после создания карты
if (map.isStyleLoaded()) {
    applyMapTheme(savedTheme, false);
} else {
    map.once("load", () => {
        applyMapTheme(savedTheme, false);
    });
}

// Открытие панели
themeOpen?.addEventListener("click", () => {
    themeSheet?.classList.add("active");
    themeOverlay?.classList.add("active");
});

// Закрытие панели
function closeThemeSheet() {
    themeSheet?.classList.remove("active");
    themeOverlay?.classList.remove("active");
}

themeClose?.addEventListener("click", closeThemeSheet);
themeOverlay?.addEventListener("click", closeThemeSheet);

// Переключение стилей
document.querySelectorAll('input[name="sergek-theme"]').forEach(input => {
    input.addEventListener("change", () => {
        applyMapTheme(input.value);
    });
});
