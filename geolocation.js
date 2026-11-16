// ===================================
// APP.JS — КРУГЛЫЙ РАДАР + СЕКТОР
// MapLibre / Mapbox GL
// ===================================

let targetCoords = null;
let renderCoords = null;
let animationRunning = false;
let userMarker = null;          // ← обязательно объявить!
let userCoords = null;
let userHeading = 0;
let following = false;
let watchId = null;

const SMOOTH = 0.08;
const MIN_MOVE = 2;
const FOV_DEG = 80;
const DIST_METERS = 150;

const followBtn = document.getElementById("setLocationBtn");
const refreshBtn = document.getElementById("refreshLocationBtn");

// ===================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ===================================
function distanceMeters(a, b) {
  const R = 6371000;
  const dLat = (b[1] - a[1]) * Math.PI / 180;
  const dLon = (b[0] - a[0]) * Math.PI / 180;
  const lat1 = a[1] * Math.PI / 180;
  const lat2 = b[1] * Math.PI / 180;
  const x = dLon * Math.cos((lat1 + lat2) / 2);
  const y = dLat;
  return Math.sqrt(x * x + y * y) * R;
}

function buildConePolygon(center, bearingDeg, fovDeg, distanceMeters) {
  const [lon, lat] = center;
  const steps = 40;
  const R = 6378137;
  const bearingRad = bearingDeg * Math.PI / 180;
  const halfFovRad = (fovDeg / 2) * Math.PI / 180;
  const coords = [center];

  for (let i = -halfFovRad; i <= halfFovRad; i += (fovDeg * Math.PI / 180) / steps) {
    const angle = bearingRad + i;
    const dx = (distanceMeters * Math.sin(angle)) / (R * Math.cos(lat * Math.PI / 180));
    const dy = (distanceMeters * Math.cos(angle)) / R;
    coords.push([lon + (dx * 180) / Math.PI, lat + (dy * 180) / Math.PI]);
  }
  coords.push(center);
  return { type: "Polygon", coordinates: [coords] };
}

function buildCircle(center, radiusMeters, steps = 64) {
  const [lon, lat] = center;
  const R = 6378137;
  const coords = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const dx = (radiusMeters * Math.cos(angle)) / (R * Math.cos(lat * Math.PI / 180));
    const dy = (radiusMeters * Math.sin(angle)) / R;
    coords.push([lon + (dx * 180) / Math.PI, lat + (dy * 180) / Math.PI]);
  }
  return { type: "Polygon", coordinates: [coords] };
}

// ===================================
// СЛОИ
// ===================================
function initRadarLayer(map) {
  if (map.getSource("userRadar")) return;

  map.addSource("userRadar", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  map.addLayer({
    id: "userRadarCircle",
    type: "fill",
    source: "userRadar",
    filter: ["==", ["get", "shape"], "circle"],
    paint: {
      "fill-color": "rgba(0,200,83,0.15)",
      "fill-outline-color": "rgba(0,200,83,0.4)",
    },
  });

  map.addLayer({
    id: "userRadarSector",
    type: "fill",
    source: "userRadar",
    filter: ["==", ["get", "shape"], "sector"],
    paint: {
      "fill-color": "rgba(0,200,83,0.35)",
      "fill-outline-color": "rgba(0,200,83,0.8)",
    },
  });
}

// ===================================
// ОБНОВЛЕНИЕ РАДАРА
// ===================================
function updateRadar(map) {
  if (!map || !userCoords || !map.getSource("userRadar")) return;

  if (!following) {
    map.getSource("userRadar").setData({ type: "FeatureCollection", features: [] });
    return;
  }

  const center = renderCoords || userCoords;
  const circle = buildCircle(center, DIST_METERS);
  const sector = buildConePolygon(center, userHeading, FOV_DEG, DIST_METERS);

  map.getSource("userRadar").setData({
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { shape: "circle" }, geometry: circle },
      { type: "Feature", properties: { shape: "sector" }, geometry: sector },
    ],
  });

  // Не вызываем easeTo слишком часто — это сильно нагружает
  if (following) {
    map.easeTo({
      center: userCoords,
      bearing: userHeading,
      duration: 400,
      essential: true,
    });
  }
}

// ===================================
// АНИМАЦИЯ МАРКЕРА
// ===================================
function startMarkerAnimation(map) {
  if (animationRunning) return;
  animationRunning = true;

  function loop() {
    if (userMarker && renderCoords && targetCoords) {
      const dx = targetCoords[0] - renderCoords[0];
      const dy = targetCoords[1] - renderCoords[1];
      renderCoords[0] += dx * SMOOTH;
      renderCoords[1] += dy * SMOOTH;
      userMarker.setLngLat(renderCoords);
      updateRadar(map);
    }
    requestAnimationFrame(loop);
  }
  loop();
}

// ===================================
// ГЕОЛОКАЦИЯ
// ===================================
function startWatchingPosition(map) {
  if (!navigator.geolocation) {
    alert("Геолокация не поддерживается");
    return;
  }
  if (watchId) return;

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      userCoords = [pos.coords.longitude, pos.coords.latitude];

      if (!userMarker) {
        userMarker = new maplibregl.Marker({ color: "#00c853", scale: 1 })
          .setLngLat(userCoords)
          .addTo(map);
      }

      if (!renderCoords) {
        renderCoords = [...userCoords];
        targetCoords = [...userCoords];
        userMarker.setLngLat(renderCoords);
        startMarkerAnimation(map);
      } else if (distanceMeters(targetCoords, userCoords) >= MIN_MOVE) {
        targetCoords = [...userCoords];
      }
    },
    (err) => console.warn("Геолокация:", err),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
  );
}

// ===================================
// ОРИЕНТАЦИЯ
// ===================================
function initOrientation(map) {
  const handler = (e) => {
    let heading = null;
    if (e.webkitCompassHeading !== undefined) {
      heading = e.webkitCompassHeading;
    } else if (e.alpha !== null) {
      heading = 360 - e.alpha;
    }
    if (heading !== null) {
      userHeading = heading;
      updateRadar(map);
    }
  };

  if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
    DeviceOrientationEvent.requestPermission()
      .then((state) => {
        if (state === "granted") {
          window.addEventListener("deviceorientation", handler, true);
        }
      })
      .catch(console.error);
  } else {
    window.addEventListener("deviceorientationabsolute", handler, true);
    window.addEventListener("deviceorientation", handler, true);
  }
}

// ===================================
// КНОПКИ
// ===================================
if (followBtn) {
  followBtn.onclick = () => {
    following = !following;
    followBtn.style.backgroundColor = following ? "#41644A" : "transparent";
    followBtn.style.color = "#fff";
    if (following) initOrientation(window.map); // предполагаем, что map глобальный
    updateRadar(window.map);
  };
}

if (refreshBtn) {
  refreshBtn.onclick = () => {
    if (userCoords && window.map) {
      window.map.flyTo({ center: userCoords, zoom: 16, essential: true });
    }
  };
}

// ===================================
// ЗАПУСК
// ===================================
// Предполагается, что карта уже создана и доступна как window.map
// Пример:
// const map = new maplibregl.Map({ ... });
// window.map = map;

if (window.map) {
  window.map.on("load", () => {
    initRadarLayer(window.map);
    startWatchingPosition(window.map);
  });
} else {
  console.error("Карта (map) не найдена. Создай её до подключения этого скрипта.");
}