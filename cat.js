let categoryMarkers = [];

/***********************
 * CLEAR MARKERS
 ***********************/
function clearCategoryMarkers() {
  categoryMarkers.forEach(m => m.remove());
  categoryMarkers.length = 0;
}

/***********************
 * STYLE (one time)
 ***********************/
const markerStyle = {
  padding: "3px",
  background: "#757575",
  borderRadius: "4px",
  border: "2px solid black",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  fontSize: "8px",
  fontWeight: "bold",
  cursor: "pointer"
};

/***********************
 * CREATE MARKER
 ***********************/
function createCategoryMarker(p, activeSet) {
  const el = document.createElement("div");
  el.className = "marker";
  el.textContent = p.name;
  Object.assign(el.style, markerStyle);

  const popupHTML = `
    <div style="text-align:center;">
      <b>${p.name}</b><br>${p.description}<br><br>
      <button class="popup-btn-add"
        style="background:#000;color:#fff;border:none;
        border-radius:6px;padding:6px 10px;cursor:pointer;">
        Добавить
      </button>
    </div>
  `;

  const popup = new maplibregl.Popup({ offset: 20 }).setHTML(popupHTML);

  const marker = new maplibregl.Marker({ element: el })
    .setLngLat([p.lon, p.lat])
    .setPopup(popup)
    .addTo(map);

  categoryMarkers.push(marker);

  // 💡 обработчик popup БЕЗ setTimeout
  popup.on("open", () => {
    const btn = popup.getElement().querySelector(".popup-btn-add");
    if (!btn) return;

    btn.onclick = () => {
      activePoints.push(p);
      activeSet.add(`${p.lat},${p.lon}`);
      saveActivePoints();
      renderMarkers();
      marker.remove();
      showAlert(`Точка "${p.name}" добавлена`);
      /*alert(`Точка "${p.name}" добавлена ✅`);*/
    };
  });
}

/***********************
 * BATCH RENDER
 ***********************/
function renderBatch(points, activeSet, batchSize = 50) {
  let i = 0;

  function step() {
    for (let j = 0; j < batchSize && i < points.length; j++, i++) {
      createCategoryMarker(points[i], activeSet);
    }
    if (i < points.length) requestAnimationFrame(step);
  }

  step();
}

/***********************
 * MAIN FUNCTION
 ***********************/
function showCategoryPoints(prefix) {
  clearCategoryMarkers();

  const activeSet = new Set(
    activePoints.map(p => `${p.lat},${p.lon}`)
  );

  const filtered =
    prefix === "ALL"
      ? allPoints
      : allPoints.filter(p => p.name.startsWith(prefix));

  const inactivePoints = filtered.filter(
    p => !activeSet.has(`${p.lat},${p.lon}`)
  );

  if (!inactivePoints.length) {
    console.log(`Нет неактивных точек категории ${prefix}`);
    return;
  }

  renderBatch(inactivePoints, activeSet);
}

/***********************
 * UI EVENTS
 ***********************/
document.getElementById("glass-not")
  .addEventListener("change", clearCategoryMarkers);

document.getElementById("glass-p")
  .addEventListener("change", () => showCategoryPoints("P"));

document.getElementById("glass-lu")
  .addEventListener("change", () => showCategoryPoints("LU"));

document.getElementById("glass-ovn")
  .addEventListener("change", () => showCategoryPoints("OVN"));

document.getElementById("glass-all")
  .addEventListener("change", () => showCategoryPoints("ALL"));
