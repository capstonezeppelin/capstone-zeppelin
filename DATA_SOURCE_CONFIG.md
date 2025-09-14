# Data Source Configuration

## Choose Your Data Source

### Option 1: Real-time Raw Data (Default)
```bash
# In .env file
USE_SESSION_DATA=false
```
**Pros:**
- Real-time updates
- Shows actual sensor readings
- Good for immediate alerts

**Cons:** 
- Can be noisy
- May show extreme values (like 3578.9 ppm)
- Requires good sensor calibration

### Option 2: Processed Session Data
```bash
# In .env file  
USE_SESSION_DATA=true
```
**Pros:**
- Smoothed, processed values
- Better for trend analysis
- More stable readings

**Cons:**
- Less real-time (session-based)
- May miss immediate spikes
- Could hide actual dangerous levels

## Recommendation

1. **For Development**: Use `sensor_data` to see real sensor behavior
2. **For Production**: Use `session_data` for stable user experience
3. **For Safety**: Monitor both - raw data for alerts, session data for trends

## Current Status

- **Active sensors**: 3 (`sender1`, `sender2`, `sender9`)
- **Expected map points**: 3 (not 9)
- **Data source**: `sensor_data` (raw readings)
- **Sensor calibration**: ⚠️ Needs attention (3578.9 ppm is extremely high)

## Next Steps

1. ✅ Updated app to show only 3 sensors
2. 🔧 Calibrate sensors (3578.9 ppm indicates miscalibration)
3. 🗺️ Add GPS coordinates for your actual sensor locations
4. 📊 Test with both data sources to see which works better
