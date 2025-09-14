import React from 'react'

const Sidebar = ({ sensorData, interpolatedValues }) => {
  // Completely dynamic - only show sensors that have actual data
  const stationarySensors = Object.entries(sensorData || {})
    .filter(([id, data]) => data && !data.lat && !data.lon) // Has data but no GPS = stationary
    .map(([id, data]) => ({
      id,
      name: id // Use the sender ID as the name (sender1, sender2, etc.)
    }))

  // Define interpolation points
  const interpolationPoints = [
    { id: 'interp1', name: 'Campus Gate Area' },
    { id: 'interp2', name: 'Main Road Junction' },
    { id: 'interp3', name: 'Parking Area' },
    { id: 'interp4', name: 'Garden Area' }
  ]

  const getCOColorClass = (coLevel) => {
    if (coLevel <= 9) return 'safe'
    if (coLevel <= 35) return 'moderate'
    if (coLevel <= 100) return 'unhealthy'
    return 'dangerous'
  }

  // Find all mobile sensors (any with GPS)
  const mobileSensors = Object.entries(sensorData || {}).filter(([id, data]) => 
    data && data.lat && data.lon
  )

  const SensorItem = ({ sensor, data, type }) => {
    const coLevel = data?.ppm || 0
    const colorClass = getCOColorClass(coLevel)
    const isOnline = data?.isOnline !== false

    return (
      <div className={`sensor-item ${isOnline ? colorClass : ''}`}>
        <span className="sensor-name">{sensor.name}</span>
        <span className="sensor-value">
          {isOnline ? `${Math.round(coLevel)} ppm` : '-- ppm'}
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
        <h2>🧮 Interpolated Points</h2>
        <div className="sensor-list">
          {Object.keys(interpolatedValues || {}).length > 0 ? (
            interpolationPoints
              .filter(point => {
                const value = interpolatedValues[point.id]
                return value !== undefined && value !== null
              })
              .map(point => {
                const value = interpolatedValues[point.id]
                return (
                  <div
                    key={point.id}
                    className={`sensor-item ${getCOColorClass(value)}`}
                  >
                    <span className="sensor-name">{point.name}</span>
                    <span className="sensor-value">{Math.round(value)} ppm</span>
                    <div className="sensor-timestamp">Interpolated</div>
                  </div>
                )
              })
          ) : (
            <div className="sensor-item">
              <span className="sensor-name">No Interpolation Available</span>
              <span className="sensor-value">-- ppm</span>
              <div className="sensor-timestamp">Need 2+ sensors for interpolation</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Sidebar
