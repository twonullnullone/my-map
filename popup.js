function showToast(msg) {
  const toast = document.createElement("div");
  toast.textContent = msg;

  Object.assign(toast.style, {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    background: "rgba(0, 0, 0, 0.8)",
    color: "#fff",
    padding: "12px 20px",
    borderRadius: "10px",
    fontSize: "16px",
    textAlign: "center",
    zIndex: "10",
    opacity: "0",
    transition: "opacity 0.3s ease",
    pointerEvents: "none",
    maxWidth: "80%",
  });

  document.body.appendChild(toast);

  // Плавное появление
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
  });

  // Исчезает через 1.5 секунды
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 1500);
}

function clearMarkers() {
    if (!markers) return;

    markers.forEach(m => {
        try {
            m.remove();
        } catch (e) {}
    });

    markers = [];
}




function renderMarkers() {
    markers.forEach(m => m.remove());
    markers = [];

    let selectedPoints =
        JSON.parse(localStorage.getItem("selectedPoints")) || [];

    activePoints.forEach(p => {

        const el = document.createElement("div");
        el.className = "marker";
        el.textContent = p.name;

        Object.assign(el.style, {
            padding: "4px 8px",
            background: hexColors[3],
            borderRadius: "15px",
            border: "3px solid white",
            color: "#fff",
            fontSize: "10px",
            fontWeight: "bold",
            textAlign: "center",
            cursor: "pointer",
            boxShadow: "0 0 6px rgba(0,0,0,0.3)"
        });

        const isSelected = selectedPoints.some(s =>
            Math.abs(Number(s.lat) - Number(p.lat)) < 0.00001 &&
            Math.abs(Number(s.lon) - Number(p.lon)) < 0.00001
        );

        if (isSelected) {
            el.style.background = "#9ACD32";
        }

        // POPUP HTML
        const popupHTML = `
            <div style="min-width:220px; text-align:center;">

                <b>${p.name}</b>
                <div style="font-size:11px; margin:4px 0 8px;">
                    ${p.description || ""}
                </div>

                <div class="popup-grid">

                    <button class="popup-btn div1"
                        data-action="info"
                        style="background:#B7E5CD;color:#000;">
                        2GIS
                    </button>

                    <button class="popup-btn div2"
                        data-action="yandex"
                        style="background:#F8B400;color:#fff;">
                        YANDEX
                    </button>

                    <button class="popup-btn div3"
                        data-action="googlemaps"
                        style="background:#fff;color:#000;">
                        GOOGLE
                    </button>

                    <button class="popup-btn div4"
                        data-action="delete"
                        style="background:red;color:#fff;">
                        DELETE
                    </button>

                    <button class="popup-btn div5"
                        data-action="select"
                        style="background:#000;color:#fff;">
                        SELECT
                    </button>

                    <button class="popup-btn div6"
                        data-action="share"
                        style="background:blue;color:#fff;">
                        SHARE
                    </button>

                    <button class="popup-btn div7"
                        data-action="copy"
                        style="background:#555;color:#fff;">
                        COPY
                    </button>

                </div>
            </div>
        `;

        const popup = new maplibregl.Popup({
            offset: 25,
            closeButton: true,
            closeOnClick: true
        }).setHTML(popupHTML);

        const marker = new maplibregl.Marker({
            element: el
        })
        .setLngLat([p.lon, p.lat])
        .setPopup(popup)
        .addTo(map);

        markers.push(marker);

        // POPUP BUTTON EVENTS
        popup.on("open", () => {

            const popupEl = popup.getElement();
            if (!popupEl) return;

            popupEl.querySelectorAll(".popup-btn").forEach(btn => {

                btn.onclick = async (e) => {

                    const action = e.currentTarget.dataset.action;

                    // 2GIS
                    if (action === "info") {
                        window.location.href =
                            `dgis://2gis.kz/geo/${p.lon},${p.lat}`;
                    }

                    // GOOGLE MAPS
                    if (action === "googlemaps") {
                        const lat = p.lat;
                        const lon = p.lon;

                        const url =
                            `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

                        window.location.href = url;
                    }

                    // YANDEX
                    if (action === "yandex") {
                        window.location.href =
                            `yandexnavi://build_route_on_map?lat_to=${p.lat}&lon_to=${p.lon}`;
                    }

                    // SELECT
                    if (action === "select") {

                        selectedPoints =
                            JSON.parse(localStorage.getItem("selectedPoints")) || [];

                        const index = selectedPoints.findIndex(s =>
                            Math.abs(Number(s.lat) - Number(p.lat)) < 0.00001 &&
                            Math.abs(Number(s.lon) - Number(p.lon)) < 0.00001
                        );

                        if (index === -1) {
                            selectedPoints.push({
                                lat: p.lat,
                                lon: p.lon
                            });

                            el.style.background = "#9ACD32";

                        } else {
                            selectedPoints.splice(index, 1);
                            el.style.background = hexColors[3];
                        }

                        localStorage.setItem(
                            "selectedPoints",
                            JSON.stringify(selectedPoints)
                        );
                    }

                    // SHARE
                    if (action === "share") {

                        const coords = `${Number(p.lat).toFixed(9)}, ${Number(p.lon).toFixed(8)}`;

                        if (navigator.share) {
                            try {
                                await navigator.share({
                                    title: "Координаты",
                                    text: coords
                                });
                                showToast("Поделились 📤");
                            } catch {
                                showToast("Отменено 🙃");
                            }
                        } else {
                            try {
                                await navigator.clipboard.writeText(coords);
                                showToast("Скопировано 📋");
                            } catch {
                                showToast("Ошибка копирования");
                            }
                        }
                    }

                    // COPY
                    if (action === "copy") {

                        const coords = `${p.lat}, ${p.lon}`;

                        try {
                            await navigator.clipboard.writeText(coords);
                            showToast("Координаты скопированы 📋");
                        } catch {
                            const temp = document.createElement("textarea");
                            temp.value = coords;
                            document.body.appendChild(temp);
                            temp.select();
                            document.execCommand("copy");
                            temp.remove();

                            showToast("Скопировано 📋");
                        }
                    }

                    // DELETE
                    if (action === "delete") {

                        activePoints = activePoints.filter(a =>
                            !(a.lat === p.lat && a.lon === p.lon)
                        );

                        selectedPoints =
                            JSON.parse(localStorage.getItem("selectedPoints")) || [];

                        selectedPoints = selectedPoints.filter(s =>
                            !(s.lat === p.lat && s.lon === p.lon)
                        );

                        localStorage.setItem(
                            "selectedPoints",
                            JSON.stringify(selectedPoints)
                        );

                        saveActivePoints();

                        popup.remove();

                        renderMarkers();
                        renderFilterList(allPoints);
                    }

                };

            });

        });

    });
}

