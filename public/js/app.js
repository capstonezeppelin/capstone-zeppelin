/**
 * UGM CO Monitoring Application
 * Main application logic for real-time CO monitoring with Kriging interpolation
 */

class COMonitoringApp {
  constructor() {
    this.map = null;
    this.sensorMarkers = new Map();
    this.movingSensorMarker = null;
    this.interpolatedMarkers = [];
    this.heatmapLayer = null;
    this.movingSensorTrail = [];
    this.kriging = new SimpleKriging();
    this.eventSource = null;
    this.showInterpolation = false;
    this.showHeatmap = false;
    
    // UGM Campus bounds (approximate)
    this.ugmBounds = {
      north: -7.7700,
      south: -7.7800,
      east: 110.3800,
      west: 110.3700
    };
    
    // Define 9 stationary sensor locations around UGM campus
    this.stationarySensors = [
      { id: 'sensor1', name: 'Faculty of Engineering', lat: -7.7725, lon: 110.3740, value: null },
      { id: 'sensor2', name: 'Faculty of Medicine', lat: -7.7690, lon: 110.3755, value: null },
      { id: 'sensor3', name: 'Faculty of Social Sciences', lat: -7.7710, lon: 110.3770, value: null },
      { id: 'sensor4', name: 'Faculty of Agriculture', lat: -7.7750, lon: 110.3785, value: null },
      { id: 'sensor5', name: 'Faculty of Economics', lat: -7.7765, lon: 110.3750, value: null },
      { id: 'sensor6', name: 'Central Library', lat: -7.7745, lon: 110.3765, value: null },
      { id: 'sensor7', name: 'Rectorate Building', lat: -7.7735, lon: 110.3755, value: null },
      { id: 'sensor8', name: 'Student Center', lat: -7.7720, lon: 110.3745, value: null },
      { id: 'sensor9', name: 'Sports Complex', lat: -7.7780, lon: 110.3760, value: null }
    ];
    
    // Define interpolation points (gaps to fill)
    this.interpolationPoints = [
      { id: 'interp1', name: 'Campus Gate Area', lat: -7.7715, lon: 110.3760 },
      { id: 'interp2', name: 'Main Road Junction', lat: -7.7740, lon: 110.3775 },
      { id: 'interp3', name: 'Parking Area', lat: -7.7760, lon: 110.3740 },
      { id: 'interp4', name: 'Garden Area', lat: -7.7730, lon: 110.3780 }
    ];
    
    this.init();
  }

  async init() {
    this.initMap();
    this.setupEventListeners();
    this.addStationarySensors();
    this.addInterpolationPoints();
    this.connectToDataStream();
    this.startDataSimulation(); // For testing when no real data
  }

