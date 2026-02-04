"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.distanceKm = exports.toRad = void 0;
const toRad = (value) => (value * Math.PI) / 180;
exports.toRad = toRad;
const distanceKm = (lat1, lng1, lat2, lng2) => {
    const earthRadiusKm = 6371;
    const dLat = (0, exports.toRad)(lat2 - lat1);
    const dLng = (0, exports.toRad)(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((0, exports.toRad)(lat1)) * Math.cos((0, exports.toRad)(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
};
exports.distanceKm = distanceKm;
