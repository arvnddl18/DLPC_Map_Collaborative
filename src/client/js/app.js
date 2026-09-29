/**
 * DLPC_Map_Collaborative - Main Frontend Application Coordinator
 * Integrates GIS map, road-aligned routing, Canva vector drawing, streaming NAP parser,
 * two-phase spatial proximity, real-time collaboration, and cryptographic sharing.
 */

import { CONFIG } from './config.js';
import { auth } from './auth.js';
import { mapEngine } from './map.js';
import { routeEngine } from './routing.js';
import { drawingEngine } from './drawing.js';
import { spatialEngine } from './spatial.js';
import { collabEngine } from './collab.js';
import { shareEngine } from './share.js';

class ApplicationController {
  constructor() {
    this.mapData = null;
    this.tagsList = ['Fiber', 'NAP', 'Distribution', 'Underground', 'Aerial', 'Maintenance', 'Priority', 'Planned', 'Completed'];
    this.currentWorker = null;
    this.parsedNapImportData = null;
    this.isPickingCoord = null; // 'start' or 'end'
    this.currentActiveTool = 'select';
  }

  async init() {
    // 1. Initialize Authentication & Session
    await auth.init();

    // 2. Initialize Leaflet Map
    mapEngine.init('leaflet-map');

    // 3. Initialize Canva Vector Drawing Engine
    drawingEngine.init();

    // 4. Initialize Real-Time Collaboration & Presence
    collabEngine.init();

    // Attach singletons to window for testing and diagnostics
    window.app = this;
    window.auth = auth;
    window.drawingEngine = drawingEngine;
    window.collabEngine = collabEngine;
    window.mapEngine = mapEngine;
    window.routeEngine = routeEngine;

    // 5. Setup UI Event Listeners
    this.setupToolbar();
    this.setupRightPanel();
    this.setupModals();
    this.setupSearch();
    this.setupKeyboardShortcuts();
    this.setupAuthUI();

    // 6. Load Initial Map Data from Backend
    await this.loadMapData();

    // 7. Subscribe to Object Selection Events
    window.addEventListener('dlpc:object-selected', (e) => this.handleObjectSelected(e.detail));
    window.addEventListener('dlpc:object-deselected', () => this.handleObjectDeselected());
    window.addEventListener('dlpc:remote-mutation', (e) => this.handleRemoteMutation(e.detail));
    window.addEventListener('dlpc:drawing-saved', (e) => {
      collabEngine.broadcastObjectChange('CREATE', 'DRAWING', e.detail);
      this.syncDrawingToBackend(e.detail);
    });
    window.addEventListener('dlpc:drawing-deleted', (e) => {
      collabEngine.broadcastObjectChange('DELETE', 'DRAWING', e.detail);
      this.deleteDrawingFromBackend(e.detail.id);
    });
    window.addEventListener('dlpc:poll-drawings-sync', (e) => {
      const serverDrawings = e.detail || [];
      serverDrawings.forEach(d => {
        if (!drawingEngine.drawings.has(d.id)) {
          drawingEngine.addDrawing(d, false);
        }
      });
    });

    // 8. Update Status Bar Coordinates
    mapEngine.onMouseMoveCoords((lat, lng) => {
      const coordEl = document.getElementById('status-coords');
      if (coordEl) {
        coordEl.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      }
    });

    console.log('DLPC Collaborative Map Initialized Successfully');
  }

