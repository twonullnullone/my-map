// === ПЕРЕМЕННЫЕ ===
let currentRoutePoints = [];
window.routeMarkers = [];
let routeAutoUpdate = false;

// === СОХРАНЕНИЕ ===
function saveActivePoints() {
  localStorage.setItem("activePoints", JSON.stringify(activePoints));
}

// === ОТКРЫТИЕ МОДАЛКИ ===
document.getElementById("routeBtn").onclick = () => {
  renderRouteList(activePoints);
  openModal("routeModal");
};

// === РЕНДЕР СПИСКА ===
function renderRouteList(points) {
  const list = document.getElementById("routeList");
  list.innerHTML = "";

  points.forEach((p, i) => {
    const item = document.createElement("div");
    item.className = "route-item";
    item.draggable = true;

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = JSON.stringify(p);
    cb.checked = true;

    const lbl = document.createElement("label");
    lbl.innerText = `${i + 1}. ${p.name || "Без названия"} — ${p.description || ""}`;
    lbl.style.marginLeft = "8px";

    const dist = document.createElement("span");
    dist.className = "distance-label";
    dist.style.marginLeft = "8px";
    dist.style.fontSize = "13px";
    dist.style.color = "#666";

    item.append(cb, lbl, dist);
    list.appendChild(item);
  });

  enableDragAndDrop(list);
}

// === DRAG & DROP ===
function enableDragAndDrop(list) {
  let dragEl = null;

  function saveNewOrder() {
    const newOrder = Array.from(list.querySelectorAll(".route-item")).map(
      (el) => {
        return JSON.parse(el.querySelector("input").value);
      },
    );

    activePoints = newOrder;
    saveActivePoints();

    if (routeAutoUpdate && currentRoutePoints.length > 0) {
      currentRoutePoints = [...activePoints];
      buildRoute(currentRoutePoints, false);
    }
  }

  list.querySelectorAll(".route-item").forEach((item) => {
    item.addEventListener("dragstart", () => {
      dragEl = item;
      item.classList.add("dragging");
    });

    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      saveNewOrder();
    });

    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      const after = getDragAfterElement(list, e.clientY);
      if (!after) list.appendChild(dragEl);
      else list.insertBefore(dragEl, after);
    });
  });
}

function getDragAfterElement(container, y) {
  const els = [...container.querySelectorAll(".route-item:not(.dragging)")];
  return els.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset)
        return { offset, element: child };
      return closest;
    },
    { offset: -Infinity },
  ).element;
}

// === ПОСТРОИТЬ МАРШРУТ ===
document.getElementById("buildRouteBtn").onclick = () => {
  if (!userCoords) return alert("Ожидаем ваше местоположение…");

  const checked = Array.from(
    document.querySelectorAll("#routeList input:checked"),
  );
  if (checked.length < 1) return alert("Выберите хотя бы одну точку");

  currentRoutePoints = checked.map((c) => JSON.parse(c.value));
  routeAutoUpdate = true;

  buildRoute(currentRoutePoints);
  closeModal("routeModal");
};

// === ЗАВЕРШИТЬ МАРШРУТ ===
document.getElementById("endRouteBtn").onclick = () => {
  routeAutoUpdate = false;

  if (map.getSource("route")) {
    map.removeLayer("routeLine");
    map.removeSource("route");
  }

  window.routeMarkers.forEach((m) => m.remove());
  window.routeMarkers = [];

  currentRoutePoints = [];

  closeModal("routeModal");
  alert("🚗 Маршрут завершён");
};

// === ПОСТРОЕНИЕ МАРШРУТА ===
function buildRoute(sel, center = true) {
  if (!userCoords) return;

  const coords = [
    [userCoords[0], userCoords[1]],
    ...sel.map((p) => [p.lon, p.lat]),
  ];

  const coordsStr = coords.map((c) => c.join(",")).join(";");

  fetch(
    `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&steps=true&geometries=geojson`,
  )
    .then((r) => r.json())
    .then((json) => {
      if (!json.routes?.length) return;

      const route = json.routes[0];
      const routeGeo = route.geometry;
      const legs = route.legs;
      const totalDistanceKm = (route.distance / 1000).toFixed(1);

      // --- ЛИНИЯ ---
      if (map.getSource("route")) {
        map.getSource("route").setData({ type: "Feature", geometry: routeGeo });
      } else {
        map.addSource("route", {
          type: "geojson",
          data: { type: "Feature", geometry: routeGeo },
        });

        const labelLayerId = map
          .getStyle()
          .layers.find((l) => l.type === "symbol" && l.layout["text-field"]).id;

        map.addLayer(
          {
            id: "routeLine",
            type: "line",
            source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": hexColors[9],
              "line-width": 5,
              "line-opacity": 0.7,
            },
          },
          labelLayerId,
        );
      }

      // --- МАРКЕРЫ ---
      window.routeMarkers.forEach((m) => m.remove());
      window.routeMarkers = [];

      sel.forEach((p, i) => {
        const el = document.createElement("div");
        el.style.cssText = `
          width:34px;height:34px;
          background:${hexColors[9]};
          border-radius:50%;
          border:3px solid white;
          display:flex;align-items:center;justify-content:center;
          color:white;font-weight:bold;
          box-shadow:0 4px 8px rgba(0,0,0,0.3);
          position:absolute;top:-25px;
        `;
        el.innerText = i + 1;

        const marker = new maplibregl.Marker({
          element: el,
          anchor: "bottom",
        })
          .setLngLat([p.lon, p.lat])
          .addTo(map);

        window.routeMarkers.push(marker);
      });

      // --- РАССТОЯНИЯ ---
      const listItems = document.querySelectorAll("#routeList .route-item");
      legs.forEach((leg, i) => {
        const distKm = (leg.distance / 1000).toFixed(1);
        const label = listItems[i]?.querySelector(".distance-label");
        if (label) label.innerText = `(${distKm} км)`;
      });

      // --- ОБЩАЯ ДЛИНА ---
      let totalEl = document.getElementById("totalDistance");
      if (!totalEl) {
        totalEl = document.createElement("div");
        totalEl.id = "totalDistance";
        totalEl.style.marginTop = "8px";
        totalEl.style.fontWeight = "bold";
        document.getElementById("routeList").appendChild(totalEl);
      }
      totalEl.innerText = `🚗 Общая длина маршрута: ${totalDistanceKm} км`;

      // --- ЦЕНТРОВКА ---
      if (center) {
        const bounds = new maplibregl.LngLatBounds();
        coords.forEach((c) => bounds.extend(c));
        map.fitBounds(bounds, { padding: 50 });
      }
    })
    .catch((err) => console.error("Ошибка маршрута:", err));
}
