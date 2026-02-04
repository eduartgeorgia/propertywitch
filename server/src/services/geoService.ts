import { distanceKm } from "../utils/distance";

export type GeoPoint = { lat: number; lng: number };

export const computeDistanceKm = (a: GeoPoint, b: GeoPoint): number =>
  distanceKm(a.lat, a.lng, b.lat, b.lng);

export const withinRadius = (a: GeoPoint, b: GeoPoint, radiusKm: number): boolean =>
  computeDistanceKm(a, b) <= radiusKm;
