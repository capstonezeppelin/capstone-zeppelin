import React, { useState, useEffect } from 'react'
import Header from './components/Header'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import { useSensorData } from './hooks/useSensorData'
import { SimpleKriging } from './utils/kriging'
import { RBFThinPlateSpline } from './utils/rbf_tps'
import { KNNRegressor } from './utils/knn'

function App() {
  const { sensorData, isConnected, sensorCount } = useSensorData()
  const [interpolatedValues, setInterpolatedValues] = useState({})
  const [interpolatedValuesRBF, setInterpolatedValuesRBF] = useState({})
  const [interpolatedValuesKNN, setInterpolatedValuesKNN] = useState({})
  const [showInterpolation, setShowInterpolation] = useState(false)

  // Default locations for interpolation (only for sensors that exist in sensorData)
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
  // Dynamically create sensor list from actual data
  const stationarySensors = Object.entries(sensorData || {})
    .filter(([id, data]) => data && !data.lat && !data.lon) // Has data but no GPS = stationary
    .map(([id, data]) => ({
      id,
      lat: defaultSensorLocations[id]?.lat || -7.7750,
      lon: defaultSensorLocations[id]?.lon || 110.3760
    }))

  const interpolationPoints = [
    { id: 'interp1', name: 'Bike Station MIPA', lat: -7.767307383797572, lon: 110.37465007202256},
    { id: 'interp2', name: 'Fisipol', lat: -7.7693064837342165, lon: 110.38019968413481 },
    { id: 'interp3', name: 'Parking Area', lat: -7.77325438032399, lon: 110.37778592390757}
  ]

  // Update interpolated values for all methods when sensor data exists in RTDB
  useEffect(() => {
    const kriging = new SimpleKriging()
    const rbf = new RBFThinPlateSpline({ lambda: 1e-6 })
    const knn = new KNNRegressor({ k: 3, power: 1 })
    
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
      const newInterpolatedValuesRBF = {}
      const newInterpolatedValuesKNN = {}
      interpolationPoints.forEach(point => {
        const vKrig = kriging.interpolate(point.lat, point.lon, knownPoints)
        const vRBF = rbf.interpolate(point.lat, point.lon, knownPoints)
        const vKNN = knn.interpolate(point.lat, point.lon, knownPoints)
        if (vKrig !== null) newInterpolatedValues[point.id] = vKrig
        if (vRBF !== null) newInterpolatedValuesRBF[point.id] = vRBF
        if (vKNN !== null) newInterpolatedValuesKNN[point.id] = vKNN
      })
      
      setInterpolatedValues(newInterpolatedValues)
      setInterpolatedValuesRBF(newInterpolatedValuesRBF)
      setInterpolatedValuesKNN(newInterpolatedValuesKNN)
    } else {
      setInterpolatedValues({})
      setInterpolatedValuesRBF({})
      setInterpolatedValuesKNN({})
    }
  }, [sensorData, stationarySensors])

  const handleToggleInterpolation = (show) => {
    setShowInterpolation(show)
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
        />
        
        <Sidebar
          sensorData={sensorData}
          interpolatedValues={{ kriging: interpolatedValues, rbf: interpolatedValuesRBF, knn: interpolatedValuesKNN }}
        />
      </div>
    </div>
  )
}

export default App
