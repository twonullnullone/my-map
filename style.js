
map.on("load", () => {
  // 1. Удаляем все слои зданий
  const buildingLayers = map
    .getStyle()
    .layers.filter((l) => l.id.includes("building"));
  buildingLayers.forEach((layer) => {
    if (map.getLayer(layer.id)) {
      map.removeLayer(layer.id);
    }
  });
});

map.on("load", () => {
  const roadLabelLayers = [
    "highway-name-path",
    "highway-name-minor",
    "highway-name-major",
  ];

  roadLabelLayers.forEach((id) => {
    if (map.getLayer(id)) {
      map.setPaintProperty(id, "text-color", hexColors[5]); //  цвет текста
      map.setPaintProperty(id, "text-halo-color", hexColors[6]); //  цвет обводки
      map.setPaintProperty(id, "text-halo-width", 0.5); // ширина обводки
    }
  });
});

map.on("load", () => {
  const roadColors = {
    "highway-motorway": hexColors[7], //  автомагистрали
    "highway-trunk": hexColors[7], //  главные трассы
    "highway-primary": hexColors[7], //  главные дороги
    "highway-secondary-tertiary": hexColors[7], //  вторичные дороги
    "highway-minor": hexColors[7], // Голубые мелкие дороги
    "highway-path": hexColors[7], // тропинки
    "highway-link": hexColors[7], // съезды
    "highway-motorway-link": hexColors[7], // съезды с автомагистралей
  };

  Object.entries(roadColors).forEach(([layerId, color]) => {
    if (map.getLayer(layerId)) {
      map.setPaintProperty(layerId, "line-color", color);
    }
  });
});
map.on("load", () => {
  const casingColor = hexColors[8]; // или другой
  map.getStyle().layers.forEach((layer) => {
    if (layer.id.includes("casing") && map.getLayer(layer.id)) {
      map.setPaintProperty(layer.id, "line-color", casingColor);
    }
  });
});

map.on("load", () => {
  const hidePatterns = [
    "poi",
    "bus",
    "school",
    "hospital",
    "shop",
    "place",
    "transit",
    "station",
  ];

  map.getStyle().layers.forEach((layer) => {
    const id = layer.id.toLowerCase();
    if (hidePatterns.some((p) => id.includes(p))) {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
  });

  // console.log("🚫 Убраны подписи заведений, остановок и учреждений.");
});

map.on("load", () => {
  //  console.log("🗺️ Map loaded — фильтруем подписи");

  const labelLayers = [
    // населённые пункты, страны
    "label_other",
    "label_village",
    "label_town",
    "label_state",
    "label_city",
    "label_city_capital",
    "label_country_1",
    "label_country_2",
    "label_country_3",
    // дороги
    "highway-name-path",
    "highway-name-minor",
    "highway-name-major",
    "highway-shield-non-us",
    "highway-shield-us-interstate",
    "road_shield_us",
  ];

  labelLayers.forEach((layerId) => {
    if (map.getLayer(layerId)) {
      // Если есть русское поле — берём его, иначе оставляем оригинал
      map.setLayoutProperty(layerId, "text-field", [
        "coalesce",
        ["get", "name_ru"],
        ["get", "name"],
        ["get", "ref"], // для номеров трасс
      ]);
    }
  });

  console
    .log
    //  "✅ Убраны латинские подписи и заменены на кириллические (включая дороги).",
    ();
});

map.on("load", () => {
  // Установка цвета фона карты
  if (map.getLayer("background")) {
    map.setPaintProperty("background", "background-color", hexColors[0]);
  }

  // Слои с зелёными участками
  const greenLayers = [
    "park",
    "landcover-wood",
    "landcover-grass",
    "landcover-grass-park",
    "landuse-cemetery",
    "landuse-hospital",
    "landuse-school",
  ];

  greenLayers.forEach((layerId) => {
    if (map.getLayer(layerId)) {
      try {
        map.setPaintProperty(layerId, "fill-color", hexColors[1]);
      } catch (err) {
        console.warn(`Не удалось изменить цвет слоя ${layerId}:`, err);
      }
    }
  });
});