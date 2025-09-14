import React, { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, LayerGroup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import { SimpleKriging } from '../utils/kriging'

// Fix for default markers in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const MapView = ({ sensorData, onToggleInterpolation, onToggleHeatmap }) => {
  const [showInterpolation, setShowInterpolation] = useState(false)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [interpolatedValues, setInterpolatedValues] = useState({})
  const [heatmapData, setHeatmapData] = useState([])
  const [mobileSensorTrails, setMobileSensorTrails] = useState({}) // Track mobile sensor paths
  const krigingRef = useRef(new SimpleKriging())

  // UGM Campus bounds
  const ugmBounds = {
    north: -7.7700,
    south: -7.7800,
    east: 110.3800,
    west: 110.3700
  }

  // Default locations for sensors without GPS (you can update these with actual coordinates)
  const defaultSensorLocations = {
    'sender1': { lat: -7.7725, lon: 110.3740 },
    'sender2': { lat: -7.7690, lon: 110.3755 },
    'sender9': { lat: -7.7780, lon: 110.3760 }
    // Add more as you deploy new sensors with known locations
  }

  // Dynamically create sensor list from actual Firebase data
  const stationarySensors = Object.entries(sensorData || {})
    .filter(([id, data]) => data && !data.lat && !data.lon) // Has data but no GPS = stationary
    .map(([id, data]) => ({
      id,
      name: id, // Use sender ID as name (sender1, sender2, etc.)
      lat: defaultSensorLocations[id]?.lat || -7.7750, // Default to campus center if unknown
      lon: defaultSensorLocations[id]?.lon || 110.3760
    }))

  // Define interpolation points
  const interpolationPoints = [
    { id: 'interp1', name: 'Campus Gate Area', lat: -7.7715, lon: 110.3760 },
    { id: 'interp2', name: 'Main Road Junction', lat: -7.7740, lon: 110.3775 },
    { id: 'interp3', name: 'Parking Area', lat: -7.7760, lon: 110.3740 },
    { id: 'interp4', name: 'Garden Area', lat: -7.7730, lon: 110.3780 }
  ]

  const getCOColorClass = (coLevel) => {
    if (coLevel <= 9) return 'safe'
    if (coLevel <= 35) return 'moderate'
    if (coLevel <= 100) return 'unhealthy'
    return 'dangerous'
  }

  const getCOColor = (coLevel) => {
    if (coLevel <= 9) return '#22c55e'
    if (coLevel <= 35) return '#eab308'
    if (coLevel <= 100) return '#f97316'
    return '#ef4444'
  }

  const getCOStatus = (coLevel) => {
    if (coLevel <= 9) return 'Safe'
    if (coLevel <= 35) return 'Moderate'
    if (coLevel <= 100) return 'Unhealthy'
    return 'Dangerous'
  }

  // Create custom marker icon
  const createCustomIcon = (coLevel, isMobile = false) => {
    const colorClass = getCOColorClass(coLevel)
    const mobileIcon = isMobile ? '📱' : ''
    
    return L.divIcon({
      className: 'custom-co-marker',
      html: `
        <div style="
          background: white;
          border: 3px solid ${getCOColor(coLevel)};
          border-radius: 50%;
          width: ${isMobile ? '45px' : '40px'};
          height: ${isMobile ? '45px' : '40px'};
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 0.8rem;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          color: #333;
        ">
          ${mobileIcon}${Math.round(coLevel)}
        </div>
      `,
      iconSize: [isMobile ? 45 : 40, isMobile ? 45 : 40],
      iconAnchor: [isMobile ? 22 : 20, isMobile ? 22 : 20]
    })
  }

  // Update interpolated points and mobile sensor trails when sensor data changes
  useEffect(() => {
    const knownPoints = stationarySensors
      .map(sensor => {
        const data = sensorData[sensor.id]
        return data && data.ppm !== undefined ? {
          lat: sensor.lat,
          lon: sensor.lon,
          value: data.ppm
        } : null
      })
      .filter(point => point !== null)

    if (knownPoints.length >= 2) {
      krigingRef.current.autoAdjustParameters(knownPoints)
      
      const newInterpolatedValues = {}
      interpolationPoints.forEach(point => {
        const value = krigingRef.current.interpolate(
          point.lat, point.lon, knownPoints
        )
        if (value !== null) {
          newInterpolatedValues[point.id] = value
        }
      })
      
      setInterpolatedValues(newInterpolatedValues)

      // Generate heatmap data
      if (showHeatmap) {
        const gridData = krigingRef.current.generateInterpolationGrid(
          ugmBounds, knownPoints, 15
        )
        setHeatmapData(gridData)
      }
    }

    // Update mobile sensor trails
    const newTrails = { ...mobileSensorTrails }
    mobileSensors.forEach(([sensorId, data]) => {
      if (!newTrails[sensorId]) {
        newTrails[sensorId] = []
      }
      
      // Add new position to trail (limit to last 50 points)
      const newPosition = [data.lat, data.lon]
      const trail = newTrails[sensorId]
      
      // Check if this is a new position (avoid duplicates)
      const lastPosition = trail[trail.length - 1]
      if (!lastPosition || lastPosition[0] !== newPosition[0] || lastPosition[1] !== newPosition[1]) {
        trail.push(newPosition)
        if (trail.length > 50) {
          trail.shift() // Remove oldest point
        }
      }
    })
    
    setMobileSensorTrails(newTrails)
  }, [sensorData, showHeatmap, mobileSensors])

  const handleToggleInterpolation = () => {
    const newState = !showInterpolation
    setShowInterpolation(newState)
    onToggleInterpolation?.(newState)
  }

  const handleToggleHeatmap = () => {
    const newState = !showHeatmap
    setShowHeatmap(newState)
    onToggleHeatmap?.(newState)
  }

  // Find all mobile sensors (any sensor with GPS coordinates)
  const mobileSensors = Object.entries(sensorData || {}).filter(([id, data]) => 
    data && data.lat && data.lon // Has data and GPS coordinates
  )

  return (
    <div className="map-container">
      <MapContainer
        center={[-7.7750, 110.3760]}
        zoom={16}
        style={{ height: '100%', width: '100%' }}
        className="map"
      >
        {/* Satellite tile layer */}
        <TileLayer
          attribution='© Esri'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={18}
        />
        
        {/* OpenStreetMap overlay for labels */}
        <TileLayer
          attribution='© OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          opacity={0.3}
          maxZoom={18}
        />

        {/* Stationary sensors */}
        {stationarySensors.map(sensor => {
          const data = sensorData[sensor.id]
          if (!data) return null
          
          const coLevel = data.ppm || 0
          return (
            <Marker
              key={sensor.id}
              position={[sensor.lat, sensor.lon]}
              icon={createCustomIcon(coLevel)}
            >
              <Popup>
                <div style={{ textAlign: 'center', minWidth: '200px' }}>
                  <h3 style={{ marginBottom: '10px', color: '#333' }}>{sensor.name}</h3>
                  <div style={{ 
                    fontSize: '24px', 
                    fontWeight: 'bold', 
                    color: getCOColor(coLevel) 
                  }}>
                    {Math.round(coLevel)} ppm
                  </div>
                  <div style={{ fontSize: '14px', color: '#666', margin: '5px 0' }}>
                    Status: {getCOStatus(coLevel)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    Updated: {data.lastUpdate ? data.lastUpdate.toLocaleTimeString() : 'No data'}
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {/* Mobile sensor trails */}
        {Object.entries(mobileSensorTrails).map(([sensorId, trail]) => 
          trail.length > 1 && (
            <Polyline
              key={`trail-${sensorId}`}
              positions={trail}
              pathOptions={{
                color: '#3b82f6',
                weight: 3,
                opacity: 0.7,
                dashArray: '5, 5'
              }}
            />
          )
        )}

        {/* Mobile sensors (any sensor with GPS) */}
        {mobileSensors.map(([sensorId, data]) => (
          <Marker
            key={`mobile-${sensorId}`}
            position={[data.lat, data.lon]}
            icon={createCustomIcon(data.ppm || 0, true)}
          >
            <Popup>
              <div style={{ textAlign: 'center', minWidth: '200px' }}>
                <h3 style={{ marginBottom: '10px', color: '#333' }}>
                  📱 {sensorId}
                </h3>
                <div style={{ 
                  fontSize: '24px', 
                  fontWeight: 'bold', 
                  color: getCOColor(data.ppm || 0) 
                }}>
                  {Math.round(data.ppm || 0)} ppm
                </div>
                <div style={{ fontSize: '14px', color: '#666', margin: '5px 0' }}>
                  Status: {getCOStatus(data.ppm || 0)}
                </div>
                <div style={{ fontSize: '12px', color: '#999' }}>
                  GPS: {data.lat.toFixed(6)}, {data.lon.toFixed(6)}
                </div>
                <div style={{ fontSize: '12px', color: '#999' }}>
                  Updated: {data.lastUpdate?.toLocaleTimeString() || 'No data'}
                </div>
                <div style={{ fontSize: '10px', color: '#999' }}>
                  Trail: {mobileSensorTrails[sensorId]?.length || 0} points
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Interpolation points */}
        {showInterpolation && (
          <LayerGroup>
            {interpolationPoints.map(point => {
              const value = interpolatedValues[point.id]
              if (value === undefined) return null

              return (
                <CircleMarker
                  key={point.id}
                  center={[point.lat, point.lon]}
                  radius={8}
                  fillColor={getCOColor(value)}
                  color={getCOColor(value)}
                  weight={2}
                  opacity={0.7}
                  fillOpacity={0.5}
                >
                  <Popup>
                    <div style={{ textAlign: 'center' }}>
                      <h4>{point.name}</h4>
                      <div>Interpolated Point</div>
                      <div style={{
                        color: getCOColor(value),
                        fontWeight: 'bold',
                        fontSize: '18px'
                      }}>
                        {Math.round(value)} ppm
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {getCOStatus(value)}
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}
          </LayerGroup>
        )}

        {/* Heatmap visualization */}
        {showHeatmap && (
          <LayerGroup>
            {heatmapData.map((point, index) => (
              <CircleMarker
                key={index}
                center={[point.lat, point.lon]}
                radius={50}
                fillColor={getCOColor(point.value)}
                color={getCOColor(point.value)}
                weight={0}
                opacity={0.6}
                fillOpacity={0.4}
              />
            ))}
          </LayerGroup>
        )}
      </MapContainer>

      {/* CO Level Legend */}
      <div className="co-legend">
        <h3>CO Levels (ppm)</h3>
        <div className="legend-items">
          <div className="legend-item">
            <div className="color-box safe"></div>
            <span>0-9: Safe</span>
          </div>
          <div className="legend-item">
            <div className="color-box moderate"></div>
            <span>10-35: Moderate</span>
          </div>
          <div className="legend-item">
            <div className="color-box unhealthy"></div>
            <span>36-100: Unhealthy</span>
          </div>
          <div className="legend-item">
            <div className="color-box dangerous"></div>
            <span>100+: Dangerous</span>
          </div>
        </div>
      </div>

      {/* Map Controls */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <button
          onClick={handleToggleInterpolation}
          className={`btn ${showInterpolation ? 'active' : ''}`}
          style={{ fontSize: '0.8rem', padding: '8px 12px' }}
        >
          {showInterpolation ? 'Hide Interpolation' : 'Show Interpolation'}
        </button>
        <button
          onClick={handleToggleHeatmap}
          className={`btn ${showHeatmap ? 'active' : ''}`}
          style={{ fontSize: '0.8rem', padding: '8px 12px' }}
        >
          {showHeatmap ? 'Hide Heatmap' : 'Show Heatmap'}
        </button>
      </div>
    </div>
  )
}

export default MapView
