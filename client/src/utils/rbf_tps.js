// Radial Basis Function - Thin Plate Spline (global) interpolation
// Simplified implementation suitable for small numbers of sensors

export class RBFThinPlateSpline {
  constructor(options = {}) {
    this.lambda = options.lambda ?? 1e-6; // small Tikhonov regularization
    this.epsilon = 1e-12;
  }

  // Haversine distance in meters, same as in kriging util for consistency
  static distanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  phi(r) {
    const rr = Math.max(r, this.epsilon);
    return rr * rr * Math.log(rr);
  }

  // Solve linear system A x = b via Gaussian elimination (small N)
  solve(A, b) {
    const n = A.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let i = 0; i < n; i++) {
      // pivot
      let maxR = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(M[k][i]) > Math.abs(M[maxR][i])) maxR = k;
      }
      [M[i], M[maxR]] = [M[maxR], M[i]];
      // eliminate
      for (let k = i + 1; k < n; k++) {
        const f = M[k][i] / (M[i][i] || this.epsilon);
        for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
      }
    }
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = M[i][n];
      for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
      x[i] = s / (M[i][i] || this.epsilon);
    }
    return x;
  }

  interpolate(targetLat, targetLon, knownPoints) {
    const n = knownPoints.length;
    if (n === 0) return null;
    if (n === 1) return Math.max(0, knownPoints[0].value);

    // Build K matrix (phi of pairwise distances) with small regularization
    const K = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const d = RBFThinPlateSpline.distanceMeters(
          knownPoints[i].lat, knownPoints[i].lon,
          knownPoints[j].lat, knownPoints[j].lon
        );
        K[i][j] = this.phi(d) + (i === j ? this.lambda : 0);
      }
    }

    const v = knownPoints.map(p => p.value);
    const w = this.solve(K, v);

    // Evaluate at target point
    let y = 0;
    for (let i = 0; i < n; i++) {
      const d = RBFThinPlateSpline.distanceMeters(
        targetLat, targetLon,
        knownPoints[i].lat, knownPoints[i].lon
      );
      y += w[i] * this.phi(d);
    }
    return Math.max(0, y);
  }
}


