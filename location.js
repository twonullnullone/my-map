function refreshLocation() {
  if (!navigator.geolocation) {
    alert("Geolocation not supported");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const coords = [pos.coords.longitude, pos.coords.latitude];
      setUserLocation(coords);
      map.flyTo({ center: coords, zoom: 14 });
    },
    (err) => alert(err.message),
  );
}

// === Определяем геолокацию один раз ===
function initUserLocation() {
  if (!("geolocation" in navigator)) {
    console.warn("❌ Геолокация не поддерживается браузером.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const coords = [position.coords.longitude, position.coords.latitude];
      console.log();
      setUserLocation(coords);
      map.flyTo({ center: coords, zoom: 14 });
    },
    (error) => {
      console.warn("⚠ Ошибка при получении геолокации:", error.message);
      // ничего не делаем, просто не показываем маркер
    },
    {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    },
  );
}

// === Устанавливаем маркер пользователя ===
function setUserLocation(coords) {
  if (userMarker) userMarker.remove();

  userMarker = new maplibregl.Marker({ color: hexColors[4] })
    .setLngLat(coords)
    .setPopup(new maplibregl.Popup().setText("This is me"))
    .addTo(map);
}

// === Запускаем один раз ===
initUserLocation();

document.getElementById("refreshLocationBtn").onclick = refreshLocation;
