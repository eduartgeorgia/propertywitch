"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADAPTERS = void 0;
const olx_1 = require("./olx");
// OLX Portugal - using their public JSON API (no scraping needed)
exports.ADAPTERS = [
    olx_1.adapter,
];
