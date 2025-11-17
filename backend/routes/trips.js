const express = require("express");
const fetch = require("node-fetch");

module.exports = (db, bucket) => {
  const router = express.Router();

  // 🔹 Your Unsplash API key (from .env)
  const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY || "your_unsplash_key_here";

  // ✅ Get image (Firebase → Unsplash fallback)
  router.get("/image", async (req, res) => {
    try {
      const { path } = req.query;
      if (!path) return res.status(400).json({ error: "Missing file path" });

      const file = bucket.file(path);
      const [exists] = await file.exists();

      // 🖼️ CASE 1: File exists in Firebase → get signed URL
      if (exists) {
        const [url] = await file.getSignedUrl({
          version: "v4",
          action: "read",
          expires: Date.now() + 10 * 60 * 1000,
        });
        return res.json({ success: true, url });
      }

      // 🌆 CASE 2: Fallback to Unsplash if file missing
      const cityOrPlace = decodeURIComponent(path.split("/").pop().split(".")[0]); // e.g. "Jaipur" from "trips/popular/Jaipur.jpg"
      console.warn(`⚠️ File not found in bucket. Fetching Unsplash image for: ${cityOrPlace}`);

      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
          cityOrPlace + " city travel"
        )}&orientation=landscape&per_page=20&client_id=${UNSPLASH_KEY}`
      );
      const json = await response.json();

      const photo =
        json.results?.[0]?.urls?.regular ||
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e";

      res.json({ success: true, url: photo });
    } catch (err) {
      console.error("❌ Error generating image URL:", err);
      res.status(500).json({
        success: false,
        error: err.message,
        fallback: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
      });
    }
  });

  // ✅ Fetch trips list (no change)
  router.get("/:category", async (req, res) => {
    try {
      const { category } = req.params;
      if (!["recent", "popular"].includes(category)) {
        return res.status(400).json({ error: "Invalid category" });
      }

      const snapshot = await db
        .collection("trips")
        .doc("itineraries")
        .collection(category)
        .get();

      const trips = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      res.json({ success: true, count: trips.length, trips });
    } catch (err) {
      console.error("❌ Error fetching trips:", err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
