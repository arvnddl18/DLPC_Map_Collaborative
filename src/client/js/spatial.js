/**
 * DLPC_Map_Collaborative - Two-Phase Spatial Proximity Engine
 * Efficiently computes spatial relationships between route polylines and 10,000+ NAPs.
 * Stage 1 (Broad Phase): AABB Bounding Box Pre-filter
 * Stage 2 (Narrow Phase): Point-to-Segment Minimum Geodesic Distance
 * 
 * Strict rule: NAPs are displayed whenever they fall within the configured proximity
 * distance of any active/visible route on the map, without requiring the user to click the route line.
 */

import { CONFIG } from './config.js';
import { mapEngine } from './map.js';
import { routeEngine } from './routing.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class SpatialEngine {
  constructor() {
    this.naps = new Map(); // id -> napData
    this.napMarkers = new Map(); // id -> L.CircleMarker
    this.proximityThresholdMeters = CONFIG.DEFAULT_PROXIMITY_THRESHOLD_METERS;
    this.activeRoute = null;
    this.visibleNapIds = new Set();

    // Listen for route changes (routes added, modified, or removed)
    window.addEventListener('dlpc:routes-changed', () => {
      this.recalculateVisibility();
    });
  }

  setNaps(napsList) {
    this.naps.clear();
    napsList.forEach(n => this.naps.set(n.id, n));
    this.recalculateVisibility();
  }

  addNap(nap) {
    this.naps.set(nap.id, nap);
    this.recalculateVisibility();
  }

  setProximityThreshold(meters) {
    this.proximityThresholdMeters = Math.max(1, parseInt(meters, 10));
    this.recalculateVisibility();
  }

  setActiveRoute(route) {
    this.activeRoute = route;
    this.recalculateVisibility();
  }

  /**
   * Recalculates NAP visibility strictly against routes on the map.
   * NAPs are automatically displayed when within the proximity threshold of ANY route on the map,
   * without requiring the user to click on the route line.
   */
  recalculateVisibility() {
    const newVisibleIds = new Set();
    const napDistances = new Map(); // id -> { distanceMeters, relatedRouteId, relatedRouteName }

    // If NAPs layer or Routes layer is toggled off, show zero
    if (mapEngine && mapEngine.layerVisibility) {
      if (mapEngine.layerVisibility.naps === false || mapEngine.layerVisibility.routes === false) {
        this.syncMarkers(newVisibleIds, napDistances);
        return;
      }
    }

    // Gather all target routes (active/preview route + all visible routes rendered on the map)
    const targetRoutes = [];
    if (this.activeRoute && (this.activeRoute.geometry || (this.activeRoute.startLat && this.activeRoute.endLat))) {
      targetRoutes.push(this.activeRoute);
    }

    if (routeEngine && routeEngine.routes) {
      for (const [, r] of routeEngine.routes) {
        if (!targetRoutes.some(tr => tr.id === r.id) && (r.geometry || (r.startLat && r.endLat))) {
          targetRoutes.push(r);
        }
      }
    }

    // Strictly show ZERO NAPs if there are no routes on the map
    if (targetRoutes.length === 0 || this.naps.size === 0) {
      this.syncMarkers(newVisibleIds, napDistances);
      return;
    }

    // 1 deg latitude ≈ 111,320 meters
    const bufferDeg = (this.proximityThresholdMeters * 2) / 111320;
    const thresholdMeters = this.proximityThresholdMeters;

    // Process proximity against each route on the map
    for (let rIdx = 0; rIdx < targetRoutes.length; rIdx++) {
      const route = targetRoutes[rIdx];
      let latLngs = [];
      if (Array.isArray(route.geometry)) {
        latLngs = route.geometry;
      } else if (typeof route.geometry === 'string') {
        try { latLngs = JSON.parse(route.geometry); } catch (e) { latLngs = []; }
      }
      if (latLngs.length < 2 && route.startLat && route.endLat) {
        latLngs = [[route.startLat, route.startLng], [route.endLat, route.endLng]];
      }

      if (latLngs.length < 2) continue;

      // -------------------------------------------------------------
      // STAGE 1: BROAD PHASE - AABB BOUNDING BOX FILTER FOR THIS ROUTE
      // -------------------------------------------------------------
      let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
      for (let i = 0; i < latLngs.length; i++) {
        const pt = latLngs[i];
        if (pt[0] < minLat) minLat = pt[0];
        if (pt[0] > maxLat) maxLat = pt[0];
        if (pt[1] < minLng) minLng = pt[1];
        if (pt[1] > maxLng) maxLng = pt[1];
      }

      minLat -= bufferDeg;
      maxLat += bufferDeg;
      minLng -= bufferDeg;
      maxLng += bufferDeg;

      // Filter candidate NAPs inside this route's bounding box
      const candidates = [];
      this.naps.forEach((nap) => {
        if (nap.latitude >= minLat && nap.latitude <= maxLat &&
            nap.longitude >= minLng && nap.longitude <= maxLng) {
          candidates.push(nap);
        }
      });

      // -------------------------------------------------------------
      // STAGE 2: NARROW PHASE - POINT-TO-SEGMENT DISTANCE
      // -------------------------------------------------------------
      for (let c = 0; c < candidates.length; c++) {
        const nap = candidates[c];
        let minDistance = Infinity;

        for (let s = 0; s < latLngs.length - 1; s++) {
          const segA = latLngs[s];
          const segB = latLngs[s + 1];
          const dist = this.pointToSegmentDistanceMeters(
            nap.latitude, nap.longitude,
            segA[0], segA[1],
            segB[0], segB[1]
          );

          if (dist < minDistance) {
            minDistance = dist;
            if (dist <= thresholdMeters) break; // Early exit
          }
        }

        if (minDistance <= thresholdMeters) {
          newVisibleIds.add(nap.id);
          const existingDist = napDistances.get(nap.id);
          if (!existingDist || minDistance < existingDist.distanceMeters) {
            napDistances.set(nap.id, {
              distanceMeters: Math.round(minDistance * 10) / 10,
              relatedRouteId: route.id,
              relatedRouteName: route.name || route.id
            });
          }
        }
      }
    }

    this.syncMarkers(newVisibleIds, napDistances);
  }

  /**
   * Geodesic point-to-segment distance using equirectangular projection.
   */
  pointToSegmentDistanceMeters(pLat, pLng, aLat, aLng, bLat, bLng) {
    const latRad = ((pLat + (aLat + bLat) / 2) / 2) * (Math.PI / 180);
    const cosLat = Math.cos(latRad);

    // Convert degrees to meters offset from A
    const ax = 0, ay = 0;
    const bx = (bLng - aLng) * 111320 * cosLat;
    const by = (bLat - aLat) * 111320;
    const px = (pLng - aLng) * 111320 * cosLat;
    const py = (pLat - aLat) * 111320;

    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
      return Math.sqrt(px * px + py * py);
    }

    // Projection parameter t clamped to [0, 1]
    let t = (px * dx + py * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = ax + t * dx;
    const projY = ay + t * dy;

    const distX = px - projX;
    const distY = py - projY;

    return Math.sqrt(distX * distX + distY * distY);
  }

  /**
   * Synchronizes Leaflet markers for visible NAPs.
   */
  syncMarkers(visibleIds, napDistances) {
    this.visibleNapIds = visibleIds;

    // Remove markers that are no longer visible
    this.napMarkers.forEach((marker, id) => {
      if (!visibleIds.has(id)) {
        mapEngine.layerGroups.naps.removeLayer(marker);
        this.napMarkers.delete(id);
      }
    });

    // Add or update markers for visible NAPs
    visibleIds.forEach(id => {
      const nap = this.naps.get(id);
      if (!nap) return;

      const distInfo = napDistances.get(id);
      const enrichedNap = {
        ...nap,
        distanceFromRoute: distInfo?.distanceMeters ?? 0,
        relatedRouteId: distInfo?.relatedRouteId ?? '',
        relatedRouteName: distInfo?.relatedRouteName ?? ''
      };

      const statusColor = nap.status === 'Planned' ? '#3b82f6' : (nap.status === 'Defective' ? '#ef4444' : '#10b981');
      const routeLabel = distInfo?.relatedRouteName ? `<br><span style="color:#94a3b8;font-size:11px;">Route: ${escapeHtml(distInfo.relatedRouteName)}</span>` : '';
      const infoSnippet = distInfo ? `${enrichedNap.distanceFromRoute}m from route` : `<span style="color:${statusColor};font-weight:600;">${nap.status || 'In Service'}</span>`;

      if (!this.napMarkers.has(id)) {
        const marker = L.circleMarker([nap.latitude, nap.longitude], {
          radius: 6,
          fillColor: statusColor,
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9
        });

        marker.bindTooltip(`<b>${escapeHtml(nap.id)}</b><br>${escapeHtml(nap.name)}<br><span style="color:${statusColor};font-weight:600;">${infoSnippet}</span>${routeLabel}`, {
          direction: 'top',
          offset: [0, -6]
        });

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          mapEngine.selectObject('nap', enrichedNap);
        });

        mapEngine.layerGroups.naps.addLayer(marker);
        this.napMarkers.set(id, marker);
      } else {
        // Update existing marker tooltip with current distance
        const marker = this.napMarkers.get(id);
        marker.setTooltipContent(`<b>${escapeHtml(nap.id)}</b><br>${escapeHtml(nap.name)}<br><span style="color:${statusColor};font-weight:600;">${infoSnippet}</span>${routeLabel}`);
      }
    });
  }

  clear() {
    this.napMarkers.forEach(m => mapEngine.layerGroups.naps.removeLayer(m));
    this.napMarkers.clear();
    this.naps.clear();
    this.visibleNapIds.clear();
  }
}

export const spatialEngine = new SpatialEngine();
