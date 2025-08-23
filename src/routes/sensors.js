const express = require('express');
const router = express.Router();

module.exports = ({ db, sanitizeSensorRow }) => {
  // GET /api/sensors -> all current sensors
  router.get('/', async (req, res) => {
    try {
      const snapshot = await db.ref('sensors').once('value');
      const raw = snapshot.val() || {};
      const arr = Object.entries(raw).map(([id, val]) => sanitizeSensorRow(val, id));
      res.json({ sensors: arr });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'failed to fetch sensors' });
    }
  });

  // GET /api/sensors/:id -> single sensor
  router.get('/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const snap = await db.ref(`sensors/${id}`).once('value');
      if (!snap.exists()) return res.status(404).json({ error: 'not found' });
      const sensor = sanitizeSensorRow(snap.val(), id);
      res.json({ sensor });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'failed to fetch sensor' });
    }
  });

  return router;
};
