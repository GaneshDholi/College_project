const express = require("express");
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require("../milan-4590e-firebase-adminsdk-bdtkc-0d446a74c2.json")),
    storageBucket: "milan-4590e.appspot.com",
  });
}

router.post("/verify", async (req, res) => {
  try {
    const { idToken } = req.body;
    const decoded = await admin.auth().verifyIdToken(idToken);
    const jwtToken = jwt.sign(decoded, JWT_SECRET, { expiresIn: "7d" });
    res.json({ success: true, token: jwtToken, user: decoded });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

module.exports = router;
