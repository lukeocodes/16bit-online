/**
 * Builder registry — barrel export.
 *
 * Import from `./registry` (or `./registry/index.js`) to access the full
 * taxonomy: categories, layers, tilesets, and map-item types. Everything
 * is pure data plus lookup helpers; no side effects at import time.
 */

export * from "./categories.js";
export * from "./layers.js";
export * from "./tilesets.js";
export * from "./map-items.js";
