import React, { useState, useEffect } from 'react'
import Header from './components/Header'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import { useSensorData } from './hooks/useSensorData'
import { SimpleKriging } from './utils/kriging'

function App() {
  const { sensorData, isConnected, sensorCount } = useSensorData()
  const [interpolatedValues, setInterpolatedValues] = useState({})
  const [showInterpolation, setShowInterpolation] = useState(false)
  const [showHeatmap, setShowHeatmap] = useState(false)

  // Default locations for interpolation (only for sensors that exist in sensorData)
  const defaultLocations = {
    'sender1': { lat: -7.7725, lon: 110.3740 },
    'sender2': { lat: -7.7690, lon: 110.3755 },
    'sender9': { lat: -7.7780, lon: 110.3760 }
  }

  // Dynamically create sensor list from actual data
  const stationarySensors = Object.entries(sensorData || {})
    .filter(([id, data]) => data && !data.lat && !data.lon) // Has data but no GPS = stationary
    .map(([id, data]) => ({
      id,
      lat: defaultLocations[id]?.lat || -7.7750,
      lon: defaultLocations[id]?.lon || 110.3760
    }))

  const interpolationPoints = [
    { id: 'interp1', name: 'Campus Gate Area', lat: -7.7715, lon: 110.3760 },
    { id: 'interp2', name: 'Main Road Junction', lat: -7.7740, lon: 110.3775 },
    { id: 'interp3', name: 'Parking Area', lat: -7.7760, lon: 110.3740 },
    { id: 'interp4', name: 'Garden Area', lat: -7.7730, lon: 110.3780 }
  ]

  // Update interpolated values ONLY when sensor data exists in RTDB
  useEffect(() => {
    const kriging = new SimpleKriging()
    
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

    // Only calculate interpolation if we have at least 2 REAL sensors with data
    if (knownPoints.length >= 2) {
      kriging.autoAdjustParameters(knownPoints)
      
      const newInterpolatedValues = {}
      interpolationPoints.forEach(point => {
        const value = kriging.interpolate(
          point.lat, point.lon, knownPoints
        )
        if (value !== null) {
          newInterpolatedValues[point.id] = value
        }
      })
      
      setInterpolatedValues(newInterpolatedValues)
    } else {
      // Clear interpolation if insufficient real data
      setInterpolatedValues({})
    }
  }, [sensorData, stationarySensors])

  const handleToggleInterpolation = (show) => {
    setShowInterpolation(show)
  }

  const handleToggleHeatmap = (show) => {
    setShowHeatmap(show)
  }

  return (
    <div className="App">
      <Header 
        isConnected={isConnected} 
        sensorCount={sensorCount} 
      />
      
      <div className="main-container">
        <MapView
          sensorData={sensorData}
          onToggleInterpolation={handleToggleInterpolation}
          onToggleHeatmap={handleToggleHeatmap}
        />
        
        <Sidebar
          sensorData={sensorData}
          interpolatedValues={interpolatedValues}
        />
      </div>
    </div>
  )
}

export default App
