
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
const RADAR_CIRCLE = "userRadarCircle";
const RADAR_SECTOR = "userRadarSector";

let following = false;

let userCoords = null;
let targetCoords = null;
let renderCoords = null;

let userHeading = 0;
let headingAvailable = false;

let watchId = null;
let animationRunning = false;
let orientationStarted = false;
let radarReady = false;

const followBtn = document.getElementById("setLocationBtn");
const refreshBtn = document.getElementById("refreshLocationBtn");


// =========================================
// ПРОВЕРКА КООРДИНАТ
// =========================================

function validCoords(coords) {
    return (
        Array.isArray(coords) &&
        coords.length >= 2 &&
        Number.isFinite(coords[0]) &&
        Number.isFinite(coords[1]) &&
        Math.abs(coords[0]) <= 180 &&
        Math.abs(coords[1]) <= 90
    );
}


// =========================================
// РАССТОЯНИЕ
// =========================================

function distanceMeters(a, b) {

    if (!validCoords(a) || !validCoords(b)) {
        return Infinity;
    }

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

    if (!validCoords(center)) return null;

    const [lon, lat] = center;
    const R = 6378137;

    const coords = [];

    for (let i = 0; i <= steps; i++) {

        const angle = i / steps * Math.PI * 2;

        const dx = radius * Math.cos(angle);
        const dy = radius * Math.sin(angle);

        const dLat = dy / R;
        const cosLat = Math.max(
            0.000001,
            Math.abs(Math.cos(lat * Math.PI / 180))
        );

        const dLon = dx / (R * cosLat);

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

    if (!validCoords(center)) return null;
    if (!Number.isFinite(bearing)) return null;

    const [lon, lat] = center;

    const R = 6378137;
    const steps = 40;

    const coords = [[...center]];

    const bearingRad = bearing * Math.PI / 180;
    const halfFov = fov / 2 * Math.PI / 180;

    const cosLat = Math.max(
        0.000001,
        Math.abs(Math.cos(lat * Math.PI / 180))
    );

    for (let i = 0; i <= steps; i++) {

        const angle =
            bearingRad - halfFov +
            (i / steps) * halfFov * 2;

        const dx = radius * Math.sin(angle);
        const dy = radius * Math.cos(angle);

        const dLat = dy / R;
        const dLon = dx / (R * cosLat);

        coords.push([
            lon + dLon * 180 / Math.PI,
            lat + dLat * 180 / Math.PI
        ]);
    }

    coords.push([...center]);

    return {
        type: "Polygon",
        coordinates: [coords]
    };
}


// =========================================
// ПУСТОЙ GEOJSON
// =========================================

function emptyRadarData() {

    return {
        type: "FeatureCollection",
        features: []
    };
}


// =========================================
// ИНИЦИАЛИЗАЦИЯ РАДАРА
// Вызывается после каждой загрузки стиля
// =========================================

function initRadarLayer() {

    if (!map || !map.isStyleLoaded()) {
        console.log("RADAR: стиль ещё не готов");
        return false;
    }

    console.log("RADAR: проверка слоёв");

    // -------------------------------------
    // SOURCE
    // -------------------------------------

    if (!map.getSource(RADAR_SOURCE)) {

        map.addSource(RADAR_SOURCE, {
            type: "geojson",
            data: emptyRadarData()
        });

        console.log("RADAR: SOURCE CREATED");
    }

    // -------------------------------------
    // CIRCLE
    // -------------------------------------

    if (!map.getLayer(RADAR_CIRCLE)) {

        map.addLayer({
            id: RADAR_CIRCLE,
            type: "fill",
            source: RADAR_SOURCE,

            filter: [
                "==",
                ["get", "shape"],
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

    // -------------------------------------
    // SECTOR
    // -------------------------------------

    if (!map.getLayer(RADAR_SECTOR)) {

        map.addLayer({
            id: RADAR_SECTOR,
            type: "fill",
            source: RADAR_SOURCE,

            filter: [
                "==",
                ["get", "shape"],
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

    radarReady =
        !!map.getSource(RADAR_SOURCE) &&
        !!map.getLayer(RADAR_CIRCLE) &&
        !!map.getLayer(RADAR_SECTOR);

    console.log("RADAR READY:", radarReady);

    if (radarReady) {
        updateRadar();
    }

    return radarReady;
}


// =========================================
// ОБНОВЛЕНИЕ РАДАРА
// =========================================

function updateRadar() {

    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource(RADAR_SOURCE);

    if (!source) return;

if (
    !following ||
    !validCoords(userCoords) ||
    !validCoords(renderCoords)
) {
    source.setData(emptyRadarData());
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

    if (!circle || !sector) {
        source.setData(emptyRadarData());
        return;
    }

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
// ПЛАВНОЕ ДВИЖЕНИЕ МАРКЕРА
// =========================================

function startMarkerAnimation() {

    if (animationRunning) return;

    animationRunning = true;

    function loop() {

        if (
            userMarker &&
            validCoords(renderCoords) &&
            validCoords(targetCoords)
        ) {

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
// GPS
// =========================================

function startWatchingPosition() {

    if (!navigator.geolocation) {
        console.error("GPS НЕ ПОДДЕРЖИВАЕТСЯ");
        return;
    }

    if (watchId !== null) return;

    watchId = navigator.geolocation.watchPosition(

        (pos) => {

            const lon = pos.coords.longitude;
            const lat = pos.coords.latitude;

            const coords = [lon, lat];

            if (!validCoords(coords)) {
                console.warn("GPS: некорректные координаты");
                return;
            }

            userCoords = coords;

            window.userCoords = coords;

            // Первоначальная позиция

            if (!renderCoords) {
                renderCoords = [...coords];
            }

            if (!targetCoords) {
                targetCoords = [...coords];
            }

            // Создание маркера

            if (!userMarker) {

                userMarker = new maplibregl.Marker({

                    color:
                        typeof hexColors !== "undefined" &&
                        hexColors[4]
                            ? hexColors[4]
                            : "#000"

                })
                .setLngLat(coords)
                .addTo(map);
            }

            // Обновление целевой позиции

            if (
                distanceMeters(targetCoords, coords) >= MIN_MOVE
            ) {

                targetCoords = [...coords];
            }

            // Запуск анимации

            if (!animationRunning) {
                startMarkerAnimation();
            }

            if (following) {
                updateRadar();
            }

            console.log("GPS:", coords);
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
        console.warn("COMPASS: недоступен");
        return;
    }

    try {

        if (
            typeof DeviceOrientationEvent.requestPermission ===
            "function"
        ) {

            const permission =
                await DeviceOrientationEvent.requestPermission();

            if (permission !== "granted") {
                console.warn("COMPASS: доступ запрещён");
                return;
            }
        }

        function handleOrientation(e) {

            let heading = null;

            if (
                Number.isFinite(e.webkitCompassHeading)
            ) {

                heading = e.webkitCompassHeading;

            } else if (
                e.absolute === true &&
                Number.isFinite(e.alpha)
            ) {

                heading = 360 - e.alpha;
            }

            if (!Number.isFinite(heading)) return;

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

        console.error("COMPASS ERROR:", error);
    }
}


// =========================================
// КНОПКА СЛЕЖЕНИЯ
// =========================================

if (followBtn) {

    followBtn.onclick = async () => {

        following = !following;

        followBtn.style.backgroundColor =
            following ? "#41644A" : "transparent";

        followBtn.style.color = "#fff";

        if (following) {

            // Включаем компас
            initOrientation();

            // Запускаем GPS
            startWatchingPosition();

            // Центрируем карту
            if (validCoords(userCoords)) {

                map.easeTo({
                    center: userCoords,
                    bearing: userHeading,
                    duration: 500,
                    essential: true
                });
            }

            // Показываем радар
            updateRadar();

        } else {

            // Полностью очищаем радар
            const source = map.getSource(RADAR_SOURCE);

            if (source) {
                source.setData(emptyRadarData());
            }

            console.log("RADAR DISABLED");
        }

        console.log("FOLLOWING:", following);
    };
}


// =========================================
// КНОПКА ОБНОВЛЕНИЯ ПОЗИЦИИ
// =========================================

if (refreshBtn) {

    refreshBtn.onclick = () => {

        if (!validCoords(userCoords)) return;

        map.flyTo({

            center: userCoords,
            zoom: 14,
            essential: true

        });
    };
}


// =========================================
// СОБЫТИЯ MAPLIBRE
// =========================================

// При первой загрузке и каждой смене стиля

map.on("style.load", () => {

    console.log("MAP STYLE LOADED");

    radarReady = false;

    initRadarLayer();

});

// GPS запускаем один раз после загрузки карты


let radarInitScheduled = false;

function scheduleRadarInit() {

    if (radarInitScheduled) return;

    radarInitScheduled = true;

    function checkStyle() {

        if (!map.isStyleLoaded()) {
            requestAnimationFrame(checkStyle);
            return;
        }

        radarInitScheduled = false;

        console.log("RADAR: стиль готов");

        initRadarLayer();
    }

    requestAnimationFrame(checkStyle);
}


// Смена или загрузка стиля
map.on("style.load", () => {

    console.log("MAP STYLE LOADED");

    radarReady = false;

    scheduleRadarInit();

});


// Первоначальная загрузка карты
map.on("load", () => {

    console.log("MAP LOADED");

    startWatchingPosition();

    scheduleRadarInit();

});


// Если скрипт подключился после загрузки
if (map.loaded()) {
    startWatchingPosition();
}

if (map.isStyleLoaded()) {
    scheduleRadarInit();
}



// =========================================
// DEBUG PANEL
// =========================================

const debugPanel = document.createElement("div");

debugPanel.id = "radarDebugPanel";

Object.assign(debugPanel.style, {

    position: "fixed",
    top: "10px",
    left: "10px",
    zIndex: "999999",
    width: "190px",
    padding: "10px",
    background: "rgba(0,0,0,0.85)",
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

    const styleLoaded = map.isStyleLoaded();

    const values = {

        marker: !!userMarker,
        GPS: validCoords(userCoords),
        render: validCoords(renderCoords),

        source: !!map.getSource(RADAR_SOURCE),
        circle: !!map.getLayer(RADAR_CIRCLE),
        sector: !!map.getLayer(RADAR_SECTOR),

        radar: radarReady,
        compass: headingAvailable,
        heading: Math.round(userHeading),

        follow: following,
        style: styleLoaded

    };

    debugPanel.textContent = Object.entries(values)

        .map(([key, value]) => `${key}: ${value}`)

        .join("\n");
}

setInterval(updateRadarDebug, 1000);

updateRadarDebug();
