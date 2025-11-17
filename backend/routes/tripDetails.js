// routes/tripDetails.js
const express = require("express");
const fetch = require("node-fetch");
require("dotenv").config();

const router = express.Router();

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

// Allowed cities
const POPULAR_CITIES = ["Kolkata", "Rishikesh", "Manali", "Goa", "Jaipur"];

router.get("/details", async (req, res) => {
  try {
    const { city } = req.query;
    if (!city) return res.status(400).json({ success: false, error: "Missing ?city" });
    if (!POPULAR_CITIES.includes(city))
      return res.status(403).json({ success: false, error: "Not a popular city" });

    // 1️⃣ Get coordinates of city
    const geoRes = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        city
      )}.json?access_token=${MAPBOX_TOKEN}`
    );
    const geo = await geoRes.json();
    const center = geo.features?.[0]?.center || [77.2, 28.6];

    // 2️⃣ Find nearby “landmarks / attractions / cafes”
    const searchTypes = ["tourist_attraction", "cafe", "museum", "park"];
    const attractionsRes = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${searchTypes.join(
        ","
      )}.json?proximity=${center[0]},${center[1]}&limit=10&access_token=${MAPBOX_TOKEN}`
    );
    const attractions = await attractionsRes.json();

    const places = await Promise.all(
      attractions.features.map(async (p) => {
        const name = p.text;
        const address = p.place_name;
        const [lng, lat] = p.center;

        // 3️⃣ Get Unsplash image
        const imgRes = await fetch(
          `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
            name + " " + city
          )}&client_id=${UNSPLASH_ACCESS_KEY}&per_page=1`
        );
        const imgJson = await imgRes.json();
        const photo = imgJson.results?.[0]?.urls?.regular || null;

        return { name, address, lat, lng, photo, rating: (3.5 + Math.random() * 1.5).toFixed(1) };
      })
    );

    res.json({
      success: true,
      title: `${city} Guide`,
      intro: `Discover the best attractions, cafes, and landmarks around ${city}.`,
      center,
      places,
    });
  } catch (err) {
    console.error("❌ Mapbox TripDetails error:", err);
    res.status(500).json({ success: false, error: "Failed to load trip details" });
  }
});

module.exports = router;
