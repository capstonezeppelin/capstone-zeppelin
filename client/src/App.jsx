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
    'sender1': { lat: -7.766910019089596, lon: 110.3764144247782 },
    'sender2': { lat: -7.766858718542408, lon: 110.37700532775817},
    'sender3': { lat: -7.766691086312068, lon: 110.37560958035739},
    'sender4': { lat: -7.767481093269857, lon: 110.37542537150864 },
    'sender5': { lat: -7.767761681590389, lon: 110.37631067373695},
    'sender6': { lat: -7.768020476477149, lon: 110.37720697350848 },
    'sender7': { lat: -7.7671405732116146, lon: 110.37791906443125 },
    'sender8': { lat: -7.76790077435651, lon: 110.37756450256549}
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
