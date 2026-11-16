// ===================================
// APP.JS — КРУГЛЫЙ РАДАР + СЕКТОР
// MapLibre / Mapbox GL
// ===================================
let targetCoords = null;
let renderCoords = null;
let animationRunning = false;

const SMOOTH = 0.08;      // плавность (0.05–0.15)
const MIN_MOVE = 2;       // игнорировать меньше 2 метров

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



let following = false;
let userMarker = null;
let userCoords = null;
let prevCoords = null;
let userHeading = 0;
let watchId = null;

const FOV_DEG = 80;        // угол сектора
const DIST_METERS = 150;  // радиус круга

const followBtn = document.getElementById("setLocationBtn");
const refreshBtn = document.getElementById("refreshLocationBtn");

// ===================================
// ПОСТРОЕНИЕ СЕКТОРА
// ===================================
function buildConePolygon(center, bearingDeg, fovDeg, distanceMeters) {
  const [lon, lat] = center;
  const steps = 40;
  const R = 6378137;

  const bearingRad = bearingDeg * Math.PI / 180;
  const halfFovRad = (fovDeg / 2) * Math.PI / 180;

  const coords = [center];

  for (
    let i = -halfFovRad;
    i <= halfFovRad;
    i += (fovDeg * Math.PI / 180) / steps
  ) {
    const angle = bearingRad + i;
    const dx =
      (distanceMeters * Math.sin(angle)) /
      (R * Math.cos(lat * Math.PI / 180));
    const dy = (distanceMeters * Math.cos(angle)) / R;

    coords.push([
      lon + (dx * 180) / Math.PI,
      lat + (dy * 180) / Math.PI,
    ]);
  }

  coords.push(center);

  return {
    type: "Polygon",
    coordinates: [coords],
  };
}

// ===================================
// ПОСТРОЕНИЕ КРУГА
// ===================================
function buildCircle(center, radiusMeters, steps = 64) {
  const [lon, lat] = center;
  const R = 6378137;
  const coords = [];

  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const dx =
      (radiusMeters * Math.cos(angle)) /
      (R * Math.cos(lat * Math.PI / 180));
    const dy = (radiusMeters * Math.sin(angle)) / R;

    coords.push([
      lon + (dx * 180) / Math.PI,
      lat + (dy * 180) / Math.PI,
    ]);
  }

  return {
    type: "Polygon",
    coordinates: [coords],
  };
}

// ===================================
// ИНИЦИАЛИЗАЦИЯ СЛОЁВ
// ===================================

function initRadarLayer(map) {
    if (!map.isStyleLoaded()) return;

    if (!map.getSource("userRadar")) {
        map.addSource("userRadar", {
            type: "geojson",
            data: {
                type: "FeatureCollection",
                features: []
            }
        });
    }

    if (!map.getLayer("userRadarCircle")) {
        map.addLayer({
            id: "userRadarCircle",
            type: "fill",
            source: "userRadar",
            filter: ["==", ["get", "shape"], "circle"],
            paint: {
                "fill-color": "rgba(0,200,83,0.15)",
                "fill-outline-color": "rgba(0,200,83,0.4)"
            }
        });
    }

    if (!map.getLayer("userRadarSector")) {
        map.addLayer({
            id: "userRadarSector",
            type: "fill",
            source: "userRadar",
            filter: ["==", ["get", "shape"], "sector"],
            paint: {
                "fill-color": "rgba(0,200,83,0.35)",
                "fill-outline-color": "rgba(0,200,83,0.8)"
            }
        });
    }

    updateRadar(map);
}


// ===================================
// ОБНОВЛЕНИЕ РАДАРА
// ===================================

function updateRadar(map) {
    if (!userCoords || !map.getSource("userRadar")) return;

    const source = map.getSource("userRadar");

    if (!following) {
        source.setData({
            type: "FeatureCollection",
            features: []
        });
        return;
    }

    const center = renderCoords || userCoords;

    source.setData({
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                properties: { shape: "circle" },
                geometry: buildCircle(center, DIST_METERS)
            },
            {
                type: "Feature",
                properties: { shape: "sector" },
                geometry: buildConePolygon(
                    center,
                    userHeading,
                    FOV_DEG,
                    DIST_METERS
                )
            }
        ]
    });
}




// ===================================
// ПЛАВНОЕ ДВИЖЕНИЕ МАРКЕРА
// ===================================

// ===================================
// ГЕОЛОКАЦИЯ
// ===================================
function startWatchingPosition(map) {
  if (!navigator.geolocation) {
    alert("Geolocation not supported");
    return;
  }

  if (watchId) return;

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      userCoords = [
        pos.coords.longitude,
        pos.coords.latitude,
      ];
      window.userCoords = userCoords;

      if (!userMarker) {
        userMarker = new maplibregl.Marker({
          color: hexColors[4],
          scale: 1,
        })
          .setLngLat(userCoords)
          .addTo(map);
          userMarker.getElement().style.position = "absolute";
           // userMarker.getElement().style.zIndex = "1";
      }

      if (!renderCoords) {
    renderCoords = [...userCoords];
    targetCoords = [...userCoords];
    userMarker.setLngLat(renderCoords);
    startMarkerAnimation();
} else {

    if (distanceMeters(targetCoords, userCoords) >= MIN_MOVE) {
        targetCoords = [...userCoords];
    }

}
    
    },
    (err) => console.warn("⚠ Геолокация:", err),
    { enableHighAccuracy: true }
  );
}

// ===================================
// ОРИЕНТАЦИЯ УСТРОЙСТВА
// ===================================

let orientationStarted = false;

async function initOrientation(map) {
    if (orientationStarted) return;

    if (typeof DeviceOrientationEvent === "undefined") {
        console.warn("Компас не поддерживается");
        return;
    }

    try {
        if (
            typeof DeviceOrientationEvent.requestPermission === "function"
        ) {
            const permission =
                await DeviceOrientationEvent.requestPermission(true);

            if (permission !== "granted") {
                console.warn("Нет разрешения на компас");
                return;
            }
        }

        function handler(e) {
            let heading = null;

            if (typeof e.webkitCompassHeading === "number") {
                heading = e.webkitCompassHeading;
            } else if (
                e.absolute === true &&
                typeof e.alpha === "number"
            ) {
                heading = 360 - e.alpha;
            }

            if (heading === null) return;

            userHeading = (heading + 360) % 360;
            updateRadar(map);
        }

        window.addEventListener("deviceorientation", handler, true);
        window.addEventListener("deviceorientationabsolute", handler, true);

        orientationStarted = true;

        console.log("Компас запущен");

    } catch (error) {
        console.error("Ошибка компаса:", error);
    }
}


// ===================================
// КНОПКИ
// ===================================
if (followBtn) {
  followBtn.onclick = () => {
    following = !following;
    followBtn.style.backgroundColor = following
      ? "#41644A"
      : "transparent";
    followBtn.style.color = "#fff";

    if (following) initOrientation(map);
    updateRadar(map);
  };
}

if (refreshBtn) {
  refreshBtn.onclick = () => {
    if (!userCoords) return;
    map.flyTo({
      center: userCoords,
      zoom: 14,
      essential: true,
    });
  };
}

// ===================================
// ЗАПУСК
// ===================================

map.on("style.load", () => {
    initRadarLayer(map);
});
