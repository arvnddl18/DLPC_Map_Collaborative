/**
 * DLPC_Map_Collaborative - Road-Aligned Routing and Geocoding Engine
 * Follows actual street networks via OSRM, supports reverse geocoding with dual
 * address tracking (generated vs corrected), tags, status states, and spatial linking.
 */

import { CONFIG } from './config.js';
import { mapEngine } from './map.js';
import { auth } from './auth.js';

export class RouteEngine {
  constructor() {
    this.routes = new Map(); // id -> routeData
    this.routeLayers = new Map(); // id -> L.Polyline
    this.activeRoute = null;
    this.statusColors = {
      Active: '#0284c7',       // DLPC Azure
      Planned: '#f59e0b',      // Amber
      Completed: '#10b981',    // Emerald
      Maintenance: '#ef4444'   // Coral Red
    };
  }

  /**
   * Validates coordinate inputs.
   */
  validateCoordinates(lat, lng) {
    const nLat = parseFloat(lat);
    const nLng = parseFloat(lng);
    if (isNaN(nLat) || isNaN(nLng)) return { valid: false, error: 'Coordinates must be valid numbers.' };
    if (nLat < -90 || nLat > 90) return { valid: false, error: 'Latitude must be between -90 and +90.' };
    if (nLng < -180 || nLng > 180) return { valid: false, error: 'Longitude must be between -180 and +180.' };
    return { valid: true, lat: nLat, lng: nLng };
  }

  /**
   * Reverse geocodes a coordinate to an address string using OSM Nominatim.
   */
  async reverseGeocode(lat, lng) {
    try {
      const url = `${CONFIG.GEOCODING.NOMINATIM_URL}?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en' }
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return data.display_name || `Location at ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch (e) {
      console.warn('Geocoding fallback:', e);
      return `Coordinate (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
    }
  }

  /**
   * Computes road-aligned routing using OSRM.
   */
  async calculateRoadRoute(startLat, startLng, endLat, endLng) {
    const vStart = this.validateCoordinates(startLat, startLng);
    const vEnd = this.validateCoordinates(endLat, endLng);
    if (!vStart.valid) throw new Error(`Start coordinate error: ${vStart.error}`);
    if (!vEnd.valid) throw new Error(`End coordinate error: ${vEnd.error}`);

    // OSRM expects coordinates in {lng},{lat} order
    const url = `${CONFIG.ROUTING.OSRM_URL}/${vStart.lng},${vStart.lat};${vEnd.lng},${vEnd.lat}?overview=full&geometries=geojson`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Routing service returned error. Verify coordinates.');
    const json = await res.json();

    if (!json.routes || json.routes.length === 0) {
      throw new Error('No road route found between the specified coordinates.');
    }

    const route = json.routes[0];
    // GeoJSON coordinates are [lng, lat], convert to Leaflet [lat, lng]
    const latLngs = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);

    return {
      geometry: latLngs,
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration)
    };
  }

  /**
   * Adds or updates a route on the map canvas.
   */
  renderRoute(routeData) {
    this.routes.set(routeData.id, routeData);

    let polylineCoords = [];
    if (Array.isArray(routeData.geometry)) {
      polylineCoords = routeData.geometry;
    } else if (typeof routeData.geometry === 'string') {
      try {
        polylineCoords = JSON.parse(routeData.geometry);
      } catch (e) {
        polylineCoords = [[routeData.startLat, routeData.startLng], [routeData.endLat, routeData.endLng]];
      }
    }

    // Existing layer update or creation
    let layer = this.routeLayers.get(routeData.id);
    const color = this.statusColors[routeData.status] || this.statusColors.Active;
    const displayName = routeData.name ? escapeHtml(routeData.name) : escapeHtml(routeData.id);
    const distText = routeData.distanceMeters ? `${(routeData.distanceMeters / 1000).toFixed(2)} km` : '';
    const tooltipHtml = `
      <div style="font-weight:600;font-size:12px;color:#f8fafc;">${displayName}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:2px;">${distText ? distText + ' • ' : ''}${escapeHtml(routeData.status || 'Active')}</div>
    `;

    if (layer) {
      layer.setLatLngs(polylineCoords);
      layer.setStyle({ color: color });
      layer.unbindTooltip();
      layer.bindTooltip(tooltipHtml, { sticky: true, className: 'dlpc-route-tooltip' });
    } else {
      layer = L.polyline(polylineCoords, {
        color: color,
        weight: 5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
        smoothFactor: 1.0
      });

      layer.bindTooltip(tooltipHtml, { sticky: true, className: 'dlpc-route-tooltip' });

      // Hover and click interaction
      layer.on('mouseover', () => {
        layer.setStyle({ weight: 7, opacity: 1 });
      });
      layer.on('mouseout', () => {
        if (this.activeRoute?.id !== routeData.id) {
          layer.setStyle({ weight: 5, opacity: 0.85 });
        }
      });
      layer.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        this.selectRoute(routeData.id);
      });

      mapEngine.layerGroups.routes.addLayer(layer);
      this.routeLayers.set(routeData.id, layer);
    }

    // Attach route endpoints markers
    this.renderEndpoints(routeData);

    // Notify system that routes have changed so spatialEngine updates visible NAPs automatically
    window.dispatchEvent(new CustomEvent('dlpc:routes-changed'));
  }

  renderEndpoints(routeData) {
    // Start marker (Green pin) and End marker (Red pin)
    if (!routeData.startLat || !routeData.endLat) return;
    // Layer handles endpoints
  }

  selectRoute(routeId) {
    const route = this.routes.get(routeId);
    if (!route) return;

    // Reset previous selection style
    if (this.activeRoute && this.routeLayers.has(this.activeRoute.id)) {
      const prevColor = this.statusColors[this.activeRoute.status] || this.statusColors.Active;
      this.routeLayers.get(this.activeRoute.id).setStyle({ weight: 5, color: prevColor });
    }

    this.activeRoute = route;
    const layer = this.routeLayers.get(routeId);
    if (layer) {
      layer.setStyle({ weight: 7, color: '#38bdf8' }); // Bright cyan highlight
      layer.bringToFront();
    }

    mapEngine.selectObject('route', route);
  }

  removeRoute(routeId) {
    if (this.routeLayers.has(routeId)) {
      mapEngine.layerGroups.routes.removeLayer(this.routeLayers.get(routeId));
      this.routeLayers.delete(routeId);
    }
    this.routes.delete(routeId);
    if (this.activeRoute?.id === routeId) {
      this.activeRoute = null;
      mapEngine.clearSelection();
    }
    window.dispatchEvent(new CustomEvent('dlpc:routes-changed'));
  }

  clear() {
    this.routeLayers.forEach(layer => mapEngine.layerGroups.routes.removeLayer(layer));
    this.routeLayers.clear();
    this.routes.clear();
    this.activeRoute = null;
    window.dispatchEvent(new CustomEvent('dlpc:routes-changed'));
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const routeEngine = new RouteEngine();
