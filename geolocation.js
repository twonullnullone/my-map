
/* =========================================
   SERGEK — GPS RADAR + COMPASS
   MapLibre / Mapbox GL
========================================= */

// =========================================
// НАСТРОЙКИ
// =========================================

const SMOOTH = 0.08;
const MIN_MOVE = 2;

const FOV_DEG = 80;
const DIST_METERS = 150;

const RADAR_SOURCE = "userRadar";

let following = false;

//let userMarker = null;
let userCoords = null;
let targetCoords = null;
let renderCoords = null;

let userHeading = 0;
let headingAvailable = false;

let watchId = null;
let animationRunning = false;
let orientationStarted = false;

const followBtn = document.getElementById("setLocationBtn");
const refreshBtn = document.getElementById("refreshLocationBtn");


// =========================================
// РАССТОЯНИЕ
// =========================================

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


// =========================================
// ПОСТРОЕНИЕ КРУГА
// =========================================

function buildCircle(center, radius, steps = 64) {
    const [lon, lat] = center;
    const R = 6378137;

    const coords = [];

    for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2;

        const dx = radius * Math.cos(angle);
        const dy = radius * Math.sin(angle);

        const dLat = dy / R;
        const dLon = dx / (R * Math.cos(lat * Math.PI / 180));

        coords.push([
            lon + dLon * 180 / Math.PI,
            lat + dLat * 180 / Math.PI
        ]);
    }

    return {
        type: "Polygon",
        coordinates: [coords]
    };
}


// =========================================
// ПОСТРОЕНИЕ СЕКТОРА
// =========================================

function buildConePolygon(center, bearing, fov, radius) {
    const [lon, lat] = center;

    const R = 6378137;
    const steps = 40;

    const coords = [center];

    const bearingRad = bearing * Math.PI / 180;
    const halfFov = fov / 2 * Math.PI / 180;

    for (let i = 0; i <= steps; i++) {
        const angle = bearingRad - halfFov +
            (i / steps) * (halfFov * 2);

        const dx = radius * Math.sin(angle);
        const dy = radius * Math.cos(angle);

        const dLat = dy / R;
        const dLon = dx / (R * Math.cos(lat * Math.PI / 180));

        coords.push([
            lon + dLon * 180 / Math.PI,
            lat + dLat * 180 / Math.PI
        ]);
    }

    coords.push(center);

    return {
        type: "Polygon",
        coordinates: [coords]
    };
}


// =========================================
// ИНИЦИАЛИЗАЦИЯ РАДАРА
// =========================================

// =====================================
// ИНИЦИАЛИЗАЦИЯ РАДАРА
// =====================================

let radarInitWaiting = false;

function initRadarLayer() {

    if (!map || !map.getStyle()) {
        console.log("RADAR: карта ещё не готова");
        return;
    }

    // Ждём полной готовности стиля
    if (!map.isStyleLoaded()) {

        if (!radarInitWaiting) {
            radarInitWaiting = true;

            console.log("RADAR: ожидаем загрузку стиля");

            map.once("idle", () => {
                radarInitWaiting = false;
                initRadarLayer();
            });
        }

        return;
    }

    console.log("RADAR: инициализация");

    // ---------------------------------
    // 1. GEOJSON SOURCE
    // ---------------------------------

    if (!map.getSource("userRadar")) {

        map.addSource("userRadar", {
            type: "geojson",
            data: {
                type: "FeatureCollection",
                features: []
            }
        });

        console.log("RADAR: SOURCE CREATED");
    }

    // ---------------------------------
    // 2. КРУГ РАДАРА
    // ---------------------------------

    if (!map.getLayer("userRadarCircle")) {

        map.addLayer({
            id: "userRadarCircle",
            type: "fill",
            source: "userRadar",

            filter: [
                "==",
                ["get", "type"],
                "circle"
            ],

            paint: {
                "fill-color": "#36A2FF",
                "fill-opacity": 0.12,
                "fill-outline-color": "#36A2FF"
            }
        });

        console.log("RADAR: CIRCLE CREATED");
    }

    // ---------------------------------
    // 3. СЕКТОР НАПРАВЛЕНИЯ
    // ---------------------------------

    if (!map.getLayer("userRadarSector")) {

        map.addLayer({
            id: "userRadarSector",
            type: "fill",
            source: "userRadar",

            filter: [
                "==",
                ["get", "type"],
                "sector"
            ],

            paint: {
                "fill-color": "#36A2FF",
                "fill-opacity": 0.28,
                "fill-outline-color": "#36A2FF"
            }
        });

        console.log("RADAR: SECTOR CREATED");
    }

    // ---------------------------------
    // 4. ОБНОВЛЕНИЕ
    // ---------------------------------

    console.log("RADAR INITIALIZED", {
        source: !!map.getSource("userRadar"),
        circle: !!map.getLayer("userRadarCircle"),
        sector: !!map.getLayer("userRadarSector")
    });

    if (typeof updateRadar === "function") {
        updateRadar();
    }
}

