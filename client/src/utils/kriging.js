/**
 * Simple Kriging Interpolation Implementation
 * For CO concentration spatial interpolation
 */

export class SimpleKriging {
  constructor() {
    this.nugget = 0.1;      // Nugget effect (measurement error)
    this.sill = 1.0;        // Sill (maximum variance)
    this.range = 1000;      // Range (correlation distance in meters)
    this.model = 'exponential'; // Variogram model
  }

  // Calculate distance between two points in meters
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Variogram function (exponential model)
  variogram(distance) {
    if (distance === 0) return 0;
    
    switch (this.model) {
      case 'exponential':
        return this.nugget + this.sill * (1 - Math.exp(-3 * distance / this.range));
      case 'spherical':
        if (distance >= this.range) {
          return this.nugget + this.sill;
        }
        return this.nugget + this.sill * (1.5 * distance / this.range - 0.5 * Math.pow(distance / this.range, 3));
      case 'gaussian':
        return this.nugget + this.sill * (1 - Math.exp(-3 * Math.pow(distance / this.range, 2)));
      default:
        return this.nugget + this.sill * (1 - Math.exp(-3 * distance / this.range));
    }
  }

  // Create covariance matrix
  createCovarianceMatrix(knownPoints) {
    const n = knownPoints.length;
    const C = [];
    
    for (let i = 0; i < n + 1; i++) {
      C[i] = [];
      for (let j = 0; j < n + 1; j++) {
        if (i === n || j === n) {
          // Lagrange multiplier row/column
          C[i][j] = i === n && j === n ? 0 : 1;
        } else {
          const distance = this.calculateDistance(
            knownPoints[i].lat, knownPoints[i].lon,
            knownPoints[j].lat, knownPoints[j].lon
          );
          C[i][j] = this.sill - this.variogram(distance);
        }
      }
    }
    
    return C;
  }

  // Solve linear system using Gaussian elimination
  solveLinearSystem(A, b) {
    const n = A.length;
    const x = new Array(n).fill(0);
    
    // Create augmented matrix
    const augmented = A.map((row, i) => [...row, b[i]]);
    
    // Forward elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }
      
      // Swap rows
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
      
      // Make all rows below this one 0 in current column
      for (let k = i + 1; k < n; k++) {
        const factor = augmented[k][i] / augmented[i][i];
        for (let j = i; j <= n; j++) {
          augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }
    
    // Back substitution
    for (let i = n - 1; i >= 0; i--) {
      x[i] = augmented[i][n];
      for (let j = i + 1; j < n; j++) {
        x[i] -= augmented[i][j] * x[j];
      }
      x[i] /= augmented[i][i];
    }
    
    return x;
  }

  // Interpolate CO value at a given point
  interpolate(targetLat, targetLon, knownPoints) {
    if (knownPoints.length === 0) return null;
    if (knownPoints.length === 1) return knownPoints[0].value;

    try {
      // Create covariance matrix
      const C = this.createCovarianceMatrix(knownPoints);
      
      // Create right-hand side vector
      const d = [];
      for (let i = 0; i < knownPoints.length; i++) {
        const distance = this.calculateDistance(
          targetLat, targetLon,
          knownPoints[i].lat, knownPoints[i].lon
        );
        d.push(this.sill - this.variogram(distance));
      }
      d.push(1); // For Lagrange multiplier
      
      // Create values vector
      const values = knownPoints.map(p => p.value);
      values.push(0); // For Lagrange multiplier
      
      // Solve for weights
      const weights = this.solveLinearSystem(C, d);
      
      // Calculate interpolated value
      let interpolatedValue = 0;
      for (let i = 0; i < knownPoints.length; i++) {
        interpolatedValue += weights[i] * knownPoints[i].value;
      }
      
      // Ensure non-negative CO values
      return Math.max(0, interpolatedValue);
      
    } catch (error) {
      console.warn('Kriging interpolation failed, using simple IDW fallback:', error);
      return this.inverseDistanceWeighting(targetLat, targetLon, knownPoints);
    }
  }

  // Fallback: Simple Inverse Distance Weighting
  inverseDistanceWeighting(targetLat, targetLon, knownPoints) {
    let weightedSum = 0;
    let weightSum = 0;
    const power = 2;
    
    for (const point of knownPoints) {
      const distance = this.calculateDistance(targetLat, targetLon, point.lat, point.lon);
      
      // If we're very close to a known point, return its value
      if (distance < 1) {
        return point.value;
      }
      
      const weight = 1 / Math.pow(distance, power);
      weightedSum += weight * point.value;
      weightSum += weight;
    }
    
    return weightSum > 0 ? Math.max(0, weightedSum / weightSum) : 0;
  }

  // Generate interpolation grid for heatmap visualization
  generateInterpolationGrid(bounds, knownPoints, gridSize = 20) {
    const grid = [];
    const latStep = (bounds.north - bounds.south) / gridSize;
    const lonStep = (bounds.east - bounds.west) / gridSize;
    
    for (let i = 0; i <= gridSize; i++) {
      for (let j = 0; j <= gridSize; j++) {
        const lat = bounds.south + i * latStep;
        const lon = bounds.west + j * lonStep;
        const value = this.interpolate(lat, lon, knownPoints);
        
        if (value !== null) {
          grid.push({
            lat: lat,
            lon: lon,
            value: value
          });
        }
      }
    }
    
    return grid;
  }

  // Auto-adjust parameters based on data characteristics
  autoAdjustParameters(knownPoints) {
    if (knownPoints.length < 2) return;
    
    // Calculate mean distance between points
    const distances = [];
    for (let i = 0; i < knownPoints.length; i++) {
      for (let j = i + 1; j < knownPoints.length; j++) {
        distances.push(this.calculateDistance(
          knownPoints[i].lat, knownPoints[i].lon,
          knownPoints[j].lat, knownPoints[j].lon
        ));
      }
    }
    
    if (distances.length > 0) {
      const meanDistance = distances.reduce((a, b) => a + b) / distances.length;
      this.range = meanDistance * 0.7; // Set range to ~70% of mean distance
    }
    
    // Adjust sill based on data variance
    const values = knownPoints.map(p => p.value);
    const mean = values.reduce((a, b) => a + b) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    this.sill = Math.max(0.1, variance);
  }
}
