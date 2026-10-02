// Runtime configuration (#8). This file is served UNHASHED and no-cache, and is
// loaded before the app bundle. In deployed environments the dyno rewrites it
// at startup from the environment's own vars (scripts/generate-config.js), so a
// single build artifact can be promoted across environments without a rebuild.
//
// The committed default is empty: locally (and when API_URL is unset) the app
// falls back to the build-time VITE_API_URL, then to localhost. See
// src/api/axiosInstance.js for the resolution order.
window.__APP_CONFIG__ = { apiUrl: "" };
