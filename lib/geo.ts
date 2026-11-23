export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isInside(position: LatLng, center: LatLng, radius: number): boolean {
  return distanceMeters(position, center) <= radius;
}

/** 850 m, 1.2 km, 14 km, 230 km */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  if (meters < 10_000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters / 1000)} km`;
}

export function formatRadius(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(meters % 1000 === 0 ? 0 : 1)} km`;
}

/** Map region that fits a circle of `radius` metres with some breathing room. */
export function regionForRadius(center: LatLng, radius: number) {
  const latDelta = ((radius * 2.6) / 111_320);
  const lonDelta = latDelta / Math.max(0.2, Math.cos(toRad(center.latitude)));
  return { ...center, latitudeDelta: latDelta, longitudeDelta: lonDelta };
}
