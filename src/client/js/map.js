/**
 * DLPC_Map_Collaborative - Interactive Leaflet GIS Map Engine
 */

import { CONFIG } from './config.js';

class MapEngine {
  constructor() {
    this.map = null;
    this.tileLayers = {};
    this.currentTileLayer = null;
    this.layerGroups = {
      routes: null,
      naps: null,
      drawings: null,
      collaborators: null
    };
    this.layerVisibility = {
      routes: true,
      naps: true,
      drawings: true,
      collaborators: true
    };
    this.selectedObject = null;
    this.clickHandlers = [];
    this.coordListeners = [];
  }

  /**
   * Initializes the Leaflet map container and tile layers.
   */
  init(containerId = 'leaflet-map') {
    if (!window.L) {
      console.error('Leaflet library is required');
      return;
    }

    this.map = L.map(containerId, {
      center: CONFIG.DEFAULT_CENTER,
      zoom: CONFIG.DEFAULT_ZOOM,
      minZoom: CONFIG.MIN_ZOOM,
      maxZoom: CONFIG.MAX_ZOOM,
      zoomControl: false // Custom minimal placement
    });

    // Add zoom control to top-right to preserve toolbar ergonomics
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // Initialize base tile layers
    Object.keys(CONFIG.TILE_LAYERS).forEach((key, index) => {
      const cfg = CONFIG.TILE_LAYERS[key];
      this.tileLayers[key] = L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        maxZoom: CONFIG.MAX_ZOOM
      });
      if (index === 0) {
        this.tileLayers[key].addTo(this.map);
        this.currentTileLayer = key;
      }
    });

    // Initialize feature layer groups
    this.layerGroups.routes = L.layerGroup().addTo(this.map);
    this.layerGroups.naps = L.layerGroup().addTo(this.map);
    this.layerGroups.drawings = L.layerGroup().addTo(this.map);
    this.layerGroups.collaborators = L.layerGroup().addTo(this.map);

    // Mousemove coordinate tracking
    this.map.on('mousemove', (e) => {
      this.coordListeners.forEach(fn => fn(e.latlng.lat, e.latlng.lng));
    });

    // Global map click
    this.map.on('click', (e) => {
      let handled = false;
      for (const handler of this.clickHandlers) {
        if (handler(e)) {
          handled = true;
          break;
        }
      }
      if (!handled) {
        this.clearSelection();
      }
    });

    // Force map size invalidation to avoid grey tiles
    setTimeout(() => {
      this.map.invalidateSize();
    }, 100);

    // Responsive resize handler for mobile rotation and layout shifts
    window.addEventListener('resize', () => {
      if (this.map) {
        this.map.invalidateSize();
      }
    });
  }

  setTileLayer(key) {
    if (!this.tileLayers[key] || this.currentTileLayer === key) return;
    this.map.removeLayer(this.tileLayers[this.currentTileLayer]);
    this.tileLayers[key].addTo(this.map);
    this.currentTileLayer = key;
  }

  toggleLayer(layerName, visible) {
    if (!this.layerGroups[layerName]) return;
    this.layerVisibility[layerName] = visible;
    if (visible) {
      if (!this.map.hasLayer(this.layerGroups[layerName])) {
        this.map.addLayer(this.layerGroups[layerName]);
      }
    } else {
      if (this.map.hasLayer(this.layerGroups[layerName])) {
        this.map.removeLayer(this.layerGroups[layerName]);
      }
    }
  }

  panTo(lat, lng, zoom = null) {
    if (zoom) {
      this.map.setView([lat, lng], zoom, { animate: true, duration: 0.8 });
    } else {
      this.map.panTo([lat, lng], { animate: true, duration: 0.8 });
    }
  }

  fitBounds(bounds) {
    this.map.fitBounds(bounds, { padding: [50, 50], animate: true });
  }

  onMouseMoveCoords(callback) {
    this.coordListeners.push(callback);
  }

  registerClickHandler(handler) {
    this.clickHandlers.unshift(handler);
    return () => {
      this.clickHandlers = this.clickHandlers.filter(h => h !== handler);
    };
  }

  selectObject(objectType, objectData) {
    this.selectedObject = { type: objectType, data: objectData };
    window.dispatchEvent(new CustomEvent('dlpc:object-selected', { detail: this.selectedObject }));
  }

  clearSelection() {
    this.selectedObject = null;
    window.dispatchEvent(new CustomEvent('dlpc:object-deselected'));
  }
}

export const mapEngine = new MapEngine();
