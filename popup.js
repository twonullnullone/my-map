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

    Object.assign(el.style, {
      padding: "4px 8px",
      background: hexColors[3],
      borderRadius: "15px",
      border: "3px solid white",
      color: "#fff",
      fontSize: "10px",
      fontWeight: "bold",
      textAlign: "center",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      boxShadow: "0 0 6px rgba(0,0,0,0.3)"
    });

    // Получаем выделенные точки
    let selectedPoints =
      JSON.parse(localStorage.getItem("selectedPoints")) || [];

    const isSelected = selectedPoints.some(
      (s) =>
        Math.abs(Number(s.lat) - Number(p.lat)) < 0.00001 &&
        Math.abs(Number(s.lon) - Number(p.lon)) < 0.00001
    );

    if (isSelected) {
      el.style.background = "#9ACD32";
    }

    // HTML popup
    const popupHTML = `
      <div class="popup-container">

        <div class="popup-title">
          <b>${p.name}</b>
          <div>${p.description || ""}</div>
        </div>

        <div class="parent">

          <button class="popup-btn btn-2gis div1"
            data-action="info">2GIS</button>

          <button class="popup-btn btn-yandex div2"
            data-action="yandex">YANDEX</button>

          <button class="popup-btn btn-google div3"
            data-action="googlemaps">GOOGLE</button>

          <button class="popup-btn btn-delete div4"
            data-action="delete">DELETE</button>

          <button class="popup-btn btn-select div5"
            data-action="select">SELECT</button>

          <button class="popup-btn btn-share div6"
            data-action="share">SHARE</button>

          <button class="popup-btn btn-copy div7"
            data-action="copy">COPY</button>

        </div>
      </div>
    `;

    const popup = new maplibregl.Popup({
      offset: 25,
      closeButton: true,
      closeOnClick: true
    }).setHTML(popupHTML);

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([p.lon, p.lat])
      .setPopup(popup)
      .addTo(map);

    markers.push(marker);

    // Обработка кнопок
    popup.on("open", () => {
      const popupEl = popup.getElement();
      if (!popupEl) return;

      popupEl.querySelectorAll(".popup-btn").forEach((btn) => {

        btn.onclick = async (e) => {
          e.stopPropagation();

          const action = btn.dataset.action;

          // 2GIS
          if (action === "info") {
            window.location.href =
              `dgis://2gis.kz/geo/${p.lon},${p.lat}`;
          }

          // Google Maps
          if (action === "googlemaps") {
            const label = encodeURIComponent(p.name || "Точка");

            const url =
              `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`;

            window.location.href = url;
          }

          // Yandex
          if (action === "yandex") {
            const url =
              `yandexnavi://build_route_on_map?lat_to=${p.lat}&lon_to=${p.lon}`;

            window.location.href = url;
          }

          // SHARE
          if (action === "share") {
            const coords =
              `${Number(p.lat).toFixed(9)}, ${Number(p.lon).toFixed(8)}`;

            if (navigator.share) {
              try {
                await navigator.share({
                  title: "Координаты",
                  text: coords
                });
              } catch (error) {
                if (error.name !== "AbortError") {
                  showToast("Ошибка отправки");
                }
              }
            } else {
              await copyText(coords);
            }
          }

          // COPY
          if (action === "copy") {
            const coords =
              `${Number(p.lat).toFixed(9)}, ${Number(p.lon).toFixed(8)}`;

            await copyText(coords);
          }

          // DELETE
          if (action === "delete") {
            activePoints = activePoints.filter(
              (a) =>
                !(a.lat === p.lat && a.lon === p.lon)
            );

            selectedPoints = selectedPoints.filter(
              (s) =>
                !(s.lat === p.lat && s.lon === p.lon)
            );

            localStorage.setItem(
              "selectedPoints",
              JSON.stringify(selectedPoints)
            );

            saveActivePoints();
            popup.remove();

            renderMarkers();
            renderFilterList(allPoints);
          }

          // SELECT
          if (action === "select") {
            selectedPoints =
              JSON.parse(localStorage.getItem("selectedPoints")) || [];

            const index = selectedPoints.findIndex(
              (s) =>
                Math.abs(Number(s.lat) - Number(p.lat)) < 0.00001 &&
                Math.abs(Number(s.lon) - Number(p.lon)) < 0.00001
            );

            if (index === -1) {
              selectedPoints.push({
                lat: p.lat,
                lon: p.lon
              });

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

// Универсальное копирование
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Скопировано 📋");
  } catch {
    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);
    textarea.select();

    const success = document.execCommand("copy");
    textarea.remove();

    showToast(success ? "Скопировано 📋" : "Ошибка копирования");
  }
}


