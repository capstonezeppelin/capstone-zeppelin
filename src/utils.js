function sanitizeSensorRow(raw, id = null) {
  return {
    id: id || raw.id || raw.sensorId || null,
    lat: Number(raw.lat),
    lng: Number(raw.lng),
    co_value: raw.co_ppm !== undefined ? Number(raw.co_ppm) : null,
    predicted_co_value: raw.predicted_co_ppm !== undefined ? Number(raw.predicted_co_ppm) : null,
    ts: raw.timestamp || Date.now()
  };
}

module.exports = { sanitizeSensorRow };
