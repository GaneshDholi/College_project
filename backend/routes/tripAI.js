const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

// === CONFIG ===
const GROQ_API_KEY = process.env.GROQ_API_KEY || "gsk_your_groq_key_here";
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || "your_mapbox_token_here";
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY || "your_unsplash_key_here";
const PEXELS_KEY = process.env.PEXELS_API_KEY || "your_pexels_key_here";

// === 🔹 Fetch Unsplash image (primary source) ===
async function getUnsplashImage(query) {
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
        query
      )}&orientation=landscape&per_page=20&page=${Math.floor(
        Math.random() * 5
      ) + 1}&client_id=${UNSPLASH_KEY}`
    );
    const json = await res.json();
    const results = json.results;
    console.log(results);
    if (results?.length > 0) {
      const random = results[Math.floor(Math.random() * results.length)];
      return random.urls?.regular;
    }
  } catch (err) {
    console.warn("⚠️ Unsplash failed:", err.message);
  }
  return null; // fallback handled below
}

// === 🔹 Fetch Pexels image (backup if Unsplash fails) ===
async function getPexelsImage(query) {
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15`,
      { headers: { Authorization: PEXELS_KEY } }
    );
    const json = await res.json();
    const photos = json.photos;
    console.log(photos);
    
    if (photos?.length) {
      const random = photos[Math.floor(Math.random() * photos.length)];
      return random.src.landscape;
    }
  } catch (err) {
    console.warn("⚠️ Pexels failed:", err.message);
  }
  return "https://placehold.co/600x400?text=No+Image";
}

// === 📍 Get coordinates via Mapbox ===
async function getCoords(place, city) {
  try {
    const q = `${place}, ${city}`;
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        q
      )}.json?limit=1&access_token=${MAPBOX_TOKEN}`
    );
    const data = await res.json();
    const coords = data.features?.[0]?.center;
    if (coords) return { lat: coords[1], lng: coords[0] };
  } catch (err) {
    console.warn("⚠️ Mapbox failed:", err.message);
  }
  return { lat: 22.3511148, lng: 78.6677428 }; // fallback center of India
}

// === 🧭 MAIN ROUTE ===
router.get("/details", async (req, res) => {
  const city = (req.query.city || "Jaipur") + ", India";
  console.log("🧭 Generating AI travel guide for:", city);

  const prompt = `
You are a JSON-only travel data generator.
Output strictly valid JSON (no markdown, no text).

Generate a travel guide for "${city}" in this format:
{
  "title": "string",
  "intro": "short intro about the city",
  "tags": ["string"],
  "tips": "1-paragraph travel advice",
  "author": {"name": "Traveler", "date": "Month YYYY", "views": number},
  "places": [
    {"name": "real tourist attraction name", "category": "type", "desc": "short description", "lat": number, "lng": number}
  ]
}
Include 5–6 real, famous attractions.
Use real coordinates near ${city}.
`;

  try {
    // 🔸 1️⃣ Ask Groq (LLaMA)
    const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        max_tokens: 900,
      }),
    });

    const data = await aiRes.json();
    const text = data?.choices?.[0]?.message?.content || "";
    if (!text.trim()) throw new Error("AI returned empty text");

    const clean = text.replace(/```json|```/g, "").trim();

    let trip;
    try {
      trip = JSON.parse(clean);
    } catch (err) {
      console.warn("⚠️ JSON parse failed:", err.message);
      trip = {
        title: `${city} Travel Guide`,
        intro: `Explore ${city}`,
        tags: ["Travel", "Culture"],
        tips: "Discover the charm of local culture and landmarks.",
        author: { name: "Traveler", date: "Nov 2025", views: 25 },
        places: [{ name: city, category: "City", desc: "Explore beauty", lat: 22.35, lng: 78.66 }],
      };
    }

    // 🔸 2️⃣ Add coords + unique images + rating
    for (const place of trip.places) {
      if (!place.lat || !place.lng) {
        const coords = await getCoords(place.name, city);
        place.lat = coords.lat;
        place.lng = coords.lng;
      }

      let img = await getUnsplashImage(place.name);
      if (!img) img = await getPexelsImage(place.name);

      place.photo = img;
      place.rating = (Math.random() * 0.9 + 4.1).toFixed(1); // 4.1–5.0
    }

    // 🔸 3️⃣ Main city image
    let mainPhoto = await getUnsplashImage(city);
    if (!mainPhoto) mainPhoto = await getPexelsImage(city);
    trip.mainPhoto = mainPhoto;

    // ✅ Final JSON response
    res.json({ success: true, ...trip });
  } catch (err) {
    console.error("❌ TripAI Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
