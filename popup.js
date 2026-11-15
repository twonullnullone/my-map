function showToast(msg) {
  const toast = document.createElement("div");
  toast.textContent = msg;

  Object.assign(toast.style, {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    background: "rgba(0, 0, 0, 0.8)",
    color: "#fff",
    padding: "12px 20px",
    borderRadius: "10px",
    fontSize: "16px",
    textAlign: "center",
    zIndex: "10",
    opacity: "0",
    transition: "opacity 0.3s ease",
    pointerEvents: "none",
    maxWidth: "80%",
  });

  document.body.appendChild(toast);

  // Плавное появление
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
  });

  // Исчезает через 1.5 секунды
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 1500);
}

function clearMarkers() {
    if (!markers) return;

    markers.forEach(m => {
        try {
            m.remove();
        } catch (e) {}
    });

    markers = [];
}

function renderMarkers() {
  markers.forEach((m) => m.remove());
  markers = [];

  activePoints.forEach((p) => {
    const el = document.createElement("div");
    el.className = "marker";
    el.textContent = p.name;

    // стили
    el.style.padding = "4px 8px";
    el.style.background = hexColors[3];
    el.style.borderRadius = "15px";
    el.style.border = "3px solid white";
    el.style.color = "#fff";
    el.style.fontSize = "10px";
    el.style.fontWeight = "bold";
    el.style.textAlign = "center";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.cursor = "pointer";
    el.style.boxShadow = "0 0 6px rgba(0,0,0,0.3)";

    // --- popup с кнопками ---
    const popupHTML = `
      <div style="text-align:center; min-width:150px;">
        <b>${p.name}</b><br>${p.description}<br><br>
        <div style="
          display:flex;
          justify-content:center;
          gap:6px;
          flex-wrap:wrap;">
          <button class="popup-btn" data-action="info" style="
            background:#B7E5CD; font-weight:900; color:#000; border:none; border-radius:6px;
            padding:6px 10px; width:80px; cursor:pointer;">2GIS</button>
      
     
            <button class="popup-btn" data-action="yandex" style="
  background:#F8B400; font-weight:900; color:#fff; border:none; border-radius:6px;
  padding:6px 10px; width:80px; cursor:pointer;">YANDEX</button>

        <button class="popup-btn" data-action="googlemaps" style="
  background:#fff; border-bottom: 5px solid #000; font-weight:900; color:#000; border:none; border-radius:6px;
  padding:6px 10px; width:80px; cursor:pointer;">Google</button>


                <button class="popup-btn" data-action="select" style="
            background:#000; font-weight:900; color:#fff; border:none; border-radius:6px;
            padding:6px 10px; width:80px; cursor:pointer;">SELECT</button>


          <button class="popup-btn" data-action="share" style="
            background:#0000FF; font-weight:900; color:#fff; border:none; border-radius:6px;
            padding:6px 10px; width:80px; cursor:pointer;">SHARE</button>

         <button class="popup-btn" data-action="delete" style="
            background:red; font-weight:900; color:#fff; border:none; border-radius:6px;
            padding:6px 10px; width:80px; cursor:pointer;">DELETE</button>

        </div>
      </div>
    `;

    // === создаём popup и marker ===
    const popup = new maplibregl.Popup({ offset: 25 }).setHTML(popupHTML);

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([p.lon, p.lat])
      .setPopup(popup)
      .addTo(map);

    markers.push(marker);

    // === Восстановление цвета из localStorage ===
    let selectedPoints =
      JSON.parse(localStorage.getItem("selectedPoints")) || [];

const isSelected = selectedPoints.some(
  (s) =>
    Math.abs(Number(s.lat) - Number(p.lat)) < 0.00001 &&
    Math.abs(Number(s.lon) - Number(p.lon)) < 0.00001
);

    if (isSelected) {
      el.style.background = "#9ACD32";
      el.style.border = "3px solid #fff";
    }

    // === обработка popup кнопок ===
    // === обработка popup кнопок (исправленный вариант) ===
    popup.on("open", () => {
      const popupEl = popup
        .getElement()
        .querySelector(".maplibregl-popup-content");
      if (!popupEl) return;

      popupEl.querySelectorAll(".popup-btn").forEach((btn) => {
        btn.onclick = (e) => {
          const action = e.target.dataset.action;

          // --- INFO → 2GIS
          if (action === "info") {
            const url = `dgis://2gis.kz/geo/${p.lon},${p.lat}`;
            window.location.href = url;
          }

          if (action === "googlemaps") {
  const label = encodeURIComponent(p.name || "Точка");

            const url =
              `intent://maps.google.com/maps?q=${p.lat},${p.lon}(${label})` +
              `#Intent;scheme=https;package=com.google.android.apps.maps;end`;

            window.location.href = url;
}

          if (action === "yandex") {
            const latlon = `${p.lat},${p.lon}`;

            // iOS Яндекс.Навигатор
            const iosURL = `yandexnavi://build_route_on_map?lat_to=${p.lat}&lon_to=${p.lon}`;

            // Android Яндекс.Навигатор
            const androidURL = `yandexnavi://build_route_on_map?lat_to=${p.lat}&lon_to=${p.lon}`;

            // fallback (если приложение нет) — откроет в браузере Яндекс.Карты
            /*    const fallback = `https://yandex.kz/maps/?ll=${p.lon}%2C${p.lat}&z=16&pt=${p.lon},${p.lat}`;*/

            // Попытка открыть приложение
            window.location.href = iosURL;

            // fallback через 1 сек
            /*   setTimeout(() => {
                    window.location.href = fallback;
                  }, 1000);*/
          }

          // --- COPY

          // --- SHARE только координаты ---
          if (action === "share") {
            const coords = `${p.lat.toFixed(9)}, ${p.lon.toFixed(8)}`;

            if (navigator.share) {
              navigator
                .share({
                  title: "Координаты",
                  text: coords,
                })
                .then(() => showToast("Поделились 📤"))
                .catch(() => showToast("Отменено 🙃"));
            } else {
              // fallback — просто копирование
              try {
                navigator.clipboard.writeText(coords);
                showToast("Координаты скопированы 📋");
              } catch {
                const temp = document.createElement("textarea");
                temp.value = coords;
                document.body.appendChild(temp);
                temp.select();
                document.execCommand("copy");
                temp.remove();
                showToast("Скопировано (fallback) 📋");
              }
            }
          }

          // --- DELETE
          // --- DELETE
          if (action === "delete") {
            // 1) удаляем точку из activePoints
            activePoints = activePoints.filter(
              (a) => !(a.lat === p.lat && a.lon === p.lon),
            );

            // 2) удаляем выделение из selectedPoints
            selectedPoints = selectedPoints.filter(
              (s) => !(s.lat === p.lat && s.lon === p.lon),
            );
            localStorage.setItem(
              "selectedPoints",
              JSON.stringify(selectedPoints),
            );

            // 3) сохраняем и перерисовываем
            saveActivePoints();
            renderMarkers();
            renderFilterList(allPoints);

            // 4) закрываем popup
            popup.remove();
          }

          // --- SELECT
      if (action === "select") {

  // 🔥 ВСЕГДА берём свежие данные
  selectedPoints =
    JSON.parse(localStorage.getItem("selectedPoints")) || [];

  const index = selectedPoints.findIndex(
    (s) =>
      Math.abs(Number(s.lat) - Number(p.lat)) < 0.00001 &&
      Math.abs(Number(s.lon) - Number(p.lon)) < 0.00001
  );

  if (index === -1) {
    selectedPoints.push({ lat: p.lat, lon: p.lon });
    el.style.background = "#9ACD32";
  } else {
    selectedPoints.splice(index, 1);
    el.style.background = hexColors[3];
  }

  localStorage.setItem(
    "selectedPoints",
    JSON.stringify(selectedPoints)
  );
}
        };
      });
    });
  });
}
