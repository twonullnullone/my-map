let following = false;
//userMarker = null;
//let userCoords = null;
//let prevCoords = null;
let userHeading = 0;
let watchId = null;

const FOV_DEG = 80; // угол обзора луча
const DIST_METERS = 150; // длина луча
const followBtn = document.getElementById("setLocationBtn");

// === ПОСТРОЕНИЕ "КОНУСА НАПРАВЛЕНИЯ" ===
function buildConePolygon(center, bearingDeg, fovDeg, distanceMeters) {
  const [lon, lat] = center;
  const numSteps = 40;
  const R = 6378137;

  const bearingRad = (bearingDeg * Math.PI) / 180;
  const halfFovRad = (fovDeg / 2) * (Math.PI / 180);

  const coords = [];
  coords.push(center);

  for (
    let i = -halfFovRad;
    i <= halfFovRad;
    i += (fovDeg * Math.PI) / 180 / numSteps
  ) {
    const angle = bearingRad + i;
    const dx =
      (distanceMeters * Math.sin(angle)) /
      (R * Math.cos((lat * Math.PI) / 180));
    const dy = (distanceMeters * Math.cos(angle)) / R;
    const newLon = lon + (dx * 180) / Math.PI;
    const newLat = lat + (dy * 180) / Math.PI;
    coords.push([newLon, newLat]);
  }

  coords.push(center);
  return { type: "Polygon", coordinates: [coords] };
}

// === ИНИЦИАЛИЗАЦИЯ СЛОЯ ЛУЧА ===
function initDirectionLayer(map) {
  if (!map.getSource("userDirection")) {
    map.addSource("userDirection", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "userDirection",
      type: "fill",
      source: "userDirection",
      paint: {
        "fill-color": "rgba(0, 200, 83, 0.35)",
        "fill-outline-color": "rgba(0, 200, 83, 0.8)",
      },
    });
  }
}

// === ОБНОВЛЕНИЕ НАПРАВЛЕНИЯ ===
function updateDirection(map) {
  if (!userCoords) return;

  if (following) {
    const cone = buildConePolygon(
      userCoords,
      userHeading,
      FOV_DEG,
      DIST_METERS,
    );
    const feature = { type: "Feature", geometry: cone };
    map.getSource("userDirection").setData({
      type: "FeatureCollection",
      features: [feature],
    });

    map.easeTo({
      center: userCoords,
      bearing: userHeading,
      duration: 500,
      essential: true,
    });
  } else {
    // если следование выключено — очищаем луч
    map.getSource("userDirection").setData({
      type: "FeatureCollection",
      features: [],
    });
  }
}

// === ПЛАВНОЕ ДВИЖЕНИЕ МАРКЕРА ===
function animateMarkerTo(newCoords) {
  if (!prevCoords) {
    prevCoords = newCoords;
    if (userMarker) userMarker.setLngLat(newCoords);
    return;
  }

  const [lon1, lat1] = prevCoords;
  const [lon2, lat2] = newCoords;
  const steps = 30;
  let step = 0;

  const animate = () => {
    if (step >= steps) {
      prevCoords = newCoords;
      return;
    }

    const lon = lon1 + ((lon2 - lon1) * step) / steps;
    const lat = lat1 + ((lat2 - lat1) * step) / steps;

    if (userMarker) userMarker.setLngLat([lon, lat]);
    step++;
    requestAnimationFrame(animate);
  };

  animate();
}

// === ГЕОЛОКАЦИЯ (ВСЕГДА АКТИВНА) ===
function startWatchingPosition(map) {
  if (!("geolocation" in navigator)) {
    alert("Геолокация не поддерживается вашим устройством.");
    return;
  }

  if (!watchId) {
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newCoords = [pos.coords.longitude, pos.coords.latitude];
        userCoords = newCoords;

        if (!userMarker) {
          userMarker = new mapboxgl.Marker({
            color: "#00c853",
            scale: 1.6, // увеличен для видимости
          })
            .setLngLat(newCoords)
            .addTo(map);
        }

        animateMarkerTo(newCoords);
        updateDirection(map);
      },
      (err) => {
        console.warn("⚠ Ошибка геолокации:", err);
        if (err.code === 1)
          alert("Разрешите доступ к геолокации в настройках Safari!");
      },
      { enableHighAccuracy: true },
    );
  }
}

// === ОРИЕНТАЦИЯ УСТРОЙСТВА ===
function initOrientation(map) {
  const handleOrientation = (event) => {
    let heading = null;

    if (event.webkitCompassHeading !== undefined) {
      heading = event.webkitCompassHeading; // iOS
    } else if (event.alpha !== null) {
      heading = 360 - event.alpha; // Android / Desktop
    }

    if (heading !== null) {
      userHeading = heading;
      updateDirection(map);
    }
  };

  if (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    // iOS: запрос разрешения
    DeviceOrientationEvent.requestPermission()
      .then((response) => {
        if (response === "granted") {
          window.addEventListener("deviceorientation", handleOrientation, true);
        } else {
          alert("Разрешите доступ к ориентации устройства");
        }
      })
      .catch(console.error);
  } else {
    // Android / Desktop
    window.addEventListener(
      "deviceorientationabsolute",
      handleOrientation,
      true,
    );
    window.addEventListener("deviceorientation", handleOrientation, true);
  }
}

// === КНОПКА ДЛЯ ВКЛ/ВЫКЛ СЛЕЖЕНИЯ ===
followBtn.onclick = () => {
  following = !following;

  if (following) {
    followBtn.style.backgroundColor = "#00c853";
    followBtn.style.color = "#fff";
    initOrientation(map);
    updateDirection(map);
    // console.log("📍 Включено направление и поворот камеры");
  } else {
    followBtn.style.backgroundColor = "#000";
    followBtn.style.color = "#fff";
    updateDirection(map);
    //console.log("🛑 Следование выключено");
  }
};

map.on("load", () => {
  initDirectionLayer(map);
  startWatchingPosition(map); // Геолокация работает всегда
});
