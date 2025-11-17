mapboxgl.accessToken = "pk.eyJ1IjoiZ2FuZXNoZGhvbGkiLCJhIjoiY21oczRxdzF0MHNnbDJrc2R5aDlpajFtMyJ9.XEEMWdZq3FpRzgQ5Oe2fOQ"; // Replace with your token

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const city = params.get("city") || "Kolkata";

  const res = await fetch(`http://localhost:4000/api/tripai/details?city=${city}`);
  const data = await res.json();

  if (!data.success) {
    alert("Failed to load trip data");
    return;
  }

  // ---- Fill UI ----
  document.getElementById("hero-photo").src = data.mainPhoto;
  document.getElementById("city-title").textContent = data.title;
  document.getElementById("city-tips").textContent = data.tips || "No data";

  const tagsContainer = document.getElementById("city-tags");
  data.tags.forEach(t => {
    const span = document.createElement("span");
    span.textContent = t;
    tagsContainer.appendChild(span);
  });

  document.getElementById("author-name").textContent = data.author.name;
  document.getElementById("author-meta").textContent = `${data.author.date} · ${data.author.views} views`;

  // ---- Map ----
  const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/streets-v12",
    center: [data.places[0].lng, data.places[0].lat],
    zoom: 12
  });

  const bounds = new mapboxgl.LngLatBounds();

  const listContainer = document.getElementById("places-list");
  listContainer.innerHTML = "";

  data.places.forEach((p, i) => {
    // add to map
    const popupHTML = `
      <div style="max-width:220px">
        <img src="${p.photo}" style="width:100%;border-radius:8px;margin-bottom:5px">
        <h4>${p.name}</h4>
        <p>⭐ ${p.rating || "N/A"} | ${p.category || ""}</p>
      </div>
    `;

    new mapboxgl.Marker({ color: "#ff4d4d" })
      .setLngLat([p.lng, p.lat])
      .setPopup(new mapboxgl.Popup().setHTML(popupHTML))
      .addTo(map);

    bounds.extend([p.lng, p.lat]);

    // add to list
    const card = document.createElement("div");
    card.className = "place-card";
    card.innerHTML = `
      <img src="${p.photo}" alt="${p.name}">
      <div>
        <h4>${p.name}</h4>
        <p>${p.category || ""} · ⭐ ${p.rating || "N/A"}</p>
      </div>
    `;
    card.addEventListener("click", () => {
      map.flyTo({ center: [p.lng, p.lat], zoom: 14 });
    });
    listContainer.appendChild(card);
  });

  map.fitBounds(bounds, { padding: 50 });
});
