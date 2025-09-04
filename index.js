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
app.get("/", (req, res) => {
  res.render("index.ejs");
})
app.get("/live-data", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // avoid nginx buffering
  res.flushHeaders?.(); // ensure headers sent immediately

  const sensorRef = ref(db, "sensor_data");

  const unsubscribe = onValue(sensorRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const latestPerSensor = {};

      Object.entries(data).forEach(([sensorId, readings]) => {
        const keys = Object.keys(readings);
        const latestKey = keys.sort().pop();
        latestPerSensor[sensorId] = readings[latestKey];
      });

      res.write(`data: ${JSON.stringify(latestPerSensor)}\n\n`);
      res.flush?.(); // force flush if available
    }
  });

  req.on("close", () => {
    unsubscribe();
    res.end();
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
