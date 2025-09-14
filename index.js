import express from "express";
import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { initializeApp } from "firebase/app";
import { query, getDatabase, ref, onValue, limitToLast, get} from "firebase/database";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Validate required env vars early for clearer errors
const requiredEnv = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'DATABASE_URL',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_APP_ID'
];

const missing = requiredEnv.filter(k => !process.env[k] || process.env[k].trim() === '');
if (missing.length) {
  console.error('\n❌ Missing required environment variables:\n  ' + missing.join('\n  '));
  console.error('\nCreate or edit a .env file based on .env.example.');
  process.exit(1);
}

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.DATABASE_URL?.trim().replace(/\/+$/,'') || undefined, // trim trailing slash
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// --- Express Setup ---
const app = express();
// Allow running even if PORT not defined; default to 3000
const port = process.env.PORT || 3000;

const app_db = initializeApp(firebaseConfig);
const db = getDatabase(app_db);

// Attempt an initial lightweight read to confirm connectivity (non-blocking)
import { child } from "firebase/database";
get(ref(db, '/')).then(snap => {
  console.log(`✅ Firebase connected. Root has keys: ${Object.keys(snap.val() || {}).slice(0,5).join(', ')}`);
}).catch(err => {
  console.warn('⚠️ Firebase initial read failed:', err.message);
});

// Serve static files from React build
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // In production, serve the React build
  app.use(express.static(path.join(__dirname, 'dist')));
} else {
  // In development, serve legacy static files for backward compatibility
  app.use('/static', express.static('public'));
  app.set('view engine', 'ejs');
}

// Health check / main route
app.get("/", (req, res) => {
  if (isProduction) {
    // Serve React app in production
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    // In development, redirect to Vite dev server to avoid legacy EJS
    res.redirect('http://localhost:5173');
  }
});

// API route prefix for clarity
app.get("/api/status", (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    mode: isProduction ? 'production' : 'development'
  });
});
// Database health endpoint
app.get('/api/db/health', async (req, res) => {
  try {
    const dataSource = process.env.USE_SESSION_DATA === 'true' ? 'session_data' : 'sensor_data';
    const sensorSnap = await get(ref(db, dataSource));
    const exists = sensorSnap.exists();
    let keys = [];
    if (exists) {
      const val = sensorSnap.val();
      keys = Object.keys(val).slice(0, 10);
    }
    res.json({
      ok: true,
      databaseURL: process.env.DATABASE_URL,
      dataSource,
      exists,
      sampleKeys: keys
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
app.get("/live-data", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // avoid nginx buffering
  res.flushHeaders?.(); // ensure headers sent immediately

  // Choose data source: "sensor_data" for real-time, "session_data" for averaged
  const dataSource = process.env.USE_SESSION_DATA === 'true' ? "session_data" : "sensor_data";
  const sensorRef = ref(db, dataSource);

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

// Catch-all handler for React routing in production
if (isProduction) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📊 Mode: ${isProduction ? 'production' : 'development'}`);
  console.log(`🌐 Access at: http://localhost:${port}`);
  if (!isProduction) {
    console.log(`⚡ React dev server: npm run client (port 5173)`);
    console.log(`🔄 Full development: npm run dev:full`);
  }
});
