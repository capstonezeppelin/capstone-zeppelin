import { useState, useEffect, useRef } from 'react'

export const useSensorData = () => {
  const [sensorData, setSensorData] = useState({})
  const [isConnected, setIsConnected] = useState(false)
  const [sensorCount, setSensorCount] = useState({ online: 0, total: 0 }) // Dynamic count
  const eventSourceRef = useRef(null)

  const parseSensorData = (rawData) => {
    const parsed = { ppm: 0, lat: null, lon: null, voltage: null, analog: null, timestamp: null }
    const pickNumeric = (v) => {
      const n = typeof v === 'number' ? v : parseFloat(v)
      return Number.isFinite(n) ? n : null
    }
    const pickAnyPPM = (obj) => {
      try {
        for (const [k, v] of Object.entries(obj || {})) {
          if (/ppm/i.test(k)) {
            const n = pickNumeric(v)
            if (n !== null) return n
          }
        }
      } catch {}
      return null
    }
    
    // Handle direct numeric value (backend sends raw numbers)
    if (typeof rawData === 'number') {
      parsed.ppm = rawData
      return parsed
    }
    
    if (typeof rawData === 'object') {
      // Handle your actual Firebase data format
      parsed.ppm = pickNumeric(rawData.ppm) ?? pickNumeric(rawData.last_ppm) ?? pickNumeric(rawData.value) ?? pickAnyPPM(rawData) ?? 0
      const latRaw = rawData.lat ?? rawData.GPSLat ?? rawData.gpsLat
      const lonRaw = rawData.lon ?? rawData.GPSLng ?? rawData.gpsLng
      const latNum = (latRaw === 'NoFix' || latRaw === undefined || latRaw === null) ? null : (typeof latRaw === 'number' ? latRaw : parseFloat(latRaw))
      const lonNum = (lonRaw === 'NoFix' || lonRaw === undefined || lonRaw === null) ? null : (typeof lonRaw === 'number' ? lonRaw : parseFloat(lonRaw))
      parsed.lat = Number.isFinite(latNum) ? latNum : null
      parsed.lon = Number.isFinite(lonNum) ? lonNum : null
      parsed.voltage = pickNumeric(rawData.voltage) ?? pickNumeric(rawData.last_voltage)
      parsed.analog = pickNumeric(rawData.mq7_analog) ?? pickNumeric(rawData.last_mq7_analog)
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
        console.log('Raw SSE data received:', data) // DEBUG
        const processedData = {}
        let onlineCount = 0

        Object.entries(data).forEach(([sensorId, rawSensorData]) => {
          const idLower = (sensorId || '').toLowerCase()
          if (idLower === 'sender9' || idLower === 'sender10') return // ignore sender9 and sender10
          const parsed = parseSensorData(rawSensorData)
          console.log(`Parsed ${sensorId}:`, { raw: rawSensorData, parsed }) // DEBUG
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
          const senderIds = ['sender1', 'sender2']
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
