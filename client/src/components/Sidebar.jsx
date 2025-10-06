import React from 'react'

const Sidebar = ({ sensorData, clickedPoint, clickedValue }) => {
  // Completely dynamic - only show sensors that have actual data
  const stationarySensors = Object.entries(sensorData || {})
    .filter(([id, data]) => {
      const idLower = (id || '').toLowerCase()
      return data && !data.lat && !data.lon && !idLower.includes('mobile')
    })
    .map(([id, data]) => ({
      id,
      name: id
    }))

  const getCOColorClass = (coLevel) => {
    if (coLevel <= 9) return 'safe'
    if (coLevel <= 35) return 'moderate'
    if (coLevel <= 100) return 'unhealthy'
    return 'dangerous'
  }

  // Find all mobile sensors (any with GPS)
  const mobileSensors = Object.entries(sensorData || {}).filter(([id, data]) => {
    return data && data.lat && data.lon
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
                sensor={{ name: sensorId }}
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
        <h2>🧮 Interpolated Point</h2>
        <div className="sensor-list">
          {clickedPoint && clickedValue !== null ? (
            <div className={`sensor-item ${getCOColorClass(clickedValue)}`}>
              <span className="sensor-name">Clicked Point</span>
              <span className="sensor-value">{clickedValue.toFixed(1)} ppm</span>
              <div className="sensor-location">GPS: {clickedPoint.lat.toFixed(5)}, {clickedPoint.lon.toFixed(5)}</div>
              <div className="sensor-timestamp">Interpolated</div>
            </div>
          ) : (
            <div className="sensor-item">
              <span className="sensor-name">No point clicked</span>
              <span className="sensor-value">-- ppm</span>
              <div className="sensor-timestamp">Click within bounds to interpolate</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Sidebar