  async loadMapData() {
    try {
      const res = await fetch(CONFIG.API_BASE_URL || '/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'map:get',
          mapId: auth.mapId,
          ...auth.getAuthPayload()
        })
      });

      const data = await res.json();
      if (data.success) {
        this.mapData = data.map;
        const titleEl = document.getElementById('map-title-display');
        if (titleEl && data.map?.name) {
          titleEl.textContent = data.map.name;
        }

        // Render Routes
        if (data.routes) {
          data.routes.forEach(r => routeEngine.renderRoute(r));
        }

        // Render Drawings
        if (data.drawings) {
          data.drawings.forEach(d => drawingEngine.addDrawing(d, false));
        }

        // Render NAPs
        if (data.naps && data.naps.length > 0) {
          spatialEngine.setNaps(data.naps);
        } else {
          // Provide demo Davao NAPs if brand new empty database
          this.seedDemoNaps();
        }

        // Force recalculation so all NAPs within proximity of visible routes are shown automatically without clicking
        spatialEngine.recalculateVisibility();

        // Center map
        if (data.map?.centerLat && data.map?.centerLng) {
          mapEngine.panTo(data.map.centerLat, data.map.centerLng, data.map.zoom || 14);
        }
      }
    } catch (e) {
      console.warn('Backend load fallback. Using local database cache:', e);
      this.seedDemoNaps();
    }
  }

  seedDemoNaps() {
    // Curated high-voltage/fiber NAPs along Davao City corridors
    const demoDavaoNaps = [
      {
        id: 'DVO_007_L369_N01',
        name: 'NAP MT. APO CORNER GEN. LUNA',
        latitude: 7.071466,
        longitude: 125.604971,
        address: 'Cor Gen. Luna St & Mt. Apo St, Brgy 7-A, Davao City',
        city: 'Davao City',
        region: 'Davao South',
        status: 'In Service',
        capacity: 16,
        availablePorts: 12
      },
      {
        id: 'DVO_007_L369_N02',
        name: 'NAP GEN. LUNA COMMERCE BLDG',
        latitude: 7.071850,
        longitude: 125.605420,
        address: 'Gen. Luna St, Brgy 7-A, Davao City',
        city: 'Davao City',
        region: 'Davao South',
        status: 'In Service',
        capacity: 8,
        availablePorts: 4
      },
      {
        id: 'DVO_008_L102_N03',
        name: 'NAP JP LAUREL BAJADA HUB',
        latitude: 7.085120,
        longitude: 125.612450,
        address: 'JP Laurel Ave, Bajada, Davao City',
        city: 'Davao City',
        region: 'Davao North',
        status: 'In Service',
        capacity: 16,
        availablePorts: 7
      },
      {
        id: 'DVO_009_L210_N01',
        name: 'NAP LANANG PREMIER NETWORK',
        latitude: 7.108985,
        longitude: 125.614170,
        address: 'Lanang Commercial Complex, Lanang, Davao City',
        city: 'Davao City',
        region: 'Davao North',
        status: 'In Service',
        capacity: 24,
        availablePorts: 18
      },
      {
        id: 'DVO_009_L210_N02',
        name: 'NAP INSULAR VILLAGE CORRIDOR',
        latitude: 7.111776,
        longitude: 125.619294,
        address: 'Km 10, Lanang, Davao City',
        city: 'Davao City',
        region: 'Davao North',
        status: 'In Service',
        capacity: 16,
        availablePorts: 8
      }
    ];

    spatialEngine.setNaps(demoDavaoNaps);
  }

  // ==============================================================================
  // TOOLBAR INTERACTIONS
  // ==============================================================================
  setupToolbar() {
    const tools = document.querySelectorAll('.tool-btn');
    tools.forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        if (!tool) return;

        // Toggle behavior: if clicking the active tool again (other than default select), deactivate and revert to select
        if (tool === this.currentActiveTool && tool !== 'select') {
          this.setActiveTool('select');
          return;
        }

        this.setActiveTool(tool);
      });
    });

    // Listen to drawingEngine's tool-changed event to keep toolbar highlights 100% in sync
    window.addEventListener('dlpc:tool-changed', (e) => {
      const tool = e.detail;
      this.syncToolbarHighlight(tool);
    });

    // Share Button Trigger
    const shareBtn = document.getElementById('btn-share-modal');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => this.openShareModal());
    }

    // Undo / Redo
    const undoBtn = document.getElementById('btn-undo');
    if (undoBtn) undoBtn.addEventListener('click', () => drawingEngine.undo());
    const redoBtn = document.getElementById('btn-redo');
    if (redoBtn) redoBtn.addEventListener('click', () => drawingEngine.redo());
  }

  syncToolbarHighlight(tool) {
    this.currentActiveTool = tool || 'select';
    document.querySelectorAll('.tool-btn').forEach(btn => {
      if (btn.dataset.tool === this.currentActiveTool) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  setActiveTool(tool) {
    if (!tool) tool = 'select';

    // If attempting to use an editing/drawing tool without permissions, warn and keep select active
    const drawingTools = ['freehand', 'line', 'arrow', 'rect', 'circle', 'text', 'marker', 'move'];
    if (drawingTools.includes(tool) && !auth.canEdit()) {
      this.showToast('Editor or Administrator privileges required to use drawing tools.', 'warning');
      this.syncToolbarHighlight('select');
      drawingEngine.setTool('select');
      return;
    }

    // Close Route Planner panel if switching away to another tool
    if (this.currentActiveTool === 'route' && tool !== 'route') {
      const panel = document.getElementById('right-panel');
      if (panel && panel.dataset.mode === 'route') {
        panel.classList.remove('open');
        delete panel.dataset.mode;
      }
    }

    // Close modals if switching away
    if (this.currentActiveTool === 'layers' && tool !== 'layers') {
      const m = document.getElementById('modal-layers');
      if (m) m.classList.remove('open');
    }
    if (this.currentActiveTool === 'import' && tool !== 'import') {
      const m = document.getElementById('modal-import');
      if (m) m.classList.remove('open');
    }

    this.syncToolbarHighlight(tool);

    if (tool === 'route') {
      drawingEngine.setTool('select');
      this.openRoutePlanner();
    } else if (tool === 'layers') {
      drawingEngine.setTool('select');
      this.openModal('modal-layers');
    } else if (tool === 'import') {
      drawingEngine.setTool('select');
      if (!auth.canAdmin()) {
        this.showToast('Administrator privileges required to import NAP files.', 'warning');
        this.setActiveTool('select');
        return;
      }
      this.openModal('modal-import');
    } else {
      // Drawing / selection tools: 'select', 'move', 'freehand', 'line', 'arrow', 'rect', 'circle', 'text', 'marker'
      const panel = document.getElementById('right-panel');
      if (panel && panel.dataset.mode === 'route') {
        panel.classList.remove('open');
        delete panel.dataset.mode;
      }
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));

      if (drawingEngine.activeTool !== tool) {
        drawingEngine.setTool(tool);
      }
      if (tool === 'move') {
        this.showToast('Move tool: Click and drag any drawing, text, or pin to move it.', 'info');
      }
    }
  }

  // ==============================================================================
  // CONTEXT-SENSITIVE RIGHT PANEL (INSPECTOR)
  // ==============================================================================
  setupRightPanel() {
    const panel = document.getElementById('right-panel');
    const closeBtn = document.getElementById('panel-close-btn');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        panel.classList.remove('open');
        delete panel.dataset.mode;
        mapEngine.clearSelection();
        if (routeEngine.activeRoute) {
          const prevColor = routeEngine.statusColors[routeEngine.activeRoute.status] || routeEngine.statusColors.Active;
          const layer = routeEngine.routeLayers.get(routeEngine.activeRoute.id);
          if (layer) layer.setStyle({ weight: 5, color: prevColor });
          routeEngine.activeRoute = null;
        }
        spatialEngine.setActiveRoute(null);
        if (this.currentActiveTool === 'route') {
          this.setActiveTool('select');
        }
      });
    }

    // Map click coord picker for route planner
    mapEngine.registerClickHandler((e) => {
      if (this.isPickingCoord === 'start') {
        document.getElementById('route-start-lat').value = e.latlng.lat.toFixed(6);
        document.getElementById('route-start-lng').value = e.latlng.lng.toFixed(6);
        this.isPickingCoord = null;
        this.showToast('Start coordinate selected.', 'success');
        this.lookupAddress('start', e.latlng.lat, e.latlng.lng, true);
        return true;
      }
      if (this.isPickingCoord === 'end') {
        document.getElementById('route-end-lat').value = e.latlng.lat.toFixed(6);
        document.getElementById('route-end-lng').value = e.latlng.lng.toFixed(6);
        this.isPickingCoord = null;
        this.showToast('End coordinate selected.', 'success');
        this.lookupAddress('end', e.latlng.lat, e.latlng.lng, true);
        return true;
      }
      return false;
    });
  }

  openRoutePlanner(existingRoute = null) {
    const panel = document.getElementById('right-panel');
    const title = document.getElementById('panel-title');
    const badge = document.getElementById('panel-badge');
    const body = document.getElementById('panel-body');
    const footer = document.getElementById('panel-footer');

    panel.dataset.mode = 'route';
    this.syncToolbarHighlight('route');

    const routeName = existingRoute ? (existingRoute.name || existingRoute.id) : '';
    title.textContent = existingRoute ? `Route: ${routeName}` : 'Create Road Route';
    badge.textContent = 'ROUTING';

    const startLat = existingRoute ? existingRoute.startLat : '7.108985';
    const startLng = existingRoute ? existingRoute.startLng : '125.614170';
    const endLat = existingRoute ? existingRoute.endLat : '7.111776';
    const endLng = existingRoute ? existingRoute.endLng : '125.619294';
    const genStart = existingRoute?.generatedStartAddress || '';
    const corrStart = existingRoute?.correctedStartAddress || '';
    const genEnd = existingRoute?.generatedEndAddress || '';
    const corrEnd = existingRoute?.correctedEndAddress || '';

    body.innerHTML = `
      <div class="form-group">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <label class="form-label" for="route-name-input" style="margin-bottom:0;">Route Name</label>
          <span style="font-size:0.72rem; color:var(--accent-primary); font-weight:600;">EDITABLE</span>
        </div>
        <input type="text" id="route-name-input" class="form-input" value="${escapeHtml(routeName)}" placeholder="e.g., Buhangin - F.S. Dizon Feeder Route" style="font-weight:500;">
      </div>

      <div class="form-group">
        <label class="form-label">Start Coordinate (Lat, Lng)</label>
        <div class="coords-row">
          <input type="text" id="route-start-lat" class="form-input coords-input" value="${startLat}" placeholder="Latitude">
          <input type="text" id="route-start-lng" class="form-input coords-input" value="${startLng}" placeholder="Longitude">
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-pick-start" style="margin-top:4px;">
          📍 Pick Start on Map
        </button>
      </div>

      <div class="form-group">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <label class="form-label" style="margin-bottom:0;">Generated Start Address (Read-only)</label>
          <button type="button" class="btn btn-secondary btn-xs" id="btn-lookup-start-addr" title="Re-generate address from current coordinates">🔄 Auto-lookup</button>
        </div>
        <input type="text" id="route-gen-start" class="form-input" value="${escapeHtml(genStart)}" readonly style="opacity:0.85; cursor:default;">
      </div>

      <div class="form-group">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <label class="form-label" style="margin-bottom:0;">Editable Start Address (Admin/Editor)</label>
          <span style="font-size:0.72rem; color:var(--accent-primary); font-weight:600;">EDITABLE</span>
        </div>
        <input type="text" id="route-corr-start" class="form-input" value="${escapeHtml(corrStart || genStart)}" placeholder="Enter operational start address">
      </div>

      <div class="form-group">
        <label class="form-label">End Coordinate (Lat, Lng)</label>
        <div class="coords-row">
          <input type="text" id="route-end-lat" class="form-input coords-input" value="${endLat}" placeholder="Latitude">
          <input type="text" id="route-end-lng" class="form-input coords-input" value="${endLng}" placeholder="Longitude">
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-pick-end" style="margin-top:4px;">
          📍 Pick End on Map
        </button>
      </div>

      <div class="form-group">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <label class="form-label" style="margin-bottom:0;">Generated End Address (Read-only)</label>
          <button type="button" class="btn btn-secondary btn-xs" id="btn-lookup-end-addr" title="Re-generate address from current coordinates">🔄 Auto-lookup</button>
        </div>
        <input type="text" id="route-gen-end" class="form-input" value="${escapeHtml(genEnd)}" readonly style="opacity:0.85; cursor:default;">
      </div>

      <div class="form-group">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <label class="form-label" style="margin-bottom:0;">Editable End Address (Admin/Editor)</label>
          <span style="font-size:0.72rem; color:var(--accent-primary); font-weight:600;">EDITABLE</span>
        </div>
        <input type="text" id="route-corr-end" class="form-input" value="${escapeHtml(corrEnd || genEnd)}" placeholder="Enter operational end address">
      </div>

      <div class="metric-pill">
        <span class="metric-pill-label">Road Distance</span>
        <span class="metric-pill-val" id="route-distance-val">${existingRoute?.distanceMeters ? (existingRoute.distanceMeters / 1000).toFixed(2) + ' km' : '--'}</span>
      </div>

      <div class="form-group">
        <label class="form-label">Status</label>
        <select id="route-status-select" class="form-select">
          <option value="Active" ${existingRoute?.status === 'Active' ? 'selected' : ''}>Active</option>
          <option value="Planned" ${existingRoute?.status === 'Planned' ? 'selected' : ''}>Planned</option>
          <option value="Completed" ${existingRoute?.status === 'Completed' ? 'selected' : ''}>Completed</option>
          <option value="Maintenance" ${existingRoute?.status === 'Maintenance' ? 'selected' : ''}>Maintenance</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Tags</label>
        <div class="tags-container" id="route-tags-container"></div>
        <input type="text" id="route-tag-input" class="form-input" placeholder="Type tag and press Enter" style="margin-top:6px;">
      </div>

      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea id="route-notes" class="form-textarea" placeholder="Add operational notes...">${escapeHtml(existingRoute?.notes || '')}</textarea>
      </div>
    `;

    footer.innerHTML = `
      <button type="button" class="btn btn-secondary" id="btn-calc-route">⚡ Generate Road Route</button>
      <button type="button" class="btn btn-primary" id="btn-save-route">Save Route</button>
      ${existingRoute ? '<button type="button" class="btn btn-danger" id="btn-delete-route">Delete</button>' : ''}
    `;

    // Real-time title sync with Route Name input
    const routeNameInput = document.getElementById('route-name-input');
    routeNameInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      title.textContent = val ? `Route: ${val}` : (existingRoute ? `Route: ${existingRoute.id}` : 'Create Road Route');
    });

    // Track manual edits to corrected addresses
    const corrStartEl = document.getElementById('route-corr-start');
    const corrEndEl = document.getElementById('route-corr-end');
    if (corrStart && corrStart !== genStart) {
      corrStartEl.dataset.userEdited = 'true';
    }
    if (corrEnd && corrEnd !== genEnd) {
      corrEndEl.dataset.userEdited = 'true';
    }
    corrStartEl.addEventListener('input', () => {
      corrStartEl.dataset.userEdited = 'true';
    });
    corrEndEl.addEventListener('input', () => {
      corrEndEl.dataset.userEdited = 'true';
    });

    // Auto lookup address on coordinate change
    const triggerStartLookup = () => {
      const lat = document.getElementById('route-start-lat')?.value.trim();
      const lng = document.getElementById('route-start-lng')?.value.trim();
      const v = routeEngine.validateCoordinates(lat, lng);
      if (v.valid) {
        this.lookupAddress('start', v.lat, v.lng, false);
      }
    };
    const triggerEndLookup = () => {
      const lat = document.getElementById('route-end-lat')?.value.trim();
      const lng = document.getElementById('route-end-lng')?.value.trim();
      const v = routeEngine.validateCoordinates(lat, lng);
      if (v.valid) {
        this.lookupAddress('end', v.lat, v.lng, false);
      }
    };

    document.getElementById('route-start-lat').addEventListener('change', triggerStartLookup);
    document.getElementById('route-start-lng').addEventListener('change', triggerStartLookup);
    document.getElementById('route-end-lat').addEventListener('change', triggerEndLookup);
    document.getElementById('route-end-lng').addEventListener('change', triggerEndLookup);

    // Refresh address buttons
    document.getElementById('btn-lookup-start-addr')?.addEventListener('click', () => {
      const lat = document.getElementById('route-start-lat')?.value.trim();
      const lng = document.getElementById('route-start-lng')?.value.trim();
      const v = routeEngine.validateCoordinates(lat, lng);
      if (v.valid) {
        this.lookupAddress('start', v.lat, v.lng, true);
        this.showToast('Start address re-generated.', 'info');
      } else {
        this.showToast(`Invalid start coordinates: ${v.error}`, 'warning');
      }
    });

    document.getElementById('btn-lookup-end-addr')?.addEventListener('click', () => {
      const lat = document.getElementById('route-end-lat')?.value.trim();
      const lng = document.getElementById('route-end-lng')?.value.trim();
      const v = routeEngine.validateCoordinates(lat, lng);
      if (v.valid) {
        this.lookupAddress('end', v.lat, v.lng, true);
        this.showToast('End address re-generated.', 'info');
      } else {
        this.showToast(`Invalid end coordinates: ${v.error}`, 'warning');
      }
    });

    // Render tags
    let currentTags = [];
    if (existingRoute?.tags) {
      currentTags = typeof existingRoute.tags === 'string' ? JSON.parse(existingRoute.tags) : existingRoute.tags;
    }
    this.renderTagChips(currentTags, 'route-tags-container');

    // Attach Tag input handler
    const tagInput = document.getElementById('route-tag-input');
    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && tagInput.value.trim()) {
        e.preventDefault();
        const tag = tagInput.value.trim();
        if (!currentTags.includes(tag)) {
          currentTags.push(tag);
          this.renderTagChips(currentTags, 'route-tags-container');
        }
        tagInput.value = '';
      }
    });

    // Attach Coord Pickers
    document.getElementById('btn-pick-start').addEventListener('click', () => {
      this.isPickingCoord = 'start';
      this.showToast('Click anywhere on the map to set the START point.', 'info');
    });
    document.getElementById('btn-pick-end').addEventListener('click', () => {
      this.isPickingCoord = 'end';
      this.showToast('Click anywhere on the map to set the END point.', 'info');
    });

    // Auto lookup addresses if empty
    if (!genStart) {
      this.lookupAddress('start', startLat, startLng, true);
    }
    if (!genEnd) {
      this.lookupAddress('end', endLat, endLng, true);
    }

    // Attach Calculate Route Button
    let computedGeometry = existingRoute?.geometry || null;
    let computedDistance = existingRoute?.distanceMeters || 0;

    const calcBtn = document.getElementById('btn-calc-route');
    calcBtn.addEventListener('click', async () => {
      const sLat = document.getElementById('route-start-lat').value.trim();
      const sLng = document.getElementById('route-start-lng').value.trim();
      const eLat = document.getElementById('route-end-lat').value.trim();
      const eLng = document.getElementById('route-end-lng').value.trim();

      const vStart = routeEngine.validateCoordinates(sLat, sLng);
      const vEnd = routeEngine.validateCoordinates(eLat, eLng);
      if (!vStart.valid) {
        this.showToast(`Start coordinate error: ${vStart.error}`, 'danger');
        return;
      }
      if (!vEnd.valid) {
        this.showToast(`End coordinate error: ${vEnd.error}`, 'danger');
        return;
      }

      try {
        calcBtn.textContent = '⚡ Aligning Route & Generating Addresses...';
        calcBtn.disabled = true;

        // Concurrently calculate route alignment and reverse-geocode start and end coordinates
        const [res] = await Promise.all([
          routeEngine.calculateRoadRoute(sLat, sLng, eLat, eLng),
          this.lookupAddress('start', sLat, sLng, true),
          this.lookupAddress('end', eLat, eLng, true)
        ]);

        computedGeometry = res.geometry;
        computedDistance = res.distanceMeters;

        document.getElementById('route-distance-val').textContent = `${(res.distanceMeters / 1000).toFixed(2)} km (${res.distanceMeters} m)`;
        this.showToast(`Road route aligned: ${(res.distanceMeters / 1000).toFixed(2)} km. Addresses updated.`, 'success');

        const activeName = document.getElementById('route-name-input')?.value.trim() || (existingRoute ? (existingRoute.name || existingRoute.id) : 'PREVIEW');

        // Draw preview route on map
        routeEngine.renderRoute({
          id: existingRoute ? existingRoute.id : 'PREVIEW',
          name: activeName,
          geometry: res.geometry,
          status: document.getElementById('route-status-select').value,
          startLat: parseFloat(sLat),
          startLng: parseFloat(sLng),
          endLat: parseFloat(eLat),
          endLng: parseFloat(eLng)
        });

        // Trigger spatial calculation for NAPs
        spatialEngine.setActiveRoute({
          id: existingRoute ? existingRoute.id : 'PREVIEW',
          name: activeName,
          geometry: res.geometry
        });
      } catch (err) {
        this.showToast(err.message, 'danger');
      } finally {
        calcBtn.textContent = '⚡ Generate Road Route';
        calcBtn.disabled = false;
      }
    });

    // Attach Save Route Button
    document.getElementById('btn-save-route').addEventListener('click', async () => {
      if (!auth.canEdit()) {
        this.showToast('You do not have permission to create or edit routes.', 'warning');
        return;
      }

      const sLat = parseFloat(document.getElementById('route-start-lat').value);
      const sLng = parseFloat(document.getElementById('route-start-lng').value);
      const eLat = parseFloat(document.getElementById('route-end-lat').value);
      const eLng = parseFloat(document.getElementById('route-end-lng').value);

      if (!computedGeometry) {
        try {
          const res = await routeEngine.calculateRoadRoute(sLat, sLng, eLat, eLng);
          computedGeometry = res.geometry;
          computedDistance = res.distanceMeters;
        } catch (err) {
          this.showToast('Please calculate a valid road route before saving.', 'warning');
          return;
        }
      }

      const routeId = existingRoute ? existingRoute.id : ('ROUTE-' + Math.random().toString(36).substring(2, 7).toUpperCase());
      const enteredName = document.getElementById('route-name-input').value.trim();
      const finalRouteName = enteredName || (existingRoute ? (existingRoute.name || routeId) : routeId);

      const routePayload = {
        id: routeId,
        name: finalRouteName,
        mapId: auth.mapId,
        startLat: sLat,
        startLng: sLng,
        endLat: eLat,
        endLng: eLng,
        generatedStartAddress: document.getElementById('route-gen-start').value,
        correctedStartAddress: document.getElementById('route-corr-start').value,
        generatedEndAddress: document.getElementById('route-gen-end').value,
        correctedEndAddress: document.getElementById('route-corr-end').value,
        geometry: computedGeometry,
        distanceMeters: computedDistance,
        status: document.getElementById('route-status-select').value,
        tags: currentTags,
        notes: document.getElementById('route-notes').value
      };

      routeEngine.renderRoute(routePayload);
      spatialEngine.setActiveRoute(routePayload);
      collabEngine.broadcastObjectChange('CREATE', 'ROUTE', routePayload);
      this.syncRouteToBackend(routePayload);

      this.showToast(`Route "${finalRouteName}" saved successfully.`, 'success');
      panel.classList.remove('open');
      delete panel.dataset.mode;
      this.setActiveTool('select');
    });

    // Attach Delete Button
    const deleteBtn = document.getElementById('btn-delete-route');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        if (!auth.canEdit()) return;
        const displayName = existingRoute.name || existingRoute.id;
        if (confirm(`Delete route "${displayName}"?`)) {
          routeEngine.removeRoute(existingRoute.id);
          collabEngine.broadcastObjectChange('DELETE', 'ROUTE', { id: existingRoute.id });
          this.deleteRouteFromBackend(existingRoute.id);
          panel.classList.remove('open');
          delete panel.dataset.mode;
          this.setActiveTool('select');
          this.showToast(`Route "${displayName}" deleted.`, 'info');
        }
      });
    }

    panel.classList.add('open');
  }

  async lookupAddress(type, lat, lng, forceUpdateEditable = false) {
    const isStart = type === 'start';
    const genEl = document.getElementById(isStart ? 'route-gen-start' : 'route-gen-end');
    const corrEl = document.getElementById(isStart ? 'route-corr-start' : 'route-corr-end');

    if (genEl) {
      genEl.placeholder = 'Resolving address...';
    }

    const addr = await routeEngine.reverseGeocode(parseFloat(lat), parseFloat(lng));

    if (genEl) {
      genEl.value = addr;
    }
    if (corrEl) {
      const isUserEdited = corrEl.dataset.userEdited === 'true';
      if (forceUpdateEditable || !corrEl.value || !isUserEdited) {
        corrEl.value = addr;
        corrEl.dataset.userEdited = 'false';
      }
    }
    return addr;
  }

  handleObjectSelected(selected) {
    if (selected.type === 'route') {
      spatialEngine.setActiveRoute(selected.data);
      this.openRoutePlanner(selected.data);
    } else if (selected.type === 'nap') {
      this.openNapInspector(selected.data);
    } else if (selected.type === 'drawing') {
      this.openDrawingInspector(selected.data);
    }
  }

  handleObjectDeselected() {
    const panel = document.getElementById('right-panel');
    if (panel) {
      panel.classList.remove('open');
      delete panel.dataset.mode;
    }
    if (routeEngine.activeRoute) {
      const prevColor = routeEngine.statusColors[routeEngine.activeRoute.status] || routeEngine.statusColors.Active;
      const layer = routeEngine.routeLayers.get(routeEngine.activeRoute.id);
      if (layer) layer.setStyle({ weight: 5, color: prevColor });
      routeEngine.activeRoute = null;
    }
    spatialEngine.setActiveRoute(null);
    if (this.currentActiveTool === 'route') {
      this.setActiveTool('select');
    }
  }

  openNapInspector(nap) {
    const panel = document.getElementById('right-panel');
    const title = document.getElementById('panel-title');
    const badge = document.getElementById('panel-badge');
    const body = document.getElementById('panel-body');
    const footer = document.getElementById('panel-footer');

    title.textContent = `NAP: ${nap.id}`;
    badge.textContent = nap.region || 'Davao';

    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">Facility Name</label>
        <input type="text" id="nap-edit-name" class="form-input" value="${escapeHtml(nap.name || '')}">
      </div>

      <div class="metric-pill">
        <span class="metric-pill-label">Distance from Route</span>
        <span class="metric-pill-val">${nap.distanceFromRoute !== undefined ? `${nap.distanceFromRoute} meters` : 'On Route'}</span>
      </div>

      <div class="metric-pill">
        <span class="metric-pill-label">Related Route</span>
        <span class="metric-pill-val">${(() => {
          if (!nap.relatedRouteId) return 'None';
          const r = routeEngine.routes.get(nap.relatedRouteId);
          return r && r.name ? `${escapeHtml(r.name)} (${nap.relatedRouteId})` : escapeHtml(nap.relatedRouteId);
        })()}</span>
      </div>

      <div class="form-group">
        <label class="form-label">Coordinates</label>
        <div class="coords-row">
          <input type="text" class="form-input coords-input" value="${nap.latitude}" readonly>
          <input type="text" class="form-input coords-input" value="${nap.longitude}" readonly>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Address</label>
        <textarea id="nap-edit-address" class="form-textarea">${escapeHtml(nap.address || '')}</textarea>
      </div>

      <div class="coords-row">
        <div class="form-group">
          <label class="form-label">Total Ports</label>
          <input type="number" id="nap-edit-capacity" class="form-input" value="${nap.capacity || 8}">
        </div>
        <div class="form-group">
          <label class="form-label">Available Ports</label>
          <input type="number" id="nap-edit-avail" class="form-input" value="${nap.availablePorts || 8}">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Status</label>
        <select id="nap-edit-status" class="form-select">
          <option value="In Service" ${nap.status === 'In Service' ? 'selected' : ''}>In Service</option>
          <option value="Planned" ${nap.status === 'Planned' ? 'selected' : ''}>Planned</option>
          <option value="Maintenance" ${nap.status === 'Maintenance' ? 'selected' : ''}>Maintenance</option>
        </select>
      </div>
    `;

    footer.innerHTML = `
      <button type="button" class="btn btn-primary" id="btn-save-nap">Save Changes</button>
    `;

    document.getElementById('btn-save-nap').addEventListener('click', () => {
      if (!auth.canEdit()) {
        this.showToast('You do not have permission to edit NAPs.', 'warning');
        return;
      }
      nap.name = document.getElementById('nap-edit-name').value;
      nap.address = document.getElementById('nap-edit-address').value;
      nap.status = document.getElementById('nap-edit-status').value;
      nap.capacity = parseInt(document.getElementById('nap-edit-capacity').value, 10);
      nap.availablePorts = parseInt(document.getElementById('nap-edit-avail').value, 10);

      spatialEngine.addNap(nap);
      collabEngine.broadcastObjectChange('UPDATE', 'NAP', nap);
      this.syncNapToBackend(nap);
      this.showToast(`NAP ${nap.id} updated.`, 'success');
      panel.classList.remove('open');
    });

    panel.classList.add('open');
  }

  openDrawingInspector(drawing) {
    const panel = document.getElementById('right-panel');
    const title = document.getElementById('panel-title');
    const badge = document.getElementById('panel-badge');
    const body = document.getElementById('panel-body');
    const footer = document.getElementById('panel-footer');

    title.textContent = `Drawing: ${drawing.id}`;
    badge.textContent = drawing.type.toUpperCase();

    const isText = drawing.type === 'text';
    const canEditColors = auth.canEdit();

    if (isText) {
      // Text label inspector: font color fixed to pure black, background color picker for admin/editor, font size selector
      body.innerHTML = `
        <div class="form-group">
          <label class="form-label">Label Text</label>
          <input type="text" id="draw-text" class="form-input" value="${escapeHtml(drawing.text || '')}">
        </div>

        <div class="form-group">
          <label class="form-label">Font Color</label>
          <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);">
            <div style="width:20px;height:20px;border-radius:4px;background:#000000;border:1px solid var(--border-medium);flex-shrink:0;"></div>
            <span style="font-size:12px;color:var(--text-secondary);">#000000 — Pure Black (default)</span>
          </div>
        </div>

        ${canEditColors ? `
        <div class="form-group">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <label class="form-label" style="margin-bottom:0;">Text Background Color</label>
            <span style="font-size:0.72rem;color:var(--accent-primary);font-weight:600;">ADMIN/EDITOR</span>
          </div>
          <input type="color" id="draw-bg-color" class="form-input" value="${drawing.style?.fillColor || '#131a26'}" style="height:40px;cursor:pointer;">
        </div>
        ` : `
        <div class="form-group">
          <label class="form-label">Text Background Color</label>
          <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);opacity:0.6;">
            <div style="width:20px;height:20px;border-radius:4px;background:${drawing.style?.fillColor || '#131a26'};border:1px solid var(--border-medium);flex-shrink:0;"></div>
            <span style="font-size:12px;color:var(--text-muted);">View-only</span>
          </div>
        </div>
        `}

        <div class="form-group">
          <label class="form-label">Font Size</label>
          <select id="draw-font-size" class="form-select">
            ${[10, 12, 14, 16, 18, 20, 24, 28, 32].map(s =>
              `<option value="${s}" ${(drawing.style?.fontSize || 12) === s ? 'selected' : ''}>${s}px</option>`
            ).join('')}
          </select>
        </div>

        <div class="metric-pill">
          <span class="metric-pill-label">Author</span>
          <span class="metric-pill-val">${drawing.createdBy || 'Editor'}</span>
        </div>
      `;
    } else {
      // Shape inspector: stroke color + line width
      body.innerHTML = `
        <div class="form-group">
          <label class="form-label">Stroke Color</label>
          <input type="color" id="draw-color" class="form-input" value="${drawing.style?.color || '#0284c7'}" style="height:40px;cursor:pointer;">
        </div>

        <div class="form-group">
          <label class="form-label">Line Width (px)</label>
          <input type="range" id="draw-weight" min="1" max="10" value="${drawing.style?.weight || 3}">
        </div>

        <div class="metric-pill">
          <span class="metric-pill-label">Author</span>
          <span class="metric-pill-val">${drawing.createdBy || 'Editor'}</span>
        </div>
      `;
    }

    footer.innerHTML = `
      <button type="button" class="btn btn-danger" id="btn-delete-drawing">Delete Drawing</button>
      <button type="button" class="btn btn-primary" id="btn-save-drawing">Apply</button>
    `;

    document.getElementById('btn-save-drawing').addEventListener('click', () => {
      if (!auth.canEdit()) return;

      let updates;
      if (isText) {
        const bgColorEl = document.getElementById('draw-bg-color');
        const fontSizeEl = document.getElementById('draw-font-size');
        updates = {
          style: {
            ...drawing.style,
            textColor: '#000000',
            fillColor: bgColorEl ? bgColorEl.value : (drawing.style?.fillColor || '#131a26'),
            fontSize: fontSizeEl ? parseInt(fontSizeEl.value, 10) : (drawing.style?.fontSize || 12)
          }
        };
        const textInput = document.getElementById('draw-text');
        if (textInput) updates.text = textInput.value;
      } else {
        updates = {
          style: {
            ...drawing.style,
            color: document.getElementById('draw-color').value,
            weight: parseInt(document.getElementById('draw-weight').value, 10)
          }
        };
      }

      drawingEngine.updateDrawing(drawing.id, updates);
      this.showToast('Drawing properties updated.', 'success');
      panel.classList.remove('open');
    });

    document.getElementById('btn-delete-drawing').addEventListener('click', () => {
      if (!auth.canEdit()) return;
      drawingEngine.deleteDrawing(drawing.id);
      this.showToast('Drawing deleted.', 'info');
      panel.classList.remove('open');
    });

    panel.classList.add('open');
  }

  renderTagChips(tags, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    tags.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip active';
      chip.innerHTML = `${escapeHtml(tag)} <span class="tag-remove-btn">&times;</span>`;
      chip.querySelector('.tag-remove-btn').addEventListener('click', () => {
        const idx = tags.indexOf(tag);
        if (idx !== -1) tags.splice(idx, 1);
        this.renderTagChips(tags, containerId);
      });
      container.appendChild(chip);
    });
  }

  // ==============================================================================
  // SEARCH FUNCTIONALITY
  // ==============================================================================
  setupSearch() {
    const input = document.getElementById('global-search-input');
    const clearBtn = document.getElementById('search-clear-btn');
    if (!input) return;

    let debounceTimer = null;
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      clearBtn.style.display = q ? 'block' : 'none';

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => this.executeSearch(q), 300);
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      mapEngine.clearSelection();
    });
  }

  executeSearch(query) {
    if (!query) return;

    // Search Routes by ID, Name, notes, or tags
    for (const [id, route] of routeEngine.routes) {
      if (id.toLowerCase().includes(query) ||
          (route.name && route.name.toLowerCase().includes(query)) ||
          (route.notes && route.notes.toLowerCase().includes(query))) {
        routeEngine.selectRoute(id);
        mapEngine.panTo(route.startLat, route.startLng, 16);
        this.showToast(`Found Route: ${route.name || id}`, 'info');
        return;
      }
    }

    // Search NAPs by ID, Name, or Address
    for (const [id, nap] of spatialEngine.naps) {
      if (id.toLowerCase().includes(query) ||
          (nap.name && nap.name.toLowerCase().includes(query)) ||
          (nap.address && nap.address.toLowerCase().includes(query))) {
        mapEngine.panTo(nap.latitude, nap.longitude, 17);
        mapEngine.selectObject('nap', nap);
        this.showToast(`Found NAP: ${nap.id} (${nap.name})`, 'info');
        return;
      }
    }

    // Check if query is latitude, longitude
    const coordParts = query.split(/[\s,]+/);
    if (coordParts.length === 2) {
      const lat = parseFloat(coordParts[0]);
      const lng = parseFloat(coordParts[1]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        mapEngine.panTo(lat, lng, 16);
        this.showToast(`Navigated to coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`, 'info');
        return;
      }
    }

    this.showToast('No matching route, NAP, or location found.', 'warning');
  }

  // ==============================================================================
  // STREAMING NAP IMPORT MODAL (345MB CSV & XLSX)
  // ==============================================================================
  setupModals() {
    // Modal Close buttons
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
        if (this.currentActiveTool === 'layers' || this.currentActiveTool === 'import') {
          this.setActiveTool('select');
        }
      });
    });

    // Close on overlay backdrop click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('open');
          if (this.currentActiveTool === 'layers' || this.currentActiveTool === 'import') {
            this.setActiveTool('select');
          }
        }
      });
    });

    // Dropzone setup
    const dropzone = document.getElementById('nap-file-dropzone');
    const fileInput = document.getElementById('nap-file-input');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
          this.processNapFile(e.dataTransfer.files[0]);
        }
      });
      fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
          this.processNapFile(fileInput.files[0]);
        }
      });
    }

    // Confirm Import Button
    const confirmBtn = document.getElementById('btn-confirm-import');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => this.commitNapImport());
    }

    // Layer Controls
    const proximitySlider = document.getElementById('slider-proximity');
    const proximityDisplay = document.getElementById('val-proximity');
    if (proximitySlider && proximityDisplay) {
      proximitySlider.addEventListener('input', () => {
        const val = proximitySlider.value;
        proximityDisplay.textContent = `${val} meters`;
        spatialEngine.setProximityThreshold(val);
      });
    }

    // Tile Layer switchers
    document.querySelectorAll('.tile-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tile-select-btn').forEach(b => b.classList.remove('btn-primary'));
        btn.classList.add('btn-primary');
        mapEngine.setTileLayer(btn.dataset.tile);
      });
    });

    // Layer Checkboxes
    ['routes', 'naps', 'drawings', 'collaborators'].forEach(layerName => {
      const chk = document.getElementById(`chk-layer-${layerName}`);
      if (chk) {
        chk.addEventListener('change', () => {
          mapEngine.toggleLayer(layerName, chk.checked);
          if (layerName === 'routes' || layerName === 'naps') {
            spatialEngine.recalculateVisibility();
          }
        });
      }
    });
  }

  processNapFile(file) {
    const isCsv = file.name.toLowerCase().endsWith('.csv');
    const isXlsx = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

    if (!isCsv && !isXlsx) {
      this.showToast('Please select a valid .csv or .xlsx spreadsheet file.', 'danger');
      return;
    }

    const progressBox = document.getElementById('import-progress-box');
    const progressBar = document.getElementById('import-progress-bar');
    const progressText = document.getElementById('import-progress-text');
    const previewBox = document.getElementById('import-preview-box');
    const scopeBox = document.getElementById('import-scope-box');
    const confirmBtn = document.getElementById('btn-confirm-import');

    progressBox.style.display = 'block';
    previewBox.style.display = 'none';
    if (scopeBox) scopeBox.style.display = 'none';
    confirmBtn.disabled = true;

    // Terminate existing worker if running
    if (this.currentWorker) this.currentWorker.terminate();

    // Spawn Web Worker for non-blocking streaming parse
    this.currentWorker = new Worker(new URL('./napParserWorker.js', import.meta.url), { type: 'module' });

    this.currentWorker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'PROGRESS') {
        progressBar.style.width = `${msg.percent}%`;
        progressText.textContent = `Scanning: ${msg.rowsScanned.toLocaleString()} rows | Matched Davao: ${msg.davaoMatched.toLocaleString()} (${msg.percent}%)`;
      } else if (msg.type === 'COMPLETE') {
        progressBar.style.width = '100%';
        const cityCountStr = msg.davaoCityCount ? ` (${msg.davaoCityCount.toLocaleString()} in Davao City)` : '';
        progressText.textContent = `Complete: Scanned ${msg.totalScanned.toLocaleString()} rows. Extracted ${msg.davaoCount.toLocaleString()} Davao records${cityCountStr}!`;

        this.allParsedNapData = msg.validRecords;
        this.parsedNapImportData = msg.validRecords;

        if (scopeBox) {
          scopeBox.style.display = 'flex';
          const countAll = document.getElementById('count-all-davao');
          const countCity = document.getElementById('count-davao-city');
          if (countAll) countAll.textContent = msg.davaoCount.toLocaleString();
          if (countCity) countCity.textContent = (msg.davaoCityCount || 0).toLocaleString();

          const radAll = document.getElementById('scope-all-davao');
          if (radAll) radAll.checked = true;

          const handleScopeChange = () => {
            const isCityOnly = document.getElementById('scope-davao-city')?.checked;
            if (isCityOnly) {
              this.parsedNapImportData = this.allParsedNapData.filter(r => r.isDavaoCity || r.city === 'Davao City');
            } else {
              this.parsedNapImportData = this.allParsedNapData;
            }
            this.renderNapPreviewTable(this.parsedNapImportData.slice(0, 10));
            confirmBtn.textContent = `Confirm & Import ${this.parsedNapImportData.length.toLocaleString()} Records`;
          };

          document.querySelectorAll('input[name="nap-import-scope"]').forEach(radio => {
            radio.onchange = handleScopeChange;
          });
        }

        this.renderNapPreviewTable(msg.validRecords.slice(0, 10));
        previewBox.style.display = 'block';
        confirmBtn.disabled = false;
        confirmBtn.textContent = `Confirm & Import ${msg.davaoCount.toLocaleString()} Records`;
        this.showToast(`Extracted ${msg.davaoCount.toLocaleString()} curated Davao records in seconds!`, 'success');
      } else if (msg.type === 'ERROR') {
        this.showToast('Error during file processing: ' + msg.error, 'danger');
        progressBox.style.display = 'none';
      }
    };

    this.currentWorker.postMessage({
      file: file,
      fileType: isCsv ? 'csv' : 'xlsx'
    });
  }

  renderNapPreviewTable(records) {
    const tbody = document.getElementById('nap-preview-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    records.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:600;">${escapeHtml(r.id)}</td>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.region)}</td>
        <td>${escapeHtml(r.city)}</td>
        <td style="font-family:var(--font-mono);">${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}</td>
        <td><span class="panel-badge">${escapeHtml(r.status)}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  async commitNapImport() {
    if (!this.parsedNapImportData || !this.parsedNapImportData.length) return;
    const confirmBtn = document.getElementById('btn-confirm-import');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Importing to Map & Database...';

    // 1. Add directly to client Spatial Engine for instant zero-lag map responsiveness
    spatialEngine.setNaps(this.parsedNapImportData);

    // 2. Batch sync to backend in chunks of 2,500
    try {
      const records = this.parsedNapImportData;
      const batchSize = 2500;
      for (let i = 0; i < records.length; i += batchSize) {
        const chunk = records.slice(i, i + batchSize);
        const progressCount = Math.min(i + batchSize, records.length);
        confirmBtn.textContent = `Syncing Database: ${progressCount.toLocaleString()} / ${records.length.toLocaleString()}...`;
        await fetch(CONFIG.API_BASE_URL || '/api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'nap:batchSync',
            mapId: auth.mapId,
            records: chunk,
            ...auth.getAuthPayload()
          })
        });
      }
      this.showToast(`Successfully imported ${records.length.toLocaleString()} NAPs into map & database.`, 'success');
      document.getElementById('modal-import').classList.remove('open');
      if (this.currentActiveTool === 'import') {
        this.setActiveTool('select');
      }
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirm & Import';
    } catch (e) {
      console.warn('Backend sync delayed; cached in client memory:', e);
      this.showToast(`Imported ${this.parsedNapImportData.length.toLocaleString()} NAPs to active map session.`, 'success');
      document.getElementById('modal-import').classList.remove('open');
      if (this.currentActiveTool === 'import') {
        this.setActiveTool('select');
      }
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirm & Import';
    }
  }

  // ==============================================================================
  // SHARE MODAL & LINK MANAGEMENT
  // ==============================================================================
  async openShareModal() {
    this.openModal('modal-share');
    const viewUrlEl = document.getElementById('share-view-url');
    const editUrlEl = document.getElementById('share-edit-url');

    try {
      const viewLink = await shareEngine.generateLink(auth.mapId, 'VIEW');
      if (viewUrlEl) viewUrlEl.value = viewLink.shareUrl;

      const editLink = await shareEngine.generateLink(auth.mapId, 'EDIT');
      if (editUrlEl) editUrlEl.value = editLink.shareUrl;

      // Copy buttons
      document.getElementById('btn-copy-view').onclick = () => {
        navigator.clipboard.writeText(viewUrlEl.value);
        this.showToast('View-only link copied to clipboard!', 'success');
      };
      document.getElementById('btn-copy-edit').onclick = () => {
        navigator.clipboard.writeText(editUrlEl.value);
        this.showToast('Edit-access link copied to clipboard!', 'success');
      };

      // Load existing active links
      const links = await shareEngine.loadLinks(auth.mapId);
      this.renderLinksTable(links);
    } catch (e) {
      this.showToast('Share link generation: ' + e.message, 'warning');
    }
  }

  renderLinksTable(links) {
    const tbody = document.getElementById('share-links-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    links.forEach(link => {
      const tr = document.createElement('tr');
      const isRevoked = !!link.revokedAt;
      tr.innerHTML = `
        <td style="font-family:var(--font-mono);">${link.token.substring(0, 12)}...</td>
        <td><span class="panel-badge">${link.permission}</span></td>
        <td>${new Date(link.createdAt).toLocaleDateString()}</td>
        <td><span style="color:${isRevoked ? 'var(--danger)' : 'var(--success)'};">${isRevoked ? 'Revoked' : 'Active'}</span></td>
        <td>
          ${!isRevoked ? `<button class="btn btn-danger btn-sm revoke-btn" data-id="${link.id}">Revoke</button>` : '--'}
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.revoke-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await shareEngine.revokeLink(btn.dataset.id, auth.mapId);
        this.showToast('Link revoked.', 'info');
        const updated = await shareEngine.loadLinks(auth.mapId);
        this.renderLinksTable(updated);
      });
    });
  }

  // ==============================================================================
  // AUTHENTICATION UI
  // ==============================================================================
  setupAuthUI() {
    auth.onAuthChange((user) => {
      const userBadge = document.getElementById('user-badge-name');
      const userRole = document.getElementById('user-badge-role');
      const authBtn = document.getElementById('btn-auth-toggle');

      if (userBadge) userBadge.textContent = user?.name || 'Guest';
      if (userRole) userRole.textContent = user?.role || 'VIEWER';

      if (authBtn) {
        if (user && !user.isGuest) {
          authBtn.textContent = 'Logout';
          authBtn.onclick = () => auth.logout();
        } else {
          authBtn.textContent = 'Admin Login';
          authBtn.onclick = () => this.openModal('modal-login');
        }
      }
    });

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-pass').value;
        const errEl = document.getElementById('login-error-msg');

        const res = await auth.login(email, pass);
        if (res.success) {
          document.getElementById('modal-login').classList.remove('open');
          this.showToast(`Logged in as ${res.user.name} (${res.user.role})`, 'success');
        } else {
          if (errEl) {
            errEl.textContent = res.error;
            errEl.style.display = 'block';
          }
        }
      });
    }
  }

  // ==============================================================================
  // BACKEND SYNC HELPERS
  // ==============================================================================
  async syncRouteToBackend(route) {
    try {
      await fetch(CONFIG.API_BASE_URL || '/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'route:create',
          mapId: auth.mapId,
          ...route,
          ...auth.getAuthPayload()
        })
      });
    } catch (e) {
      console.warn('Backend route sync offline; saved locally');
    }
  }

  async deleteRouteFromBackend(routeId) {
    try {
      await fetch(CONFIG.API_BASE_URL || '/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'route:delete',
          routeId: routeId,
          mapId: auth.mapId,
          ...auth.getAuthPayload()
        })
      });
    } catch (e) {
      console.warn('Backend delete offline');
    }
  }

  async syncDrawingToBackend(drawing) {
    try {
      await fetch(CONFIG.API_BASE_URL || '/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'drawing:save',
          mapId: auth.mapId,
          drawing: { ...drawing, mapId: drawing.mapId || auth.mapId },
          ...auth.getAuthPayload()
        })
      });
    } catch (e) {
      console.warn('Backend drawing sync offline');
    }
  }

  async deleteDrawingFromBackend(id) {
    try {
      await fetch(CONFIG.API_BASE_URL || '/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'drawing:delete',
          mapId: auth.mapId,
          drawingId: id,
          ...auth.getAuthPayload()
        })
      });
    } catch (e) {
      console.warn('Backend drawing delete offline');
    }
  }

  async syncNapToBackend(nap) {
    try {
      await fetch(CONFIG.API_BASE_URL || '/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'nap:update',
          mapId: auth.mapId,
          napId: nap.id,
          ...nap,
          ...auth.getAuthPayload()
        })
      });
    } catch (e) {
      console.warn('Backend nap sync offline');
    }
  }

  handleRemoteMutation(detail) {
    if (detail.objectType === 'ROUTE') {
      if (detail.action === 'CREATE' || detail.action === 'UPDATE') {
        routeEngine.renderRoute(detail.data);
      } else if (detail.action === 'DELETE') {
        routeEngine.removeRoute(detail.data.id);
      }
    } else if (detail.objectType === 'DRAWING') {
      if (detail.action === 'CREATE' || detail.action === 'UPDATE') {
        drawingEngine.addDrawing(detail.data, false);
      } else if (detail.action === 'DELETE') {
        drawingEngine.deleteDrawing(detail.data.id);
      }
    }
  }

  // ==============================================================================
  // KEYBOARD SHORTCUTS
  // ==============================================================================
  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ignore if typing inside input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

      const key = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) drawingEngine.redo();
          else drawingEngine.undo();
        } else if (key === 'y') {
          e.preventDefault();
          drawingEngine.redo();
        }
        return;
      }

      switch (key) {
        case 'v':
          this.setActiveTool('select');
          break;
        case 'm':
          this.setActiveTool('move');
          break;
        case 'n':
          this.setActiveTool('marker');
          break;
        case 'r':
          if (this.currentActiveTool === 'route') {
            this.setActiveTool('select');
          } else {
            this.setActiveTool('route');
          }
          break;
        case 'p':
          this.setActiveTool('freehand');
          break;
        case 'l':
          this.setActiveTool('line');
          break;
        case 's':
          this.setActiveTool('rect');
          break;
        case 'c':
          this.setActiveTool('circle');
          break;
        case 't':
          this.setActiveTool('text');
          break;
        case 'k':
          if (this.currentActiveTool === 'layers') {
            this.setActiveTool('select');
          } else {
            this.setActiveTool('layers');
          }
          break;
        case 'escape':
          if (drawingEngine.isDrawing) {
            drawingEngine.cancelCurrentDrawing();
          }
          mapEngine.clearSelection();
          document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
          const panel = document.getElementById('right-panel');
          if (panel) {
            panel.classList.remove('open');
            delete panel.dataset.mode;
          }
          this.setActiveTool('select');
          break;
      }
    });
  }

  activateTool(tool) {
    this.setActiveTool(tool);
  }

  openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('open');
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `btn btn-${type}`;
    toast.style.cssText = `
      position: fixed;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      box-shadow: var(--shadow-lg);
      z-index: 9999;
      opacity: 0;
      transition: transform 200ms var(--ease-out), opacity 200ms var(--ease-out);
      pointer-events: none;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(-50%) translateY(0)';
      toast.style.opacity = '1';
    });

    setTimeout(() => {
      toast.style.transform = 'translateX(-50%) translateY(20px)';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Instantiate and start app on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  const app = new ApplicationController();
  app.init();
});
