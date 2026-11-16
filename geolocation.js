
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

function initRadarLayer() {

    if (!map.isStyleLoaded()) return;

    if (!map.getSource(RADAR_SOURCE)) {
        map.addSource(RADAR_SOURCE, {
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
            source: RADAR_SOURCE,
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
            source: RADAR_SOURCE,
            filter: ["==", ["get", "shape"], "sector"],
            paint: {
                "fill-color": "rgba(0,200,83,0.35)",
                "fill-outline-color": "rgba(0,200,83,0.8)"
            }
        });
    }

    updateRadar();
}


// =========================================
// ОБНОВЛЕНИЕ РАДАРА
// =========================================

function updateRadar() {

    if (!map.getSource(RADAR_SOURCE)) return;

    const source = map.getSource(RADAR_SOURCE);

    if (!following || !userCoords || !renderCoords) {
        source.setData({
            type: "FeatureCollection",
            features: []
        });

        return;
    }

    const center = renderCoords;

    source.setData({
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                properties: {
                    shape: "circle"
                },
                geometry: buildCircle(center, DIST_METERS)
            },
            {
                type: "Feature",
                properties: {
                    shape: "sector"
                },
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

            if (!userMarker) {

                userMarker = new maplibregl.Marker({
                    color: typeof hexColors !== "undefined"
                        ? hexColors[4]
                        : "#00c853"
                })
                    .setLngLat(userCoords)
                    .addTo(map);

                renderCoords = [...userCoords];
                targetCoords = [...userCoords];

                startMarkerAnimation();

            } else {

                if (
                    distanceMeters(targetCoords, userCoords) >= MIN_MOVE
                ) {
                    targetCoords = [...userCoords];
                }
            }

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
        console.warn("DeviceOrientation API недоступен");
        return;
    }

    try {

        // iOS Safari: разрешение после нажатия кнопки

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

            // iPhone Safari

            if (
                typeof e.webkitCompassHeading === "number"
            ) {
                heading = e.webkitCompassHeading;
            }

            // Android: абсолютное направление

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

        console.log("Компас: обработчики подключены");

    } catch (error) {

        console.error("Ошибка компаса:", error);

    }
}


// =========================================
// КНОПКА СЛЕЖЕНИЯ
// =========================================

if (followBtn) {

    followBtn.onclick = async () => {

        following = !following;

        followBtn.style.backgroundColor = following
            ? "#41644A"
            : "transparent";

        followBtn.style.color = "#fff";

        if (following) {

            await initOrientation();

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

    console.log("Map style loaded");

    initRadarLayer();

});

map.on("load", () => {

    startWatchingPosition();

    initRadarLayer();

});
