"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSearch = exports.saveSearch = void 0;
const store = new Map();
const saveSearch = (search) => {
    store.set(search.id, search);
};
exports.saveSearch = saveSearch;
const getSearch = (id) => store.get(id);
exports.getSearch = getSearch;
