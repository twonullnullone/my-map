function searchPoints(query) {
  if (!query) return [];

  const q = query.toLowerCase();

  let type = null;
  if (q.includes("ovn") || q.includes("овн")) type = "ovn";
  if (q.includes("lu") || q.includes("лу")) type = "lu";
  if (q === "p" || q.includes(" п")) type = "p";

  const numberMatch = q.match(/\b\d+\b/); // ← ВАЖНО
  const number = numberMatch ? numberMatch[0] : null;

  return allPoints.filter((p) => {
    const safeType = (p.type || "").toLowerCase();
    const safeId = (p.id || "").toString(); // ← ID отдельно
    const safeName = (p.name || "").toLowerCase();
    const safeDesc = (p.description || "").toLowerCase();

    if (type && safeType !== type) return false;

    // ✅ СТРОГОЕ сравнение ID
    if (number && safeId !== number) return false;

    // если ищем только номер — этого достаточно
    if (number && q.trim() === number) return true;

    const text = `${safeName} ${safeDesc}`;
    return text.includes(q.replace(number || "", "").trim());
  });
}


function addToActivePoints(points) {
  points.forEach((p) => {
    const exists = activePoints.some(
      (a) => a.lat === p.lat && a.lon === p.lon
    );
    if (!exists) activePoints.push(p);
  });

  saveActivePoints();
}

document.getElementById("searchBtn").onclick = () => {
  const input = document.getElementById("searchInput").value.trim();

  const results = searchPoints(input);

  if (!results.length) {
    alert("Ничего не найдено");
    return;
  }

  addToActivePoints(results);
  renderMarkers();

  // перелёт к первой найденной точке
  const p = results[0];
  map.flyTo({
    center: [p.lon, p.lat],
    zoom: 15,
  });
};
