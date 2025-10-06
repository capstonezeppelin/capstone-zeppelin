import React, { useState, useCallback } from 'react'
import Header from './components/Header'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import { useSensorData } from './hooks/useSensorData'

function App() {
  const { sensorData, isConnected, sensorCount } = useSensorData()
  const [showInterpolation, setShowInterpolation] = useState(false)
  const [clickedPoint, setClickedPoint] = useState(null)
  const [clickedValue, setClickedValue] = useState(null)

  // Default locations for all 8 sensors
  const defaultSensorLocations = {
    'sender1': { lat: -7.764729, lon: 110.376655},
    'sender2': { lat: -7.767512, lon: 110.378690},
    'sender3': { lat: -7.768433, lon: 110.382745},
    'sender4': { lat: -7.765948, lon: 110.373671},
    'sender5': { lat: -7.771038, lon: 110.378416},
    'sender6': { lat: -7.771900, lon: 110.381235},
    'sender7': { lat: -7.771218, lon: 110.374818},
    'sender8': { lat: -7.775635, lon: 110.376152}
  }

  // Bounds defined by corner sensors (sender1, sender3, sender4, sender8)
  const bounds = [
    [defaultSensorLocations.sender1.lat, defaultSensorLocations.sender1.lon],
    [defaultSensorLocations.sender3.lat, defaultSensorLocations.sender3.lon],
    [defaultSensorLocations.sender8.lat, defaultSensorLocations.sender8.lon],
    [defaultSensorLocations.sender4.lat, defaultSensorLocations.sender4.lon]
  ]

  const handleToggleInterpolation = (show) => {
    setShowInterpolation(show)
  }

  const handlePointClick = useCallback((pt) => {
    setClickedPoint(pt)
  }, [])

  return (
    <div className="App">
      <Header 
        isConnected={isConnected} 
        sensorCount={sensorCount} 
      />
      
      <div className="main-container">
        <MapView
          sensorData={sensorData}
          defaultSensorLocations={defaultSensorLocations}
          bounds={bounds}
          onToggleInterpolation={handleToggleInterpolation}
          onPointClick={handlePointClick}
          clickedPoint={clickedPoint}
          clickedValue={clickedValue}
          setClickedValue={setClickedValue}
        />
        
        <Sidebar
          sensorData={sensorData}
          clickedPoint={clickedPoint}
          clickedValue={clickedValue}
        />
      </div>
    </div>
  )
}

export default App
