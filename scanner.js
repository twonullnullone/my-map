
// === Слой рамки ===
function ensureBoxLayer() {
  if (map.getSource("frame-geo")) return;
  map.addSource("frame-geo", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addLayer({
    id: "frame-line",
    type: "line",
    source: "frame-geo",
    paint: {
      "line-color": "#00796B",
      "line-width": 3,
      "line-dasharray": [4, 2],
    },
  });
}

// === Квадратная рамка ===
function getSquareFrame(padding = 100) {
  const mapW = map.getContainer().clientWidth;
  const mapH = map.getContainer().clientHeight;
  const side = Math.min(mapW - padding * 2, mapH - padding * 2);
  const cx = mapW / 2;
  const cy = mapH / 2;
  const half = side / 2;

  const sx1 = cx - half;
  const sy1 = cy - half;
  const sx2 = cx + half;
  const sy2 = cy + half;

  const nw = map.unproject([sx1, sy1]);
  const ne = map.unproject([sx2, sy1]);
  const se = map.unproject([sx2, sy2]);
  const sw = map.unproject([sx1, sy2]);

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [nw.lng, nw.lat],
              [ne.lng, ne.lat],
              [se.lng, se.lat],
              [sw.lng, sw.lat],
              [nw.lng, nw.lat],
            ],
          ],
        },
      },
    ],
  };
}

