import express from "express";
import admin from "firebase-admin";
import fs from "fs";
import { initializeApp } from "firebase/app";
import { query, getDatabase, ref, onValue, limitToLast, get} from "firebase/database";
import dotenv from "dotenv";

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.DATABASE_URL, // ✅ goes here
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// --- Express Setup ---
const app = express();
const port = process.env.PORT;

const app_db = initializeApp(firebaseConfig);
const db = getDatabase(app_db);

// Health check
app.get("/", async (req, res) => {
  try {
    const snapshot = await get(ref(db, "sensor_data"));
    if (!snapshot.exists()) {
      return res.status(404).json({ error: "No data found" });
    }

    const data = snapshot.val();
    const latestPerSensor = {};

    Object.entries(data).forEach(([sensorId, readings]) => {
      const keys = Object.keys(readings);
      const latestKey = keys.sort().pop(); // last key
      latestPerSensor[sensorId] = readings[latestKey];
    });

    res.render("index.ejs", { sensors: latestPerSensor });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch latest data" });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
