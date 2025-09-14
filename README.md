# UGM CO Monitoring System

A real-time CO (Carbon Monoxide) monitoring application for Universitas Gadjah Mada (UGM) campus with Kriging interpolation for spatial data analysis.

## Features

- **Real-time CO Monitoring**: Live data from 9 stationary sensors across UGM campus
- **Mobile Sensor Tracking**: GPS-enabled moving sensor with real-time positioning
- **Kriging Interpolation**: Advanced spatial interpolation to estimate CO levels at unmeasured locations
- **Interactive Map**: Satellite view of UGM campus with sensor markers and interpolation points
- **Heatmap Visualization**: Color-coded CO level representation across the campus
- **Modern React Frontend**: Responsive UI with real-time data updates

## Technology Stack

### Backend
- Node.js with Express
- Firebase Realtime Database
- Server-Sent Events (SSE) for real-time data streaming

### Frontend
- React 18
- React-Leaflet for interactive maps
- Vite for build tooling
- Custom Kriging implementation for spatial interpolation

### Hardware
- ESP32 microcontrollers with LoRa communication
- MQ-7 CO sensors
- GPS modules for mobile sensor positioning

## Architecture

```
Hardware Sensors → Firebase → Node.js Server → React Frontend
                                    ↓
                            Kriging Interpolation
                                    ↓
                              Map Visualization
```

## Sensor Configuration

### Stationary Sensors (9 locations)
1. Faculty of Engineering
2. Faculty of Medicine  
3. Faculty of Social Sciences
4. Faculty of Agriculture
5. Faculty of Economics
6. Central Library
7. Rectorate Building
8. Student Center
9. Sports Complex

### Interpolation Points (4 locations)
- Campus Gate Area
- Main Road Junction
- Parking Area
- Garden Area

## Development Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Firebase project with Realtime Database

### Installation

1. Clone the repository:
```bash
git clone https://github.com/sfh525/capstone-zeppelin.git
cd capstone-zeppelin
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
# Create .env file with your Firebase configuration
cp .env.example .env
```

4. Set up Firebase configuration in `.env`:
```env
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
DATABASE_URL=https://your_project-default-rtdb.firebaseio.com/
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef123456
PORT=3000
```

### Development Commands

```bash
# Backend only (serves EJS template)
npm run dev

# Frontend only (React development server)
npm run client

# Both backend and frontend simultaneously
npm run dev:full

# Build React for production
npm run build

# Start production server (serves React build)
NODE_ENV=production npm start
```

### Development Workflow

1. **Full Stack Development**: 
   ```bash
   npm run dev:full
   ```
   - Backend runs on `http://localhost:3000`
   - React dev server runs on `http://localhost:5173`
   - React dev server proxies API calls to backend

2. **Backend Only** (legacy EJS):
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000`

3. **Production Build**:
   ```bash
   npm run build
   NODE_ENV=production npm start
   ```

## API Endpoints

- `GET /` - Main application (React in production, EJS in development)
- `GET /live-data` - Server-Sent Events stream for real-time sensor data
- `GET /api/status` - API status and server information

## Data Format

### Sensor Data Structure
```javascript
{
  "sensor1": {
    "ppm": 15.3,
    "lastUpdate": "2024-01-01T12:00:00Z",
    "isOnline": true
  },
  "mobile": {
    "ppm": 22.1,
    "lat": -7.7750,
    "lon": 110.3760,
    "lastUpdate": "2024-01-01T12:00:00Z",
    "isOnline": true
  }
}
```

### Hardware Data Format (from .ino files)
```
Sender1:PPM=25.3,GPSLat=-7.7750,GPSLng=110.3760
```

## CO Level Classification

| Level | Range (ppm) | Status | Color |
|-------|-------------|--------|-------|
| Safe | 0-9 | Safe | Green |
| Moderate | 10-35 | Moderate | Yellow |
| Unhealthy | 36-100 | Unhealthy | Orange |
| Dangerous | 100+ | Dangerous | Red |

## Kriging Interpolation

The application uses Simple Kriging interpolation to estimate CO concentrations at unmeasured locations:

- **Variogram Model**: Exponential
- **Auto-parameter adjustment** based on sensor data characteristics
- **Fallback to Inverse Distance Weighting** if Kriging fails
- **Grid-based heatmap generation** for visualization

## Deployment

### Production Deployment

1. Build the React application:
```bash
npm run build
```

2. Set production environment:
```bash
export NODE_ENV=production
```

3. Start the server:
```bash
npm start
```

The server will serve the React build from the `/dist` directory.

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3000
# Firebase configuration...
```

## Hardware Setup

### Stationary Sensors (mq7.ino)
- ESP32 with MQ-7 sensor
- LoRa communication (433MHz)
- 10-second data transmission interval
- Automatic sensor calibration and preheat

### Mobile Sensor (loragps.ino)  
- ESP32 with MQ-7 sensor and GPS module
- Real-time GPS tracking
- 2-second data transmission interval
- Automatic GPS fix validation

### Receiver (receiver.ino)
- Central LoRa receiver
- Data forwarding to Firebase
- Multi-sensor data aggregation

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the [LICENSE.md](LICENSE.md) file for details.

## Acknowledgments

- Universitas Gadjah Mada for project support
- Firebase for real-time database services
- Leaflet.js for mapping capabilities
- React community for excellent documentation

## Contact

Project Link: [https://github.com/sfh525/capstone-zeppelin](https://github.com/sfh525/capstone-zeppelin)
