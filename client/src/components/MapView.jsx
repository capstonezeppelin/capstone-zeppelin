import React, { useState, useEffect, useRef, useMemo } from 'react'
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
  const [interpolatedValues, setInterpolatedValues] = useState({})
  const [mobileSensorTrails, setMobileSensorTrails] = useState({}) // Track mobile sensor paths
  const krigingRef = useRef(new SimpleKriging())
  const intervalRef = useRef(null)

  // UGM Campus bounds
  const ugmBounds = {
    north: -7.7700,
    south: -7.7800,
    east: 110.3800,
    west: 110.3700
  }

  // Default locations for sensors without GPS (you can update these with actual coordinates)
  const defaultSensorLocations = {
    'sender1': { lat: -7.764729, lon: 110.376655},
    'sender2': { lat: -7.767512, lon: 110.378690},
    'sender3': { lat: -7.768433, lon: 110.382745},
    'sender4': { lat: -7.765948, lon: 110.373671},
    'sender5': { lat: -7.771038, lon: 110.378416},
    'sender6': { lat: -7.771900, lon: 110.381235},
    'sender7': { lat: -7.771218, lon: 110.374818},
    'sender8': { lat: -7.775635, lon: 110.376152}, 
    // 'sender9': { lat: -7.771038, lon: 110.378416}
    // Add more as you deploy new sensors with known locations
  }
  // Dynamically create sensor list from actual Firebase data (only sensors with data, no GPS)
  const stationarySensors = Object.entries(sensorData || {})
    .filter(([id, data]) => {
      const idLower = (id || '').toLowerCase()
      return data && !data.lat && !data.lon && !idLower.includes('mobile') && idLower !== 'sender9' && idLower !== 'sender10'
    })
    .map(([id]) => ({
      id,
      name: id,
      lat: defaultSensorLocations[id]?.lat || -7.7750,
      lon: defaultSensorLocations[id]?.lon || 110.3760
    }))

  // Dev-only: log which coordinates are used for stationary sensors
  useEffect(() => {
    if (import.meta?.env?.MODE === 'development') {
      try {
        // eslint-disable-next-line no-console
        console.table(stationarySensors.map(s => ({ id: s.id, lat: s.lat, lon: s.lon })))
      } catch {}
    }
  }, [stationarySensors])

  // Find all mobile sensors (any sensor with GPS coordinates)
  const mobileSensors = useMemo(() => {
    return Object.entries(sensorData || {}).filter(([id, data]) => {
      const latOk = Number.isFinite(data?.lat)
      const lonOk = Number.isFinite(data?.lon)
      return latOk && lonOk
    })
  }, [sensorData])

  // Define interpolation points
  const interpolationPoints = [
    { id: 'interp1', name: 'Bike Station MIPA', lat: -7.767307383797572, lon: 110.37465007202256},
    { id: 'interp2', name: 'FISIPOL', lat: -7.7693064837342165, lon: 110.38019968413481 },
    { id: 'interp3', name: 'F11', lat: -7.77325438032399, lon: 110.37778592390757 }
  ]

  // Sensor subsets per interpolation point
  const interpolationSubsets = {
    interp1: ['sender1', 'sender4'],
    interp2: ['sender2', 'sender3', 'sender5', 'sender6'],
    interp3: ['sender5', 'sender6', 'sender7', 'sender8']
  }

  const toRadians = (deg) => deg * Math.PI / 180
  const haversineMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000
    const dLat = toRadians(lat2 - lat1)
    const dLon = toRadians(lon2 - lon1)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  const buildKnownPointsForPoint = (point) => {
    const subsetIds = interpolationSubsets[point.id] || []
    const subsetPoints = subsetIds
      .map(id => {
        const data = sensorData[id]
        const loc = defaultSensorLocations[id]
        if (!data || data.ppm === undefined || !loc) return null
        return { id, lat: loc.lat, lon: loc.lon, value: data.ppm }
      })
      .filter(Boolean)

    const distances = subsetPoints.map(p => haversineMeters(point.lat, point.lon, p.lat, p.lon))
    const maxSubsetDistance = distances.length > 0 ? Math.max(...distances) : 0

    const mobileEntry = Object.entries(sensorData || {}).find(([sid, d]) => 
      (sid === 'mobile1' || sid.toLowerCase().includes('mobile1')) && d && d.lat && d.lon && d.ppm !== undefined
    )
    if (mobileEntry && maxSubsetDistance > 0) {
      const [sid, d] = mobileEntry
      const mobileDistance = haversineMeters(point.lat, point.lon, d.lat, d.lon)
      if (mobileDistance <= maxSubsetDistance) {
        subsetPoints.push({ id: sid, lat: d.lat, lon: d.lon, value: d.ppm })
      }
    }

    return subsetPoints.map(p => ({ lat: p.lat, lon: p.lon, value: p.value }))
  }

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
    const mobileIcon = isMobile ? '' : ''
    
    return L.divIcon({
      // Include Leaflet default div icon class
      className: 'custom-co-marker leaflet-div-icon',
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
          pointer-events: auto;
        ">
          ${mobileIcon}${coLevel.toFixed(1)}
        </div>
      `,
      iconSize: [isMobile ? 45 : 40, isMobile ? 45 : 40],
      iconAnchor: [isMobile ? 22 : 20, isMobile ? 22 : 20]
    })
  }

  // Update interpolated points (every 5s) and mobile sensor trails when sensor data changes
  useEffect(() => {
    const computeInterpolations = () => {
      const newInterpolatedValues = {}
      interpolationPoints.forEach(point => {
        const knownPoints = buildKnownPointsForPoint(point)
        if (knownPoints.length >= 2) {
          krigingRef.current.autoAdjustParameters(knownPoints)
          const value = krigingRef.current.interpolate(point.lat, point.lon, knownPoints)
          if (value !== null) newInterpolatedValues[point.id] = value
        }
      })
      setInterpolatedValues(newInterpolatedValues)
    }

    // Run immediately and then every 2 seconds
    computeInterpolations()
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(computeInterpolations, 2000)

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

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [sensorData])

  const handleToggleInterpolation = () => {
    const newState = !showInterpolation
    setShowInterpolation(newState)
    onToggleInterpolation?.(newState)
  }

  // Heatmap removed

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
              eventHandlers={{
                click: (e) => e.target.openPopup(),
                mouseover: (e) => e.target.openPopup(),
                mouseout: (e) => e.target.closePopup()
              }}
            >
              <Popup>
                <div style={{ textAlign: 'center', minWidth: '200px' }}>
                  <h3 style={{ marginBottom: '10px', color: '#333' }}>{sensor.name}</h3>
                  <div style={{ 
                    fontSize: '24px', 
                    fontWeight: 'bold', 
                    color: getCOColor(coLevel) 
                  }}>
                    {coLevel.toFixed(1)} ppm
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
            eventHandlers={{
              click: (e) => e.target.openPopup(),
              mouseover: (e) => e.target.openPopup(),
              mouseout: (e) => e.target.closePopup()
            }}
          >
            <Popup>
              <div style={{ textAlign: 'center', minWidth: '200px' }}>
                <h3 style={{ marginBottom: '10px', color: '#333' }}>
                  {sensorId}
                </h3>
                <div style={{ 
                  fontSize: '24px', 
                  fontWeight: 'bold', 
                  color: getCOColor(data.ppm || 0) 
                }}>
                  {(data.ppm || 0).toFixed(1)} ppm
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
                        {value.toFixed(1)} ppm
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

        {/* Heatmap removed */}
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
        {/* Heatmap control removed */}
      </div>
    </div>
  )
}

export default MapView
