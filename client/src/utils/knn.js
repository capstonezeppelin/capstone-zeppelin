// Simple KNN regression with optional distance weighting

export class KNNRegressor {
  constructor(options = {}) {
    this.k = options.k ?? 3;
    this.power = options.power ?? 1; // distance weight exponent (0 = unweighted mean)
  }

  static distanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  interpolate(targetLat, targetLon, knownPoints) {
    if (!knownPoints || knownPoints.length === 0) return null;
    if (knownPoints.length === 1) return Math.max(0, knownPoints[0].value);

    const withDist = knownPoints.map(p => ({
      ...p,
      d: KNNRegressor.distanceMeters(targetLat, targetLon, p.lat, p.lon)
    })).sort((a, b) => a.d - b.d);

    const k = Math.min(this.k, withDist.length);
    let num = 0, den = 0;
    for (let i = 0; i < k; i++) {
      const d = Math.max(withDist[i].d, 1e-6);
      const w = this.power > 0 ? 1 / Math.pow(d, this.power) : 1;
      num += w * withDist[i].value;
      den += w;
    }
    return Math.max(0, num / den);
  }
}


