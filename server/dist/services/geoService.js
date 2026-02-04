"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withinRadius = exports.computeDistanceKm = void 0;
const distance_1 = require("../utils/distance");
const computeDistanceKm = (a, b) => (0, distance_1.distanceKm)(a.lat, a.lng, b.lat, b.lng);
exports.computeDistanceKm = computeDistanceKm;
const withinRadius = (a, b, radiusKm) => (0, exports.computeDistanceKm)(a, b) <= radiusKm;
exports.withinRadius = withinRadius;
