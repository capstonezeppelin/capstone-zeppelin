# UGM CO Monitoring - Deployment Checklist

## ⚠️ CRITICAL: Replace Estimated Data with Real Data

### 1. **Update Sensor Coordinates**
Replace the estimated coordinates in both frontend files with your actual sensor locations:

**Files to update:**
- `client/src/components/MapView.jsx` (lines 15-24)
- `client/src/App.jsx` (lines 9-18)

```javascript
// REPLACE THESE ESTIMATED COORDINATES:
const stationarySensors = [
  { id: 'sensor1', name: 'Faculty of Engineering', lat: -7.7725, lon: 110.3740 }, // ← ESTIMATE
  // ... replace all 9 with real GPS coordinates
]
```

**How to get real coordinates:**
1. Use GPS device at each sensor location
2. Or use Google Maps to get precise coordinates
3. Or use your phone's GPS coordinates app

### 2. **Update Building Names**
Verify and update the actual building names on UGM campus:

```javascript
// Current names (verify these):
'Faculty of Engineering'     // ← Is this the correct name?
'Faculty of Medicine'        // ← Verify
'Faculty of Social Sciences' // ← Verify
// etc...
```

### 3. **Verify CO Level Thresholds**
Confirm these safety thresholds match your institutional standards:
- Safe: 0-9 ppm
- Moderate: 10-35 ppm  
- Unhealthy: 36-100 ppm
- Dangerous: 100+ ppm

### 4. **Test with Real Sensor Data**
- Deploy sensors with actual hardware
- Verify data format matches what the app expects
- Test mobile sensor GPS functionality

### 5. **Update Campus Bounds**
Adjust the map bounds to properly frame UGM campus:

```javascript
// In MapView.jsx - update these bounds:
const ugmBounds = {
  north: -7.7700,  // ← Adjust based on actual campus
  south: -7.7800,  // ← boundaries
  east: 110.3800,  // ← 
  west: 110.3700   // ← 
}
```

## 📊 Data Sources Used:

1. **Coordinates**: Estimated based on general UGM location
2. **Building names**: Common university faculty names
3. **CO thresholds**: WHO/OSHA air quality standards
4. **Hardware format**: Derived from your `.ino` files
5. **Campus layout**: Estimated distribution

## ✅ Verification Steps:

- [ ] GPS coordinates verified for all 9 sensors
- [ ] Building names match actual UGM buildings  
- [ ] Interpolation points placed in logical locations
- [ ] CO safety thresholds approved by safety team
- [ ] Mobile sensor GPS tested in field
- [ ] Firebase database structure matches sensor output
- [ ] Real-time data flowing correctly

## 🗺️ Getting Accurate UGM Coordinates:

1. **Google Maps method:**
   - Go to maps.google.com
   - Search "Universitas Gadjah Mada"
   - Right-click on specific buildings
   - Copy coordinates

2. **On-site GPS method:**
   - Use smartphone GPS app at each sensor location
   - Record exact latitude/longitude
   - Verify accuracy (±5 meters recommended)

3. **Survey data:**
   - Contact UGM facilities management
   - Request official building coordinates
   - Use surveyed campus map data
