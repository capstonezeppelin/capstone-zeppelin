import React, { useState, useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, LayerGroup, Polyline, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { SimpleKriging } from '../utils/kriging'

// Fix for default markers in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const ClickHandler = ({ bounds, onClick }) => {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng
      const minLat = Math.min(...bounds.map(b => b[0]))
      const maxLat = Math.max(...bounds.map(b => b[0]))
      const minLon = Math.min(...bounds.map(b => b[1]))
      const maxLon = Math.max(...bounds.map(b => b[1]))
      if (lat >= minLat && lat <= maxLat && lng >= minLon && lng <= maxLon) {
        onClick({ lat, lon: lng })
      }
    }
  })
  return null
}

const MapView = ({ sensorData, defaultSensorLocations, bounds, onToggleInterpolation, onPointClick, clickedPoint, clickedValue, setClickedValue }) => {
  const [showInterpolation, setShowInterpolation] = useState(false)
  const [mobileSensorTrails, setMobileSensorTrails] = useState({})
  const krigingRef = useRef(new SimpleKriging())
  const intervalRef = useRef(null)

  // Dynamically create sensor list from actual Firebase data - memoized to avoid recreating on every render
  const stationarySensors = useMemo(() => {
    return Object.entries(sensorData || {})
      .filter(([id, data]) => {
        const idLower = (id || '').toLowerCase()
        return data && !data.lat && !data.lon && !idLower.includes('mobile')
      })
      .map(([id, data]) => ({
        id,
        name: id,
        lat: defaultSensorLocations[id]?.lat || -7.7750,
        lon: defaultSensorLocations[id]?.lon || 110.3760
      }))
  }, [sensorData, defaultSensorLocations])

  // Find all mobile sensors (any sensor with GPS coordinates)
  const mobileSensors = useMemo(() => {
    return Object.entries(sensorData || {}).filter(([id, data]) => {
      const latOk = Number.isFinite(data?.lat)
      const lonOk = Number.isFinite(data?.lon)
      return latOk && lonOk
    })
  }, [sensorData])

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

  // Update mobile sensor trails and recompute clicked point interpolation
  useEffect(() => {
    // Update mobile sensor trails
    setMobileSensorTrails(prevTrails => {
      const newTrails = { ...prevTrails }
      mobileSensors.forEach(([sensorId, data]) => {
        if (!newTrails[sensorId]) {
          newTrails[sensorId] = []
        }
        
        const newPosition = [data.lat, data.lon]
        const trail = newTrails[sensorId]
        
        const lastPosition = trail[trail.length - 1]
        if (!lastPosition || lastPosition[0] !== newPosition[0] || lastPosition[1] !== newPosition[1]) {
          trail.push(newPosition)
          if (trail.length > 50) {
            trail.shift()
          }
        }
      })
      return newTrails
    })

    // Recompute clicked point value whenever sensorData changes
    if (clickedPoint) {
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

      // Check if mobile1 within 100m - if so, use mobile1 data instead of interpolation
      const mobile = mobileSensors.find(([id]) => id.toLowerCase() === 'mobile1')
      if (mobile && knownPoints.length >= 2) {
        const [, m] = mobile
        const dist = krigingRef.current.calculateDistance(clickedPoint.lat, clickedPoint.lon, m.lat, m.lon)
        if (dist <= 100) {
          setClickedValue(m.ppm || 0)
        } else {
          krigingRef.current.autoAdjustParameters(knownPoints)
          const v = krigingRef.current.interpolate(clickedPoint.lat, clickedPoint.lon, knownPoints)
          if (v !== null) setClickedValue(v)
        }
      } else if (knownPoints.length >= 2) {
        krigingRef.current.autoAdjustParameters(knownPoints)
        const v = krigingRef.current.interpolate(clickedPoint.lat, clickedPoint.lon, knownPoints)
        if (v !== null) setClickedValue(v)
      }
    }
  }, [sensorData, mobileSensors, clickedPoint, setClickedValue, stationarySensors])

  const handleToggleInterpolation = () => {
    const newState = !showInterpolation
    setShowInterpolation(newState)
    onToggleInterpolation?.(newState)
  }

  return (
    <div className="map-container">
      <MapContainer
        center={[-7.767299023452005, 110.37659430350615]}
        zoom={18}
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

        <ClickHandler bounds={bounds} onClick={onPointClick} />

        {/* Clicked interpolation point */}
        {clickedPoint && clickedValue !== null && (
          <LayerGroup>
            <CircleMarker
              center={[clickedPoint.lat, clickedPoint.lon]}
              radius={8}
              fillColor={getCOColor(clickedValue)}
              color={getCOColor(clickedValue)}
              weight={2}
              opacity={0.7}
              fillOpacity={0.5}
            >
              <Popup>
                <div style={{ textAlign: 'center' }}>
                  <h4>Clicked Point</h4>
                  <div>Interpolated Point</div>
                  <div style={{
                    color: getCOColor(clickedValue),
                    fontWeight: 'bold',
                    fontSize: '18px'
                  }}>
                    {clickedValue.toFixed(1)} ppm
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {getCOStatus(clickedValue)}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
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
    </div>
  )
}

export default MapView
