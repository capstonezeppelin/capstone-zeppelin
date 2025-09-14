import React from 'react'

const Header = ({ isConnected, sensorCount }) => {
  return (
    <div className="header">
      <h1>🏭 UGM CO Monitoring System</h1>
      <div className="status-indicators">
        <div className="indicator">
          <span className={`dot ${!isConnected ? 'offline' : ''}`}></span>
          <span className="text">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="indicator">
          <span className="dot"></span>
          <span className="text">
            {sensorCount.online}/{sensorCount.total} Sensors Online
          </span>
        </div>
      </div>
    </div>
  )
}

export default Header