map.on("load", () => {
  ensureBoxLayer();

  let pts = window.points || [];
  let activeMarkers = [];
  let visiblePoints = [];
  let mode = 0;

  // === Модальное окно ===
  const modalOverlay = document.createElement("div");
  Object.assign(modalOverlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    background: "rgba(0,0,0,0.55)",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "3000",
    backdropFilter: "blur(5px)",
  });

  const modalBox = document.createElement("div");
  Object.assign(modalBox.style, {
    background: "rgba(35,35,35,0.97)",
    color: "#fff",
    borderRadius: "16px",
    boxShadow: "0 0 25px rgba(0,0,0,0.6)",
    width: "360px",
    maxHeight: "75vh",
    display: "flex",
    flexDirection: "column",
    position: "relative",
  });

  const header = document.createElement("div");
  Object.assign(header.style, {
    fontSize: "16px",
    fontWeight: "bold",
    padding: "16px 20px 10px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  });

  const listContainer = document.createElement("div");
  Object.assign(listContainer.style, {
    flex: "1",
    overflowY: "auto",
    padding: "10px 20px 70px 20px",
  });

  const footer = document.createElement("div");
  Object.assign(footer.style, {
    position: "absolute",
    bottom: "0",
    left: "0",
    width: "100%",
    background: "rgba(25,25,25,0.95)",
    borderTop: "1px solid rgba(255,255,255,0.1)",
    padding: "10px 0px",
    borderRadius: "0 0 15px 15px",
    display: "flex",
    justifyContent: "center",
  });

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Закрыть";
  Object.assign(closeBtn.style, {
    background: "#00ff7b",
    color: "#000",
    border: "none",
    borderRadius: "8px",
    padding: "8px 20px",
    fontSize: "14px",
    cursor: "pointer",
    fontWeight: "600",
  });
  footer.appendChild(closeBtn);

  const closeIcon = document.createElement("div");
  closeIcon.innerHTML = "✖";
  Object.assign(closeIcon.style, {
    position: "absolute",
    top: "10px",
    right: "16px",
    cursor: "pointer",
    fontSize: "18px",
    color: "#bbb",
  });

  modalBox.appendChild(closeIcon);
  modalBox.appendChild(header);
  modalBox.appendChild(listContainer);
  modalBox.appendChild(footer);
  modalOverlay.appendChild(modalBox);
  document.body.appendChild(modalOverlay);

  // === Маркеры ===
function renderMarker(visible) {
  activeMarkers.forEach((m) => m.remove());
  activeMarkers = [];

  visible.forEach((p, i) => {
    const markerEl = document.createElement("div");
    Object.assign(markerEl.style, {
      padding: "5px",
      background: "#3b3b3b",
      borderRadius: "10px",
      border: "3px solid white",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      color: "white",
      fontSize: "10px",
      textAlign: "center",
      lineHeight: "1.1",
      fontWeight: "bold",
      boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
      cursor: "pointer",
    });

    markerEl.innerHTML = `
      <div style="font-size:13px;">${i + 1}</div>
      <div style="font-size:10px;">${p.name}</div>
    `;

    // ✅ POPUP
    const popup = new maplibregl.Popup({ offset: 20 }).setHTML(`
      <div style="text-align:center;">
        <b>${p.name}</b><br><br>
        <button id="add-point-btn" style="
          background:#00ff7b;
          border:none;
          border-radius:8px;
          padding:6px 14px;
          cursor:pointer;
          font-weight:bold;">
          Добавить
        </button>
      </div>
    `);

    const marker = new maplibregl.Marker({
      element: markerEl,
      anchor: "bottom",
    })
      .setLngLat([p.lon, p.lat])
      .setPopup(popup)
      .addTo(map);

    // ✅ КНОПКА "Добавить"
    popup.on("open", () => {
      const btn = popup
        .getElement()
        .querySelector("#add-point-btn");

      btn.onclick = () => {
        activePoints.push(p);
        saveActivePoints();
        renderMarkers();
        marker.remove();
        popup.remove();

        visiblePoints = visiblePoints.filter(
          (x) => x.lat !== p.lat || x.lon !== p.lon
        );
        
        alert(`Точка "${p.name}" добавлена ✅`);
      };
    });

    activeMarkers.push(marker);
  });
}

  // === Сканирование ===
function scanPointsInSquare() {
  const padding = 100;
  const mapW = map.getContainer().clientWidth;
  const mapH = map.getContainer().clientHeight;
  const side = Math.min(mapW - padding * 2, mapH - padding * 2);
  const cx = mapW / 2;
  const cy = mapH / 2;
  const half = side / 2;

  const sx1 = cx - half;
  const sy1 = cy - half;
  const sx2 = cx + half;
  const sy2 = cy + half;

  // Добавь эту строку
  ensureBoxLayer();

  // обновляем рамку
  map.getSource("frame-geo").setData(getSquareFrame(padding));

  // остальной код без изменений
  visiblePoints = pts.filter((p) => {
    const isActive = activePoints.some(
      (a) => a.lat === p.lat && a.lon === p.lon
    );
    if (isActive) return false;

    const px = map.project([p.lon, p.lat]);
    return px.x >= sx1 && px.x <= sx2 && px.y >= sy1 && px.y <= sy2;
  });

  renderMarker(visiblePoints);
}


  // === Кнопка сканирования ===
  const scanBtn = document.getElementById("scanPoitns");
  scanBtn.addEventListener("click", () => {
    mode = (mode + 1) % 3;

    if (mode === 1) {
      scanBtn.style.backgroundColor = "#00ff7b";
      map.on("moveend", scanPointsInSquare);
      scanPointsInSquare();
    } else if (mode === 2) {
      scanBtn.style.backgroundColor = "#00796B";
      map.off("moveend", scanPointsInSquare);
    } else {
      scanBtn.style.backgroundColor = "transparent";
      map.off("moveend", scanPointsInSquare);
      map.getSource("frame-geo").setData({
        type: "FeatureCollection",
        features: [],
      });
      activeMarkers.forEach((m) => m.remove());
      activeMarkers = [];
      visiblePoints = [];
    }
  });

  // === Кнопка списка ===
  const listBtn = document.querySelector(".ibutton");
  listBtn.addEventListener("click", () => {
    if (modalOverlay.style.display === "flex") {
      modalOverlay.style.display = "none";
      return;
    }

    header.textContent = `Обнаружены объекты: ${visiblePoints.length}`;
    listContainer.innerHTML =
      visiblePoints.length === 0
        ? `<div style="color:#aaa;">Ничего не было найдено</div>`
        : visiblePoints
         .map(
  (p, i) => `
    <div style="
      margin-bottom:10px;
      padding-bottom:10px;
      display:flex;
      align-items:center;
      gap:8px;
      border-bottom:1px solid rgba(255,255,255,0.15);
    ">
      <div style="
        padding:6px 10px;
        background:#00796B;
        color:white;
        border-radius:5%;
        font-size:12px;
        font-weight:bold;
      ">
        ${i + 1}
      </div>

      <div>${p.name}</div>
    </div>`,
)
            .join("");

    modalOverlay.style.display = "flex";
  });

  closeBtn.onclick = closeIcon.onclick = () => {
    modalOverlay.style.display = "none";
  };
});
