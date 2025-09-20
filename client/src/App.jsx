import React, { useState, useEffect, useRef } from 'react'
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
  const intervalRef = useRef(null)

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
    { id: 'interp2', name: 'FISIPOL', lat: -7.7693064837342165, lon: 110.38019968413481 },
    { id: 'interp3', name: 'F11', lat: -7.77325438032399, lon: 110.37778592390757}
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

  // Build known points for a given interpolation point with subset + conditional mobile1
  const buildKnownPointsForPoint = (point) => {
    const subsetIds = interpolationSubsets[point.id] || []
    // Stationary subset with data
    const subsetPoints = subsetIds
      .map(id => {
        const data = sensorData[id]
        const loc = defaultSensorLocations[id]
        if (!data || data.ppm === undefined || !loc) return null
        return { id, lat: loc.lat, lon: loc.lon, value: data.ppm }
      })
      .filter(Boolean)

    // Compute threshold: farthest distance among subset sensors
    const distances = subsetPoints.map(p => haversineMeters(point.lat, point.lon, p.lat, p.lon))
    const maxSubsetDistance = distances.length > 0 ? Math.max(...distances) : 0

    // Find mobile1 if present
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

    // Return only lat/lon/value for interpolation libs
    return subsetPoints.map(p => ({ lat: p.lat, lon: p.lon, value: p.value }))
  }

  // Update interpolated values for all methods every 5 seconds using latest data
  useEffect(() => {
    const kriging = new SimpleKriging()
    const rbf = new RBFThinPlateSpline({ lambda: 1e-6 })
    const knn = new KNNRegressor({ k: 3, power: 1 })

    const computeAll = () => {
      const newInterpolatedValues = {}
      const newInterpolatedValuesRBF = {}
      const newInterpolatedValuesKNN = {}

      interpolationPoints.forEach(point => {
        const knownPoints = buildKnownPointsForPoint(point)
        if (knownPoints.length >= 2) {
          kriging.autoAdjustParameters(knownPoints)
          const vKrig = kriging.interpolate(point.lat, point.lon, knownPoints)
          const vRBF = rbf.interpolate(point.lat, point.lon, knownPoints)
          const vKNN = knn.interpolate(point.lat, point.lon, knownPoints)
          if (vKrig !== null) newInterpolatedValues[point.id] = vKrig
          if (vRBF !== null) newInterpolatedValuesRBF[point.id] = vRBF
          if (vKNN !== null) newInterpolatedValuesKNN[point.id] = vKNN
        }
      })

      setInterpolatedValues(newInterpolatedValues)
      setInterpolatedValuesRBF(newInterpolatedValuesRBF)
      setInterpolatedValuesKNN(newInterpolatedValuesKNN)
    }

    // Run immediately and then every 2 seconds
    computeAll()
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(computeAll, 2000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [sensorData])

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
