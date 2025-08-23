require('dotenv').config();
import express from "express";
import http from "http";
import cors from "cors";
import bodyParser from "body-parser";
import socketIo from "socket.io";
import db from "./firebase";
import sanitizeSensorRow from "./utils"
import sensorsRoutes from "./routes/sensors.js";
const sensors = sensorsRoutes({ db, sanitizeSensorRow });

const app = express();
const server = http.createServer(app);
const io = new socketIo.Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/api/sensors', sensorsRoutes);

// Health check
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// --- Real-time Firebase listeners ---
const sensorsRef = db.ref('sensors');

sensorsRef.on('child_changed', snapshot => {
  const sensor = sanitizeSensorRow(snapshot.val(), snapshot.key);
  io.emit('sensor_update', sensor);
});

sensorsRef.on('child_added', snapshot => {
  const sensor = sanitizeSensorRow(snapshot.val(), snapshot.key);
  io.emit('sensor_added', sensor);
});

sensorsRef.on('child_removed', snapshot => {
  io.emit('sensor_removed', { id: snapshot.key });
});

// --- Socket.IO client connection ---
io.on('connection', async socket => {
  console.log('Client connected:', socket.id);

  // Send current snapshot
  const snap = await db.ref('sensors').once('value');
  const sensors = Object.entries(snap.val() || {}).map(([id, val]) => sanitizeSensorRow(val, id));
  socket.emit('sensors_snapshot', sensors);
});

// Start server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
