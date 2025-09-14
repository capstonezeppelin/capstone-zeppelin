import { useState, useEffect, useRef } from 'react'

export const useSensorData = () => {
  const [sensorData, setSensorData] = useState({})
  const [isConnected, setIsConnected] = useState(false)
  const [sensorCount, setSensorCount] = useState({ online: 0, total: 0 }) // Dynamic count
  const eventSourceRef = useRef(null)

  const parseSensorData = (rawData) => {
    const parsed = { ppm: 0, lat: null, lon: null, voltage: null, analog: null, timestamp: null }
    
    if (typeof rawData === 'object') {
      // Handle your actual Firebase data format
      parsed.ppm = parseFloat(rawData.ppm) || parseFloat(rawData.last_ppm) || rawData.PPM || rawData.value || 0
      parsed.lat = rawData.lat || rawData.GPSLat || null
      parsed.lon = rawData.lon || rawData.GPSLng || null
      parsed.voltage = parseFloat(rawData.voltage) || parseFloat(rawData.last_voltage) || null
      parsed.analog = rawData.mq7_analog || rawData.last_mq7_analog || null
      parsed.timestamp = rawData.unix_timestamp || rawData.session_timestamp || null
    } else if (typeof rawData === 'string') {
      // Handle string format from hardware (fallback)
      const parts = rawData.split(',')
      parts.forEach(part => {
        const [key, value] = part.split('=')
        if (key && value) {
          switch (key.trim().toLowerCase()) {
            case 'ppm':
              parsed.ppm = parseFloat(value)
              break
            case 'gpslat':
            case 'lat':
              parsed.lat = value === 'NoFix' ? null : parseFloat(value)
              break
            case 'gpslng':
            case 'lng':
            case 'lon':
              parsed.lon = value === 'NoFix' ? null : parseFloat(value)
              break
          }
        }
      })
    }
    
    return parsed
  }

  const connectToDataStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const eventSource = new EventSource('/live-data')
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setIsConnected(true)
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const processedData = {}
        let onlineCount = 0

        Object.entries(data).forEach(([sensorId, rawSensorData]) => {
          const parsed = parseSensorData(rawSensorData)
          processedData[sensorId] = {
            ...parsed,
            lastUpdate: new Date(),
            isOnline: true
          }
          onlineCount++
        })

        setSensorData(prevData => ({
          ...prevData,
          ...processedData
        }))

        setSensorCount({
          online: onlineCount,
          total: Object.keys(processedData).length
        })

      } catch (error) {
        console.error('Error parsing sensor data:', error)
      }
    }

    eventSource.onerror = () => {
      setIsConnected(false)
      // Reconnect after 5 seconds
      setTimeout(connectToDataStream, 5000)
    }
  }

  useEffect(() => {
    connectToDataStream()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  // Optional simulation (controlled by Vite env variable VITE_ENABLE_SIMULATION=true)
  useEffect(() => {
    const enableSim = import.meta?.env?.VITE_ENABLE_SIMULATION === 'true'
    if (!enableSim) return
    // Only simulate if no real data arrived after a grace period
    let interval
    const startSim = () => {
      interval = setInterval(() => {
        setSensorData(prev => {
          // If real sensors present, stop simulation
          if (Object.keys(prev).length > 0) return prev
          const simulatedData = {}
          const senderIds = ['sender1', 'sender2', 'sender9']
          senderIds.forEach((senderId, index) => {
            simulatedData[senderId] = {
              ppm: 5 + Math.random() * 50 + Math.sin(Date.now() / 30000 + index) * 10,
              lastUpdate: new Date(),
              isOnline: true,
              lat: null,
              lon: null
            }
          })
          return simulatedData
        })
        setSensorCount(prev => {
          return { online: Object.keys(sensorData).length, total: Object.keys(sensorData).length }
        })
      }, 3000)
    }
    // Wait 5s for real data first
    const timeout = setTimeout(startSim, 5000)
    return () => { clearTimeout(timeout); if (interval) clearInterval(interval) }
  }, [sensorData])

  return {
    sensorData,
    isConnected,
    sensorCount
  }
}
