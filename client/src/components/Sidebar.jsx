import React from 'react'

const Sidebar = ({ sensorData, interpolatedValues }) => {
  // Completely dynamic - only show sensors that have actual data
  const stationarySensors = Object.entries(sensorData || {})
    .filter(([id, data]) => {
      const idLower = (id || '').toLowerCase()
      return data && !data.lat && !data.lon && !idLower.includes('mobile') && idLower !== 'sender9' && idLower !== 'sender10'
    }) // Has data but no GPS = stationary
    .map(([id, data]) => ({
      id,
      name: id // Use the sender ID as the name (sender1, sender2, etc.)
    }))

  // Define interpolation points
  const interpolationPoints = [
    { id: 'interp1', name: 'Bike Station MIPA' },
    { id: 'interp2', name: 'FISIPOL' },
    { id: 'interp3', name: 'F11' }
  ]

  const getCOColorClass = (coLevel) => {
    if (coLevel <= 9) return 'safe'
    if (coLevel <= 35) return 'moderate'
    if (coLevel <= 100) return 'unhealthy'
    return 'dangerous'
  }

  // Find all mobile sensors (any with GPS)
  const mobileSensors = Object.entries(sensorData || {}).filter(([id, data]) => {
    const idLower = (id || '').toLowerCase()
    if (idLower === 'sender9' || idLower === 'sender10') return false
    return data && (idLower.includes('mobile') || (data.lat && data.lon))
  })

  const SensorItem = ({ sensor, data, type }) => {
    const coLevel = data?.ppm || 0
    const colorClass = getCOColorClass(coLevel)
    const isOnline = data?.isOnline !== false

    return (
      <div className={`sensor-item ${isOnline ? colorClass : ''}`}>
        <span className="sensor-name">{sensor.name}</span>
        <span className="sensor-value">
          {isOnline ? `${coLevel.toFixed(1)} ppm` : '-- ppm'}
        </span>
        {type === 'mobile' && data?.lat && (
          <div className="sensor-location">
            GPS: {data.lat.toFixed(4)}, {data.lon.toFixed(4)}
          </div>
        )}
        <div className="sensor-timestamp">
          {isOnline && data?.lastUpdate 
            ? data.lastUpdate.toLocaleTimeString() 
            : type === 'interpolated' 
              ? 'Interpolated' 
              : 'No data'
          }
        </div>
      </div>
    )
  }

  return (
    <div className="sidebar">
      <div className="sensor-panel">
        <h2>📍 Stationary Sensors</h2>
        <div className="sensor-list">
          {stationarySensors.map(sensor => {
            const data = sensorData[sensor.id]
            return (
              <SensorItem
                key={sensor.id}
                sensor={sensor}
                data={data}
                type="stationary"
              />
            )
          })}
        </div>
      </div>

      <div className="sensor-panel">
        <h2>🚗 Moving Sensor</h2>
        <div className="sensor-list">
          {mobileSensors.length > 0 ? (
            mobileSensors.map(([sensorId, data]) => (
              <SensorItem
                key={sensorId}
                sensor={{ name: sensorId }} // Just use the sender ID (sender1, sender2, etc.)
                data={data}
                type="mobile"
              />
            ))
          ) : (
            <div className="sensor-item">
              <span className="sensor-name">No Moving Sensor</span>
              <span className="sensor-value">-- ppm</span>
              <div className="sensor-location">GPS: No moving sensor detected</div>
              <div className="sensor-timestamp">Waiting for sensor with GPS data</div>
            </div>
          )}
        </div>
      </div>

      <div className="sensor-panel">
        <h2>🧮 Interpolated (Kriging / RBF-TPS / KNN)</h2>
        <div className="sensor-list">
          {interpolatedValues && (interpolatedValues.kriging || interpolatedValues.rbf || interpolatedValues.knn) ? (
            interpolationPoints.map(point => {
              const vK = interpolatedValues.kriging?.[point.id]
              const vR = interpolatedValues.rbf?.[point.id]
              const vN = interpolatedValues.knn?.[point.id]
              const display = [
                vK !== undefined ? `K: ${vK.toFixed(1)}` : null,
                vR !== undefined ? `R: ${vR.toFixed(1)}` : null,
                vN !== undefined ? `N: ${vN.toFixed(1)}` : null
              ].filter(Boolean).join(' | ')

              const colorBase = vK ?? vR ?? vN
              if (colorBase === undefined) return (
                <div key={point.id} className="sensor-item">
                  <span className="sensor-name">{point.name}</span>
                  <span className="sensor-value">--</span>
                  <div className="sensor-timestamp">Need 2+ sensors</div>
                </div>
              )

              return (
                <div key={point.id} className={`sensor-item ${getCOColorClass(colorBase)}`}>
                  <span className="sensor-name">{point.name}</span>
                  <span className="sensor-value">{display} ppm</span>
                  <div className="sensor-timestamp">Interpolated (K/R/N)</div>
                </div>
              )
            })
          ) : (
            <div className="sensor-item">
              <span className="sensor-name">No Interpolation Available</span>
              <span className="sensor-value">--</span>
              <div className="sensor-timestamp">Need 2+ sensors</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Sidebar
