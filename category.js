let categoryMarkers = [];

function clearCategoryMarkers() {
  categoryMarkers.forEach((m) => m.remove());
  categoryMarkers = [];
}

// 🔹 Функция отображения точек по категории (исключая активные)
function showCategoryPoints(prefix) {
  clearCategoryMarkers();

  const filtered =
    prefix === "ALL"
      ? allPoints
      : allPoints.filter((p) => p.name.startsWith(prefix));

  // исключаем уже добавленные точки
  const inactivePoints = filtered.filter(
    (p) => !activePoints.some((a) => a.lat === p.lat && a.lon === p.lon),
  );

  if (inactivePoints.length === 0) {
    console.log(`Нет неактивных точек категории ${prefix}`);
    return;
  }

  inactivePoints.forEach((p) => {
    const el = document.createElement("div");
    el.className = "marker";
    el.textContent = p.name;
    /* el.style.width = "37px";
          el.style.height = "34px";*/
    el.style.padding = "3px";
    el.style.background = "#757575"; // 🔴 красный
    el.style.borderRadius = "4px";
    el.style.border = "2px solid black";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.color = "#fff";
    el.style.fontSize = "8px";
    el.style.fontWeight = "bold";
    //el.style.boxShadow = "0 0 6px rgba(0,0,0,0.4)";
    el.style.cursor = "pointer";

    // popup для добавления точки
    const popupHTML = `
      <div style="text-align:center;">
        <b>${p.name}</b><br>${p.description}<br><br>
        <button class="popup-btn-add" style="
          background:#000; color:#fff; border:none; border-radius:6px;
          padding:6px 10px; cursor:pointer;">Добавить</button>
      </div>
    `;

    const popup = new maplibregl.Popup({ offset: 20 }).setHTML(popupHTML);

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([p.lon, p.lat])
      .setPopup(popup)
      .addTo(map);

    categoryMarkers.push(marker);

    // обработчик кнопки "Добавить"
    el.addEventListener("click", () => {
      setTimeout(() => {
        const btn = document.querySelector(".popup-btn-add");
        if (btn) {
          btn.onclick = () => {
            activePoints.push(p);
            saveActivePoints();
            renderMarkers();
            marker.remove();
            alert(`Точка "${p.name}" добавлена ✅`);
          };
        }
      }, 100);
    });
  });
}

// 🔘 обработчики переключателей
document
  .getElementById("glass-not")
  .addEventListener("change", clearCategoryMarkers);
document
  .getElementById("glass-p")
  .addEventListener("change", () => showCategoryPoints("P"));
document
  .getElementById("glass-lu")
  .addEventListener("change", () => showCategoryPoints("LU"));
document
  .getElementById("glass-ovn")
  .addEventListener("change", () => showCategoryPoints("OVN"));
document
  .getElementById("glass-all")
  .addEventListener("change", () => showCategoryPoints("ALL"));
