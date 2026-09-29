/**
 * DLPC_Map_Collaborative - Central Application Configuration
 */

export const CONFIG = {
  APP_NAME: 'DLPC Collaborative Map',
  API_BASE_URL: window.DLPC_CONFIG?.API_URL || '',
  
  // Default Map Viewport (Davao City, Philippines)
  DEFAULT_CENTER: [7.071466, 125.604971],
  DEFAULT_ZOOM: 14,
  MIN_ZOOM: 5,
  MAX_ZOOM: 19,

  // Spatial Proximity Threshold for NAPs (meters)
  DEFAULT_PROXIMITY_THRESHOLD_METERS: 25,

  // Regional Bounding Box for Davao Region Filtering
  DAVAO_BOUNDS: {
    minLat: 6.30,
    maxLat: 7.95,
    minLng: 125.10,
    maxLng: 126.65
  },

  // Target Filter Keywords for Fast Geographic Filter
  DAVAO_KEYWORDS: [
    'DAVAO',
    'DVO',
    'PANABO',
    'TAGUM',
    'DIGOS',
    'SAMAL',
    'MATI',
    'DAVAO DEL SUR',
    'DAVAO DEL NORTE',
    'DAVAO ORIENTAL',
    'DAVAO DE ORO',
    'DAVAO OCCIDENTAL',
    'MIN'
  ],

  // Routing and Geocoding Providers
  ROUTING: {
    PROVIDER: 'OSRM', // 'OSRM' or 'GOOGLE'
    OSRM_URL: 'https://router.project-osrm.org/route/v1/driving'
  },
  GEOCODING: {
    PROVIDER: 'NOMINATIM', // 'NOMINATIM' or 'GOOGLE'
    NOMINATIM_URL: 'https://nominatim.openstreetmap.org/reverse'
  },

  // Tile Providers
  TILE_LAYERS: {
    osmStandard: {
      name: 'OpenStreetMap Standard',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors'
    },
    esriSatellite: {
      name: 'Esri Satellite Imagery',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri'
    }
  },

  // Real-Time Collaboration Settings
  COLLAB: {
    CURSOR_THROTTLE_MS: 30, // ~33 FPS ultra-smooth cursor motion
    LIVE_DRAW_THROTTLE_MS: 25, // 40 FPS live drawing streaming
    LIVE_MOVE_THROTTLE_MS: 25, // 40 FPS live move translation
    PRESENCE_HEARTBEAT_MS: 8000,
    POLL_FALLBACK_INTERVAL_MS: 3000,
    WS_RECONNECT_BASE_MS: 1000,
    WS_RECONNECT_MAX_MS: 10000
  },

  // User Roles
  ROLES: {
    ADMIN: 'ADMIN',
    EDITOR: 'EDITOR',
    VIEWER: 'VIEWER'
  }
};