  initMap() {
    // Initialize map centered on UGM
    this.map = L.map('map').setView([-7.7750, 110.3760], 16);
    
    // Add satellite tile layer
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri',
      maxZoom: 18
    }).addTo(this.map);
    
    // Add OpenStreetMap overlay for labels
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      opacity: 0.3,
      maxZoom: 18
    }).addTo(this.map);
  }

  setupEventListeners() {
    document.getElementById('toggle-interpolation').addEventListener('click', () => {
      this.toggleInterpolation();
    });
    
    document.getElementById('toggle-heatmap').addEventListener('click', () => {
      this.toggleHeatmap();
    });
  }

  addStationarySensors() {
    this.stationarySensors.forEach(sensor => {
      const marker = this.createSensorMarker(sensor, 'stationary');
      this.sensorMarkers.set(sensor.id, marker);
      this.updateSensorUI(sensor, 'stationary');
    });
  }

  createSensorMarker(sensor, type) {
    const coLevel = sensor.value || 0;
    const colorClass = this.getCOColorClass(coLevel);
    
    const customIcon = L.divIcon({
      className: `co-marker ${colorClass}`,
      html: `<div style="color: #333;">${Math.round(coLevel)}</div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
    
    const marker = L.marker([sensor.lat, sensor.lon], { icon: customIcon })
      .addTo(this.map)
      .bindPopup(this.createPopupContent(sensor, type));
    
    return marker;
  }

  createPopupContent(sensor, type) {
    const coLevel = sensor.value || 0;
    const status = this.getCOStatus(coLevel);
    const timestamp = new Date().toLocaleTimeString();
    
    return `
      <div style="text-align: center; min-width: 200px;">
        <h3 style="margin-bottom: 10px; color: #333;">${sensor.name}</h3>
        <div style="font-size: 24px; font-weight: bold; color: ${this.getCOColor(coLevel)};">
          ${Math.round(coLevel)} ppm
        </div>
        <div style="font-size: 14px; color: #666; margin: 5px 0;">
          Status: ${status}
        </div>
        ${type === 'moving' && sensor.lat && sensor.lon ? 
          `<div style="font-size: 12px; color: #999;">
            GPS: ${sensor.lat.toFixed(6)}, ${sensor.lon.toFixed(6)}
          </div>` : ''
        }
        <div style="font-size: 12px; color: #999;">
          Updated: ${timestamp}
        </div>
      </div>
    `;
  }

  addInterpolationPoints() {
    this.interpolationPoints.forEach(point => {
      const marker = L.circleMarker([point.lat, point.lon], {
        radius: 8,
        fillColor: '#9ca3af',
        color: '#6b7280',
        weight: 2,
        opacity: 0.7,
        fillOpacity: 0.5
      }).addTo(this.map);
      
      marker.bindPopup(`
        <div style="text-align: center;">
          <h4>${point.name}</h4>
          <div>Interpolated Point</div>
          <div id="interp-${point.id}">Calculating...</div>
        </div>
      `);
      
      this.interpolatedMarkers.push({ marker, point, id: point.id });
    });
  }

  getCOColorClass(coLevel) {
    if (coLevel <= 9) return 'safe';
    if (coLevel <= 35) return 'moderate';
    if (coLevel <= 100) return 'unhealthy';
    return 'dangerous';
  }

  getCOColor(coLevel) {
    if (coLevel <= 9) return '#22c55e';
    if (coLevel <= 35) return '#eab308';
    if (coLevel <= 100) return '#f97316';
    return '#ef4444';
  }

  getCOStatus(coLevel) {
    if (coLevel <= 9) return 'Safe';
    if (coLevel <= 35) return 'Moderate';
    if (coLevel <= 100) return 'Unhealthy';
    return 'Dangerous';
  }

  updateSensorMarker(sensorId, data) {
    const marker = this.sensorMarkers.get(sensorId);
    if (marker) {
      const coLevel = data.ppm || 0;
      const colorClass = this.getCOColorClass(coLevel);
      
      const customIcon = L.divIcon({
        className: `co-marker ${colorClass}`,
        html: `<div style="color: #333;">${Math.round(coLevel)}</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
      
      marker.setIcon(customIcon);
      
      // Update sensor data
      const sensor = this.stationarySensors.find(s => s.id === sensorId);
      if (sensor) {
        sensor.value = coLevel;
        sensor.lastUpdate = new Date();
        this.updateSensorUI(sensor, 'stationary');
      }
    }
  }

  updateMovingSensor(data) {
    if (data.lat && data.lon) {
      const coLevel = data.ppm || 0;
      const colorClass = this.getCOColorClass(coLevel);
      
      // Update or create moving sensor marker
      if (this.movingSensorMarker) {
        this.map.removeLayer(this.movingSensorMarker);
      }
      
      const customIcon = L.divIcon({
        className: `co-marker ${colorClass}`,
        html: `<div style="color: #333;">📱${Math.round(coLevel)}</div>`,
        iconSize: [45, 45],
        iconAnchor: [22, 22]
      });
      
      this.movingSensorMarker = L.marker([data.lat, data.lon], { icon: customIcon })
        .addTo(this.map)
        .bindPopup(this.createPopupContent({
          name: 'Mobile Sensor',
          value: coLevel,
          lat: data.lat,
          lon: data.lon
        }, 'moving'));
      
      // Add to trail
      this.movingSensorTrail.push({ lat: data.lat, lon: data.lon, timestamp: new Date() });
      
      // Keep trail limited to last 50 points
      if (this.movingSensorTrail.length > 50) {
        this.movingSensorTrail = this.movingSensorTrail.slice(-50);
      }
      
      // Update UI
      this.updateMovingSensorUI(data);
    }
  }

  updateSensorUI(sensor, type) {
    const containerId = type === 'stationary' ? 'stationary-sensors' : 'moving-sensor';
    const container = document.getElementById(containerId);
    
    if (type === 'stationary') {
      let sensorElement = document.getElementById(`ui-${sensor.id}`);
      
      if (!sensorElement) {
        sensorElement = document.createElement('div');
        sensorElement.id = `ui-${sensor.id}`;
        sensorElement.className = 'sensor-item';
        container.appendChild(sensorElement);
      }
      
      const coLevel = sensor.value || 0;
      const colorClass = this.getCOColorClass(coLevel);
      sensorElement.className = `sensor-item ${colorClass}`;
      
      sensorElement.innerHTML = `
        <span class="sensor-name">${sensor.name}</span>
        <span class="sensor-value">${Math.round(coLevel)} ppm</span>
        <div class="sensor-timestamp">
          ${sensor.lastUpdate ? sensor.lastUpdate.toLocaleTimeString() : 'No data'}
        </div>
      `;
    }
  }

  updateMovingSensorUI(data) {
    const container = document.getElementById('moving-sensor');
    const coLevel = data.ppm || 0;
    const colorClass = this.getCOColorClass(coLevel);
    
    container.innerHTML = `
      <div class="sensor-item ${colorClass}">
        <span class="sensor-name">Mobile Unit</span>
        <span class="sensor-value">${Math.round(coLevel)} ppm</span>
        <div class="sensor-location">
          GPS: ${data.lat ? `${data.lat.toFixed(4)}, ${data.lon.toFixed(4)}` : 'Acquiring...'}
        </div>
        <div class="sensor-timestamp">${new Date().toLocaleTimeString()}</div>
      </div>
    `;
  }

  connectToDataStream() {
    if (this.eventSource) {
      this.eventSource.close();
    }
    
    this.eventSource = new EventSource('/live-data');
    
    this.eventSource.onopen = () => {
      this.updateConnectionStatus(true);
    };
    
    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.processSensorData(data);
      } catch (error) {
        console.error('Error parsing sensor data:', error);
      }
    };
    
    this.eventSource.onerror = () => {
      this.updateConnectionStatus(false);
      // Reconnect after 5 seconds
      setTimeout(() => this.connectToDataStream(), 5000);
    };
  }

  processSensorData(data) {
    Object.entries(data).forEach(([sensorId, sensorData]) => {
      // Parse sensor data based on format
      const parsedData = this.parseSensorData(sensorData);
      
      if (sensorId.toLowerCase().includes('mobile') || parsedData.lat) {
        // Mobile sensor
        this.updateMovingSensor(parsedData);
      } else {
        // Stationary sensor
        this.updateSensorMarker(sensorId, parsedData);
      }
    });
    
    // Update interpolated points after processing all sensors
    this.updateInterpolatedPoints();
    this.updateSensorCount();
  }

  parseSensorData(rawData) {
    // Handle different data formats from sensors
    const parsed = { ppm: 0, lat: null, lon: null };
    
    if (typeof rawData === 'object') {
      parsed.ppm = rawData.ppm || rawData.PPM || rawData.value || 0;
      parsed.lat = rawData.lat || rawData.GPSLat || null;
      parsed.lon = rawData.lon || rawData.GPSLng || null;
    } else if (typeof rawData === 'string') {
      // Parse format like "PPM=25.3,GPSLat=-7.7750,GPSLng=110.3760"
      const parts = rawData.split(',');
      parts.forEach(part => {
        const [key, value] = part.split('=');
        if (key && value) {
          switch (key.trim().toLowerCase()) {
            case 'ppm':
              parsed.ppm = parseFloat(value);
              break;
            case 'gpslat':
            case 'lat':
              parsed.lat = value === 'NoFix' ? null : parseFloat(value);
              break;
            case 'gpslng':
            case 'lng':
            case 'lon':
              parsed.lon = value === 'NoFix' ? null : parseFloat(value);
              break;
          }
        }
      });
    }
    
    return parsed;
  }

  updateInterpolatedPoints() {
    // Get known sensor values for interpolation
    const knownPoints = this.stationarySensors
      .filter(sensor => sensor.value !== null)
      .map(sensor => ({
        lat: sensor.lat,
        lon: sensor.lon,
        value: sensor.value
      }));
    
    if (knownPoints.length >= 2) {
      // Auto-adjust Kriging parameters
      this.kriging.autoAdjustParameters(knownPoints);
      
      // Update each interpolation point
      this.interpolatedMarkers.forEach(({ marker, point, id }) => {
        const interpolatedValue = this.kriging.interpolate(
          point.lat, point.lon, knownPoints
        );
        
        if (interpolatedValue !== null) {
          // Update marker appearance
          const colorClass = this.getCOColorClass(interpolatedValue);
          marker.setStyle({
            fillColor: this.getCOColor(interpolatedValue),
            color: this.getCOColor(interpolatedValue)
          });
          
          // Update popup content
          const popupElement = document.getElementById(`interp-${id}`);
          if (popupElement) {
            popupElement.innerHTML = `
              <div style="color: ${this.getCOColor(interpolatedValue)}; font-weight: bold;">
                ${Math.round(interpolatedValue)} ppm
              </div>
              <div style="font-size: 12px; color: #666;">
                ${this.getCOStatus(interpolatedValue)}
              </div>
            `;
          }
          
          // Update UI list
          this.updateInterpolatedPointUI(point, interpolatedValue);
        }
      });
    }
  }

  updateInterpolatedPointUI(point, value) {
    const container = document.getElementById('interpolated-points');
    let pointElement = document.getElementById(`ui-${point.id}`);
    
    if (!pointElement) {
      pointElement = document.createElement('div');
      pointElement.id = `ui-${point.id}`;
      pointElement.className = 'sensor-item';
      container.appendChild(pointElement);
    }
    
    const colorClass = this.getCOColorClass(value);
    pointElement.className = `sensor-item ${colorClass}`;
    
    pointElement.innerHTML = `
      <span class="sensor-name">${point.name}</span>
      <span class="sensor-value">${Math.round(value)} ppm</span>
      <div class="sensor-timestamp">Interpolated</div>
    `;
  }

  toggleInterpolation() {
    this.showInterpolation = !this.showInterpolation;
    const button = document.getElementById('toggle-interpolation');
    const buttonText = button.querySelector('.btn-text');
    
    if (this.showInterpolation) {
      button.classList.add('active');
      buttonText.textContent = 'Hide Interpolation';
      this.interpolatedMarkers.forEach(({ marker }) => {
        marker.addTo(this.map);
      });
    } else {
      button.classList.remove('active');
      buttonText.textContent = 'Show Interpolation';
      this.interpolatedMarkers.forEach(({ marker }) => {
        this.map.removeLayer(marker);
      });
    }
  }

  toggleHeatmap() {
    this.showHeatmap = !this.showHeatmap;
    const button = document.getElementById('toggle-heatmap');
    const buttonText = button.querySelector('.btn-text');
    
    if (this.showHeatmap) {
      button.classList.add('active');
      buttonText.textContent = 'Hide Heatmap';
      this.generateHeatmap();
    } else {
      button.classList.remove('active');
      buttonText.textContent = 'Show Heatmap';
      if (this.heatmapLayer) {
        this.map.removeLayer(this.heatmapLayer);
        this.heatmapLayer = null;
      }
    }
  }

  generateHeatmap() {
    const knownPoints = this.stationarySensors
      .filter(sensor => sensor.value !== null)
      .map(sensor => ({
        lat: sensor.lat,
        lon: sensor.lon,
        value: sensor.value
      }));
    
    if (knownPoints.length >= 2) {
      const gridData = this.kriging.generateInterpolationGrid(
        this.ugmBounds, knownPoints, 15
      );
      
      // Create heatmap overlay (simplified version using circles)
      if (this.heatmapLayer) {
        this.map.removeLayer(this.heatmapLayer);
      }
      
      this.heatmapLayer = L.layerGroup();
      
      gridData.forEach(point => {
        const circle = L.circle([point.lat, point.lon], {
          radius: 50,
          fillColor: this.getCOColor(point.value),
          color: this.getCOColor(point.value),
          weight: 0,
          opacity: 0.6,
          fillOpacity: 0.4
        });
        
        this.heatmapLayer.addLayer(circle);
      });
      
      this.heatmapLayer.addTo(this.map);
    }
  }

  updateConnectionStatus(connected) {
    const statusIndicator = document.getElementById('connection-status');
    const dot = statusIndicator.querySelector('.dot');
    const text = statusIndicator.querySelector('.text');
    
    if (connected) {
      dot.classList.remove('offline');
      text.textContent = 'Connected';
    } else {
      dot.classList.add('offline');
      text.textContent = 'Disconnected';
    }
  }

  updateSensorCount() {
    const onlineSensors = this.stationarySensors.filter(s => s.value !== null).length;
    const totalSensors = this.stationarySensors.length;
    document.getElementById('sensor-count').textContent = `${onlineSensors}/${totalSensors} Sensors Online`;
  }

  // Simulation method for testing (remove when real data is available)
  startDataSimulation() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('Starting data simulation for testing...');
      
      setInterval(() => {
        // Simulate stationary sensor data
        const simulatedData = {};
        
        this.stationarySensors.forEach((sensor, index) => {
          simulatedData[sensor.id] = {
            ppm: 5 + Math.random() * 50 + Math.sin(Date.now() / 30000 + index) * 10,
            timestamp: Date.now()
          };
        });
        
        // Simulate moving sensor
        if (Math.random() > 0.3) {
          simulatedData['mobile'] = {
            ppm: 10 + Math.random() * 30,
            lat: -7.7750 + (Math.random() - 0.5) * 0.005,
            lon: 110.3760 + (Math.random() - 0.5) * 0.005,
            timestamp: Date.now()
          };
        }
        
        this.processSensorData(simulatedData);
      }, 3000);
    }
  }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
  window.coApp = new COMonitoringApp();
});