if (userCoords && renderCoords) {
    updateRadar();
}
// =========================================
// ОБНОВЛЕНИЕ РАДАРА
// =========================================

function updateRadar() {

    const source = map.getSource(RADAR_SOURCE);

    if (!source) return;

    if (!following || !userCoords || !renderCoords) {
        source.setData({
            type: "FeatureCollection",
            features: []
        });
        return;
    }

    const center = renderCoords;

    const circle = buildCircle(
        center,
        DIST_METERS
    );

    const sector = buildConePolygon(
        center,
        userHeading,
        FOV_DEG,
        DIST_METERS
    );

    source.setData({
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                properties: {
                    shape: "circle"
                },
                geometry: circle
            },
            {
                type: "Feature",
                properties: {
                    shape: "sector"
                },
                geometry: sector
            }
        ]
    });
}


// =========================================
// ПЛАВНОЕ ДВИЖЕНИЕ
// =========================================

function startMarkerAnimation() {

    if (animationRunning) return;

    animationRunning = true;

    function loop() {

        if (userMarker && renderCoords && targetCoords) {

            const dx = targetCoords[0] - renderCoords[0];
            const dy = targetCoords[1] - renderCoords[1];

            renderCoords[0] += dx * SMOOTH;
            renderCoords[1] += dy * SMOOTH;

            userMarker.setLngLat(renderCoords);

            if (following) {
                updateRadar();
            }
        }

        requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
}
// =========================================
// ГЕОЛОКАЦИЯ
// =========================================

function startWatchingPosition() {

    if (!navigator.geolocation) {
        console.error("GPS не поддерживается");
        return;
    }

    if (watchId !== null) return;

    watchId = navigator.geolocation.watchPosition(

        (pos) => {

            userCoords = [
                pos.coords.longitude,
                pos.coords.latitude
            ];

            window.userCoords = userCoords;

            // Всегда инициализируем координаты
            if (!renderCoords) {
                renderCoords = [...userCoords];
            }

            if (!targetCoords) {
                targetCoords = [...userCoords];
            }

            // Создаём маркер
            if (!userMarker) {

                userMarker = new maplibregl.Marker({
                    color: typeof hexColors !== "undefined"
                        ? hexColors[4]
                        : "#00c853"
                })
                .setLngLat(userCoords)
                .addTo(map);
            }

            // Обновляем целевую позицию
            if (
                distanceMeters(targetCoords, userCoords) >= MIN_MOVE
            ) {
                targetCoords = [...userCoords];
            }

            // Запускаем анимацию
            if (!animationRunning) {
                startMarkerAnimation();
            }

            // Обновляем радар
            if (following) {
                updateRadar();
            }

            console.log("GPS:", userCoords);

        },

        (err) => {
            console.error(
                "GPS ERROR:",
                err.code,
                err.message
            );
        },

        {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 20000
        }
    );
}


// =========================================
// КОМПАС
// =========================================

async function initOrientation() {

    if (orientationStarted) return;

    if (typeof DeviceOrientationEvent === "undefined") {
        console.warn("Компас недоступен");
        return;
    }

    try {

        if (
            typeof DeviceOrientationEvent.requestPermission === "function"
        ) {

            const permission =
                await DeviceOrientationEvent.requestPermission();

            if (permission !== "granted") {
                console.warn("Доступ к компасу запрещён");
                return;
            }
        }

        function handleOrientation(e) {

            let heading = null;

            if (
                typeof e.webkitCompassHeading === "number"
            ) {
                heading = e.webkitCompassHeading;
            }

            else if (
                e.absolute === true &&
                typeof e.alpha === "number"
            ) {
                heading = 360 - e.alpha;
            }

            if (heading === null) return;

            userHeading = (heading + 360) % 360;
            headingAvailable = true;

            if (following) {
                updateRadar();
            }
        }

        window.addEventListener(
            "deviceorientation",
            handleOrientation,
            true
        );

        window.addEventListener(
            "deviceorientationabsolute",
            handleOrientation,
            true
        );

        orientationStarted = true;

        console.log("COMPASS INITIALIZED");

    } catch (error) {

        console.error("Ошибка компаса:", error);

    }
}


// =========================================
// КНОПКА СЛЕЖЕНИЯ
// =========================================

if (followBtn) {

    followBtn.onclick = () => {

        following = !following;

        followBtn.style.backgroundColor =
            following ? "#41644A" : "transparent";

        followBtn.style.color = "#fff";

        if (following) {

            // Запрашиваем компас один раз
            initOrientation();

            // Перемещаем карту к пользователю
            if (userCoords) {

                map.easeTo({
                    center: userCoords,
                    bearing: userHeading,
                    duration: 500,
                    essential: true
                });
            }
        }

        updateRadar();

        console.log("FOLLOWING:", following);
    };
}

// =========================================
// КНОПКА ОБНОВЛЕНИЯ ПОЗИЦИИ
// =========================================

if (refreshBtn) {

    refreshBtn.onclick = () => {

        if (!userCoords) return;

        map.flyTo({
            center: userCoords,
            zoom: 14,
            essential: true
        });
    };
}


// =========================================
// ЗАПУСК
// =========================================

map.on("style.load", () => {

    console.log("MAP STYLE LOADED");

    initRadarLayer();

});

map.on("load", () => {

    console.log("MAP LOADED");

    initRadarLayer();

    startWatchingPosition();

});

// =====================================
// RADAR DEBUG PANEL — ДЛЯ ТЕЛЕФОНА
// =====================================

const debugPanel = document.createElement("div");

debugPanel.id = "radarDebugPanel";

Object.assign(debugPanel.style, {
    position: "fixed",
    top: "10px",
    left: "10px",
    zIndex: "999999",
    width: "190px",
    padding: "10px",
    background: "rgba(0, 0, 0, 0.85)",
    color: "#00ff88",
    font: "12px monospace",
    borderRadius: "8px",
    pointerEvents: "none",
    whiteSpace: "pre-line",
    lineHeight: "1.5",
    boxSizing: "border-box"
});

document.body.appendChild(debugPanel);

function updateRadarDebug() {
    const values = {
        marker: !!userMarker,
        GPS: !!userCoords,
        render: !!renderCoords,
        source: !!map.getSource("userRadar"),
        circle: !!map.getLayer("userRadarCircle"),
        sector: !!map.getLayer("userRadarSector"),
        follow: following,
        style: map.isStyleLoaded(),
        init: typeof initRadarLayer,
        layers: map.getStyle()?.layers?.length ?? 0
    };

    debugPanel.textContent = Object.entries(values)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");
}

setInterval(updateRadarDebug, 1000);
updateRadarDebug();
