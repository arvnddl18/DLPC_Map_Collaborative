/**
 * DLPC_Map_Collaborative - Canva-Style Vector Drawing Engine with Real-Time Live Sync
 * Provides interactive map vector drawing (Freehand, Line, Arrow, Rect, Circle, Polygon, Text, Marker),
 * styling, selection handles, property inspector, undo/redo, and ultra-low latency live collaborative
 * stream synchronization across concurrent users.
 */

import { mapEngine } from './map.js';
import { auth } from './auth.js';
import { collabEngine } from './collab.js';

export class DrawingEngine {
  constructor() {
    this.activeTool = 'select'; // 'select', 'move', 'freehand', 'line', 'arrow', 'rect', 'circle', 'polygon', 'text', 'marker'
    this.drawings = new Map(); // id -> drawingData
    this.layers = new Map(); // id -> L.Layer
    this.isDrawing = false;
    this.currentPoints = [];
    this.currentStrokeId = null;
    this.tempLayer = null;
    this.historyStack = [];
    this.redoStack = [];

    // Dragging state for Move tool
    this.isDragging = false;
    this.dragTargetId = null;
    this.dragStartLatLng = null;
    this.dragInitialGeometry = null;
    this.hasMoved = false;
    
    // Remote live streams
    this.remoteLiveStrokes = new Map(); // strokeKey -> { layer, labelEl, timeoutId, tool, color, name }
    this.remoteLiveMoves = new Map(); // drawingId -> { originalGeometry, timeoutId }

    // Default drawing style tokens
    this.currentStyle = {
      color: '#0284c7', // Azure
      fillColor: '#0284c7',
      fillOpacity: 0.2,
      weight: 3,
      opacity: 0.9,
      dashArray: null
    };

    this.selectedDrawingId = null;
  }

  init() {
    if (!mapEngine.map) return;
    const map = mapEngine.map;

    // Attach mouse interaction handlers to map
    map.on('mousedown', (e) => this.onMouseDown(e));
    map.on('mousemove', (e) => this.onMouseMove(e));
    map.on('mouseup', (e) => this.onMouseUp(e));

    // Cancel drawing or move and revert to select on right click
    map.on('contextmenu', (e) => {
      if (this.activeTool !== 'select') {
        e.originalEvent.preventDefault();
        this.cancelCurrentDrawing();
      }
    });

    // Register map click handler to clear drawing selection when clicking empty canvas or finish move
    mapEngine.registerClickHandler((e) => {
      if (this.activeTool === 'move') {
        this.setTool('select');
        return false;
      }
      if (this.activeTool === 'select' && this.selectedDrawingId && !this.isDragging) {
        this.deselect();
        return false;
      }
      return false;
    });

    // Listen for remote live drawing stream events
    window.addEventListener('dlpc:remote-live-stroke', (e) => this.handleRemoteLiveStroke(e.detail));
    window.addEventListener('dlpc:remote-live-move', (e) => this.handleRemoteLiveMove(e.detail));
  }

  setTool(toolName) {
    if (!toolName) toolName = 'select';
    this.activeTool = toolName;
    if (mapEngine.map) {
      const container = mapEngine.map.getContainer();
      if (toolName === 'move') {
        container.classList.add('tool-move-active');
        container.classList.remove('tool-draw-active');
        mapEngine.map.dragging.enable();
      } else if (['freehand', 'line', 'arrow', 'rect', 'circle', 'text', 'marker'].includes(toolName)) {
        container.classList.remove('tool-move-active');
        container.classList.add('tool-draw-active');
        this.deselect();
        mapEngine.map.dragging.disable(); // Prevent map pan while drawing
      } else {
        container.classList.remove('tool-move-active');
        container.classList.remove('tool-draw-active');
        mapEngine.map.dragging.enable();
      }
    }
    window.dispatchEvent(new CustomEvent('dlpc:tool-changed', { detail: toolName }));
  }

  cancelCurrentDrawing() {
    if (this.tempLayer && mapEngine.map) {
      mapEngine.map.removeLayer(this.tempLayer);
      this.tempLayer = null;
    }
    if (this.currentStrokeId) {
      collabEngine.broadcastLiveStrokeCancel(this.currentStrokeId);
      this.currentStrokeId = null;
    }
    this.isDrawing = false;
    this.currentPoints = [];
    this.setTool('select');
  }

  onMouseDown(e) {
    if (!auth.canEdit()) {
      if (this.activeTool !== 'select') {
        this.setTool('select');
      }
      return;
    }
    if (this.activeTool === 'select' || this.activeTool === 'move') return;

    this.isDrawing = true;
    this.currentPoints = [e.latlng];
    this.currentStrokeId = 'STRK_' + Math.random().toString(36).substring(2, 9);

    // Broadcast cursor with drawing state
    collabEngine.broadcastCursor(e.latlng.lat, e.latlng.lng, this.activeTool, true);

    if (this.activeTool === 'marker') {
      this.createMarker(e.latlng);
      this.isDrawing = false;
      collabEngine.broadcastCursor(e.latlng.lat, e.latlng.lng, this.activeTool, false);
      return;
    }

    if (this.activeTool === 'text') {
      const textVal = prompt('Enter label text:', 'Note');
      if (textVal) {
        this.createTextLabel(e.latlng, textVal);
      } else {
        this.setTool('select');
      }
      this.isDrawing = false;
      collabEngine.broadcastCursor(e.latlng.lat, e.latlng.lng, this.activeTool, false);
      return;
    }

    // Broadcast live stroke start to other users with 0 delay
    collabEngine.broadcastLiveStrokeStart(
      this.currentStrokeId,
      this.activeTool,
      [e.latlng.lat, e.latlng.lng],
      this.currentStyle
    );
  }

  onMouseMove(e) {
    if (!this.isDrawing) return;

    if (this.activeTool === 'freehand') {
      this.currentPoints.push(e.latlng);
      if (this.tempLayer) mapEngine.map.removeLayer(this.tempLayer);
      this.tempLayer = L.polyline(this.currentPoints, {
        color: this.currentStyle.color,
        weight: this.currentStyle.weight,
        opacity: this.currentStyle.opacity
      }).addTo(mapEngine.map);

      // Stream live stroke update to collaborators at 40 FPS
      collabEngine.broadcastLiveStrokeUpdate(this.currentStrokeId, 'freehand', {
        points: this.currentPoints.map(p => [p.lat, p.lng])
      });
    } else if (this.activeTool === 'line' || this.activeTool === 'arrow') {
      const p1 = this.currentPoints[0];
      const p2 = e.latlng;
      if (this.tempLayer) mapEngine.map.removeLayer(this.tempLayer);
      this.tempLayer = L.polyline([p1, p2], {
        color: this.currentStyle.color,
        weight: this.currentStyle.weight,
        opacity: this.currentStyle.opacity,
        dashArray: this.currentStyle.dashArray
      }).addTo(mapEngine.map);

      collabEngine.broadcastLiveStrokeUpdate(this.currentStrokeId, this.activeTool, {
        p1: [p1.lat, p1.lng],
        p2: [p2.lat, p2.lng]
      });
    } else if (this.activeTool === 'rect') {
      const bounds = L.latLngBounds(this.currentPoints[0], e.latlng);
      if (this.tempLayer) mapEngine.map.removeLayer(this.tempLayer);
      this.tempLayer = L.rectangle(bounds, {
        color: this.currentStyle.color,
        fillColor: this.currentStyle.fillColor,
        fillOpacity: this.currentStyle.fillOpacity,
        weight: this.currentStyle.weight
      }).addTo(mapEngine.map);

      collabEngine.broadcastLiveStrokeUpdate(this.currentStrokeId, 'rect', {
        southWest: [bounds.getSouthWest().lat, bounds.getSouthWest().lng],
        northEast: [bounds.getNorthEast().lat, bounds.getNorthEast().lng]
      });
    } else if (this.activeTool === 'circle') {
      const p1 = this.currentPoints[0];
      const radiusMeters = p1.distanceTo(e.latlng);
      if (this.tempLayer) mapEngine.map.removeLayer(this.tempLayer);
      this.tempLayer = L.circle(p1, {
        radius: radiusMeters,
        color: this.currentStyle.color,
        fillColor: this.currentStyle.fillColor,
        fillOpacity: this.currentStyle.fillOpacity,
        weight: this.currentStyle.weight
      }).addTo(mapEngine.map);

      collabEngine.broadcastLiveStrokeUpdate(this.currentStrokeId, 'circle', {
        center: [p1.lat, p1.lng],
        radius: Math.round(radiusMeters)
      });
    }
  }

  onMouseUp(e) {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    if (this.tempLayer) {
      mapEngine.map.removeLayer(this.tempLayer);
      this.tempLayer = null;
    }

    if (this.currentPoints.length < 1) {
      if (this.currentStrokeId) {
        collabEngine.broadcastLiveStrokeCancel(this.currentStrokeId);
      }
      // Nothing drawn — stay in current tool for continuous drawing
      return;
    }

    const id = 'DRAW-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    let geometry = null;
    const type = this.activeTool;

    if (type === 'freehand') {
      if (this.currentPoints.length < 2) {
        if (this.currentStrokeId) {
          collabEngine.broadcastLiveStrokeCancel(this.currentStrokeId);
        }
        // Too short — stay in current tool for continuous drawing
        return;
      }
      geometry = this.currentPoints.map(p => [p.lat, p.lng]);
    } else if (type === 'line' || type === 'arrow') {
      const p1 = this.currentPoints[0];
      const p2 = e.latlng;
      if (p1 && p2 && p1.distanceTo(p2) > 0.5) {
        geometry = [
          [p1.lat, p1.lng],
          [p2.lat, p2.lng]
        ];
      }
    } else if (type === 'rect') {
      const p1 = this.currentPoints[0];
      const p2 = e.latlng;
      if (p1 && p2 && p1.distanceTo(p2) > 0.5) {
        const b = L.latLngBounds(p1, p2);
        geometry = {
          southWest: [b.getSouthWest().lat, b.getSouthWest().lng],
          northEast: [b.getNorthEast().lat, b.getNorthEast().lng]
        };
      }
    } else if (type === 'circle') {
      const p1 = this.currentPoints[0];
      const p2 = e.latlng;
      const radius = p1 && p2 ? Math.round(p1.distanceTo(p2)) : 0;
      if (radius > 0.5) {
        geometry = {
          center: [p1.lat, p1.lng],
          radius: radius
        };
      }
    }

    if (geometry) {
      const drawingData = {
        id: id,
        mapId: auth.mapId,
        type: type,
        geometry: geometry,
        style: { ...this.currentStyle },
        text: '',
        tags: [],
        version: 1,
        createdBy: auth.currentUser?.name || 'Editor'
      };

      // Broadcast live stroke completion with final drawing payload
      collabEngine.broadcastLiveStrokeEnd(this.currentStrokeId, drawingData);

      // Shape saved — stay in current tool for continuous drawing
      this.addDrawing(drawingData, true);
    } else {
      if (this.currentStrokeId) {
        collabEngine.broadcastLiveStrokeCancel(this.currentStrokeId);
      }
      // Zero-distance drag — stay in current tool for continuous drawing
    }

    collabEngine.broadcastCursor(e.latlng ? e.latlng.lat : 0, e.latlng ? e.latlng.lng : 0, this.activeTool, false);
    this.currentStrokeId = null;
  }

  createMarker(latlng) {
    const id = 'DRAW-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const drawingData = {
      id: id,
      mapId: auth.mapId,
      type: 'marker',
      geometry: [latlng.lat, latlng.lng],
      style: { ...this.currentStyle },
      text: 'Pin',
      tags: [],
      version: 1,
      createdBy: auth.currentUser?.name || 'Editor'
    };
    // Marker placed — stay in marker tool for continuous pin placement
    this.addDrawing(drawingData, true);
  }

  createTextLabel(latlng, text) {
    const id = 'DRAW-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const drawingData = {
      id: id,
      mapId: auth.mapId,
      type: 'text',
      geometry: [latlng.lat, latlng.lng],
      style: { ...this.currentStyle, textColor: '#000000', fontSize: 12 },
      text: text,
      tags: [],
      version: 1,
      createdBy: auth.currentUser?.name || 'Editor'
    };
    // Text label placed — stay in text tool for continuous labeling
    this.addDrawing(drawingData, true);
  }

  addDrawing(data, addToHistory = false) {
    if (!data.mapId) data.mapId = auth.mapId;
    this.drawings.set(data.id, data);
    this.renderDrawing(data);

    if (addToHistory) {
      this.historyStack.push({ action: 'create', data: data });
      this.redoStack = [];
      window.dispatchEvent(new CustomEvent('dlpc:drawing-saved', { detail: data }));
    }
  }

  renderDrawing(data) {
    if (this.layers.has(data.id)) {
      mapEngine.layerGroups.drawings.removeLayer(this.layers.get(data.id));
      this.layers.delete(data.id);
    }

    let layer = null;
    const style = data.style || this.currentStyle;

    if (data.type === 'freehand' || data.type === 'line' || data.type === 'arrow') {
      layer = L.polyline(data.geometry, {
        color: style.color,
        weight: style.weight,
        opacity: style.opacity,
        dashArray: style.dashArray
      });
    } else if (data.type === 'rect') {
      const bounds = L.latLngBounds(data.geometry.southWest, data.geometry.northEast);
      layer = L.rectangle(bounds, {
        color: style.color,
        fillColor: style.fillColor,
        fillOpacity: style.fillOpacity,
        weight: style.weight
      });
    } else if (data.type === 'circle') {
      layer = L.circle(data.geometry.center, {
        radius: data.geometry.radius,
        color: style.color,
        fillColor: style.fillColor,
        fillOpacity: style.fillOpacity,
        weight: style.weight
      });
    } else if (data.type === 'text') {
      const textFontColor = style.textColor || '#000000';
      const textBgColor = style.fillColor || '#131a26';
      const textFontSize = style.fontSize || 12;
      const textIcon = L.divIcon({
        className: 'custom-map-text-label',
        html: `<div style="background:${textBgColor};color:${textFontColor};padding:2px 8px;border-radius:4px;border:1px solid rgba(0,0,0,0.15);font-size:${textFontSize}px;font-weight:600;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.4);">${escapeHtml(data.text || '')}</div>`,
        iconSize: [100, textFontSize + 12]
      });
      layer = L.marker(data.geometry, { icon: textIcon });
    } else if (data.type === 'marker') {
      const markerIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${style.color};border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.5);"></div>`,
        iconSize: [14, 14]
      });
      layer = L.marker(data.geometry, { icon: markerIcon });
    }

    if (layer) {
      this.attachMoveListeners(layer, data);
      mapEngine.layerGroups.drawings.addLayer(layer);
      this.layers.set(data.id, layer);
    }
  }

  attachMoveListeners(layer, data) {
    layer.on('mouseover', () => {
      if (this.activeTool === 'move' || this.activeTool === 'select') {
        const el = layer.getElement ? layer.getElement() : layer._path;
        if (el) el.classList.add('drawing-movable');
      }
    });

    layer.on('mouseout', () => {
      const el = layer.getElement ? layer.getElement() : layer._path;
      if (el && !this.isDragging) el.classList.remove('drawing-movable');
    });

    layer.on('mousedown', (e) => {
      if (this.activeTool === 'move' || this.activeTool === 'select') {
        if (!auth.canEdit()) return;
        L.DomEvent.stopPropagation(e);
        this.startDragging(data.id, e.latlng);
      }
    });

    layer.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      if (!this.hasMoved) {
        this.selectDrawing(data.id);
      }
    });
  }

  startDragging(drawingId, startLatLng) {
    const data = this.drawings.get(drawingId);
    const layer = this.layers.get(drawingId);
    if (!data || !layer) return;

    this.selectDrawing(drawingId);
    this.isDragging = true;
    this.dragTargetId = drawingId;
    this.dragStartLatLng = startLatLng;
    this.dragInitialGeometry = JSON.parse(JSON.stringify(data.geometry));
    this.hasMoved = false;

    // Temporarily disable map panning during drag
    mapEngine.map.dragging.disable();

    const el = layer.getElement ? layer.getElement() : layer._path;
    if (el) {
      el.classList.add('drawing-dragging');
    }

    const onMouseMove = (e) => {
      if (!this.isDragging || this.dragTargetId !== drawingId) return;

      const deltaLat = e.latlng.lat - this.dragStartLatLng.lat;
      const deltaLng = e.latlng.lng - this.dragStartLatLng.lng;

      if (Math.abs(deltaLat) > 0.000001 || Math.abs(deltaLng) > 0.000001) {
        this.hasMoved = true;
      }

      this.applyGeometryDelta(layer, data.type, this.dragInitialGeometry, deltaLat, deltaLng);

      // Broadcast live movement stream to other collaborators at live speed
      collabEngine.broadcastLiveMove(drawingId, deltaLat, deltaLng, false);
    };

    const cleanup = () => {
      mapEngine.map.off('mousemove', onMouseMove);
      mapEngine.map.off('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);

      this.isDragging = false;
      mapEngine.map.dragging.enable();

      if (el) {
        el.classList.remove('drawing-dragging');
      }
    };

    const onMouseUp = (e) => {
      if (!this.isDragging || this.dragTargetId !== drawingId) return;

      let currentLatLng = e.latlng;
      if (!currentLatLng) {
        try {
          currentLatLng = mapEngine.map.mouseEventToLatLng(e);
        } catch (err) {
          currentLatLng = this.dragStartLatLng;
        }
      }

      const deltaLat = currentLatLng.lat - this.dragStartLatLng.lat;
      const deltaLng = currentLatLng.lng - this.dragStartLatLng.lng;

      cleanup();

      if (this.hasMoved) {
        const finalGeometry = this.computeTranslatedGeometry(data.type, this.dragInitialGeometry, deltaLat, deltaLng);
        const prevData = { ...data, geometry: this.dragInitialGeometry };

        data.geometry = finalGeometry;
        data.version = (data.version || 1) + 1;

        // Push to history for Undo/Redo
        this.historyStack.push({ action: 'update', id: data.id, prev: prevData, curr: { ...data } });
        this.redoStack = [];

        // Save & real-time collaborative broadcast final position
        collabEngine.broadcastLiveMove(drawingId, deltaLat, deltaLng, true);
        window.dispatchEvent(new CustomEvent('dlpc:drawing-saved', { detail: data }));
        window.dispatchEvent(new CustomEvent('dlpc:object-selected', { detail: { type: 'drawing', data: data } }));

        // Move completed: automatically return to default select tool
        this.setTool('select');
      }

      this.dragTargetId = null;
      this.dragStartLatLng = null;
      this.dragInitialGeometry = null;
    };

    const onWindowMouseMove = (e) => {
      if (this.isDragging) {
        try {
          const latlng = mapEngine.map.mouseEventToLatLng(e);
          if (latlng) onMouseMove({ latlng });
        } catch (err) {}
      }
    };

    const onWindowMouseUp = (e) => {
      if (this.isDragging) {
        onMouseUp(e);
      }
    };

    mapEngine.map.on('mousemove', onMouseMove);
    mapEngine.map.on('mouseup', onMouseUp);
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp, { once: true });
  }

  applyGeometryDelta(layer, type, initialGeom, deltaLat, deltaLng) {
    if (type === 'text' || type === 'marker') {
      layer.setLatLng([initialGeom[0] + deltaLat, initialGeom[1] + deltaLng]);
    } else if (type === 'circle') {
      layer.setLatLng([initialGeom.center[0] + deltaLat, initialGeom.center[1] + deltaLng]);
    } else if (type === 'rect') {
      const sw = [initialGeom.southWest[0] + deltaLat, initialGeom.southWest[1] + deltaLng];
      const ne = [initialGeom.northEast[0] + deltaLat, initialGeom.northEast[1] + deltaLng];
      layer.setBounds(L.latLngBounds(sw, ne));
    } else if (type === 'line' || type === 'arrow' || type === 'freehand') {
      const pts = initialGeom.map(p => [p[0] + deltaLat, p[1] + deltaLng]);
      layer.setLatLngs(pts);
    }
  }

  computeTranslatedGeometry(type, initialGeom, deltaLat, deltaLng) {
    if (type === 'text' || type === 'marker') {
      return [initialGeom[0] + deltaLat, initialGeom[1] + deltaLng];
    } else if (type === 'circle') {
      return {
        center: [initialGeom.center[0] + deltaLat, initialGeom.center[1] + deltaLng],
        radius: initialGeom.radius
      };
    } else if (type === 'rect') {
      return {
        southWest: [initialGeom.southWest[0] + deltaLat, initialGeom.southWest[1] + deltaLng],
        northEast: [initialGeom.northEast[0] + deltaLat, initialGeom.northEast[1] + deltaLng]
      };
    } else if (type === 'line' || type === 'arrow' || type === 'freehand') {
      return initialGeom.map(p => [p[0] + deltaLat, p[1] + deltaLng]);
    }
    return initialGeom;
  }

  // ==============================================================================
  // REMOTE LIVE DRAWING STREAM RECEIVER
  // Renders in-progress strokes and live movement from other users at live speed
  // ==============================================================================

  handleRemoteLiveStroke(msg) {
    if (!mapEngine.map || !mapEngine.layerGroups?.drawings) return;
    const streamKey = `${msg.sessionId}_${msg.strokeId}`;

    if (msg.type === 'DRAWING_LIVE_START') {
      this.cleanupRemoteStroke(streamKey);

      let layer = null;
      const strokeColor = msg.color || '#0284c7';
      const weight = msg.style?.weight || 3;

      if (msg.tool === 'freehand' || msg.tool === 'line' || msg.tool === 'arrow') {
        layer = L.polyline([msg.startPoint], {
          color: strokeColor,
          weight: weight,
          opacity: 0.85,
          className: 'remote-live-stroke'
        });
      } else if (msg.tool === 'rect') {
        const bounds = L.latLngBounds(msg.startPoint, msg.startPoint);
        layer = L.rectangle(bounds, {
          color: strokeColor,
          fillColor: strokeColor,
          fillOpacity: 0.25,
          weight: weight,
          className: 'remote-live-stroke'
        });
      } else if (msg.tool === 'circle') {
        layer = L.circle(msg.startPoint, {
          radius: 1,
          color: strokeColor,
          fillColor: strokeColor,
          fillOpacity: 0.25,
          weight: weight,
          className: 'remote-live-stroke'
        });
      }

      if (layer) {
        layer.addTo(mapEngine.map);
        const timeoutId = setTimeout(() => this.cleanupRemoteStroke(streamKey), 6000);
        this.remoteLiveStrokes.set(streamKey, {
          layer: layer,
          tool: msg.tool,
          color: strokeColor,
          name: msg.name,
          timeoutId: timeoutId
        });
      }
    } else if (msg.type === 'DRAWING_LIVE_UPDATE') {
      const stream = this.remoteLiveStrokes.get(streamKey);
      if (!stream || !stream.layer) return;

      clearTimeout(stream.timeoutId);
      stream.timeoutId = setTimeout(() => this.cleanupRemoteStroke(streamKey), 6000);

      const upd = msg.update;
      if (msg.tool === 'freehand' && upd.points) {
        stream.layer.setLatLngs(upd.points);
      } else if ((msg.tool === 'line' || msg.tool === 'arrow') && upd.p1 && upd.p2) {
        stream.layer.setLatLngs([upd.p1, upd.p2]);
      } else if (msg.tool === 'rect' && upd.southWest && upd.northEast) {
        stream.layer.setBounds(L.latLngBounds(upd.southWest, upd.northEast));
      } else if (msg.tool === 'circle' && upd.center && upd.radius) {
        stream.layer.setLatLng(upd.center);
        stream.layer.setRadius(upd.radius);
      }
    } else if (msg.type === 'DRAWING_LIVE_END') {
      this.cleanupRemoteStroke(streamKey);
      if (msg.finalDrawing) {
        this.addDrawing(msg.finalDrawing, false);
      }
    } else if (msg.type === 'DRAWING_LIVE_CANCEL') {
      this.cleanupRemoteStroke(streamKey);
    }
  }

  cleanupRemoteStroke(streamKey) {
    if (this.remoteLiveStrokes.has(streamKey)) {
      const stream = this.remoteLiveStrokes.get(streamKey);
      clearTimeout(stream.timeoutId);
      if (stream.layer && mapEngine.map) {
        mapEngine.map.removeLayer(stream.layer);
      }
      this.remoteLiveStrokes.delete(streamKey);
    }
  }

  handleRemoteLiveMove(msg) {
    const layer = this.layers.get(msg.drawingId);
    const data = this.drawings.get(msg.drawingId);
    if (!layer || !data) return;

    if (!msg.isFinal) {
      if (!this.remoteLiveMoves.has(msg.drawingId)) {
        this.remoteLiveMoves.set(msg.drawingId, {
          originalGeometry: JSON.parse(JSON.stringify(data.geometry)),
          timeoutId: setTimeout(() => this.cleanupRemoteMove(msg.drawingId), 6000)
        });
        const el = layer.getElement ? layer.getElement() : layer._path;
        if (el) el.classList.add('drawing-remote-moving');
      } else {
        const moveRecord = this.remoteLiveMoves.get(msg.drawingId);
        clearTimeout(moveRecord.timeoutId);
        moveRecord.timeoutId = setTimeout(() => this.cleanupRemoteMove(msg.drawingId), 6000);
      }

      const moveRecord = this.remoteLiveMoves.get(msg.drawingId);
      this.applyGeometryDelta(layer, data.type, moveRecord.originalGeometry, msg.deltaLat, msg.deltaLng);
    } else {
      const moveRecord = this.remoteLiveMoves.get(msg.drawingId);
      const baseGeom = moveRecord ? moveRecord.originalGeometry : data.geometry;
      this.cleanupRemoteMove(msg.drawingId);

      data.geometry = this.computeTranslatedGeometry(data.type, baseGeom, msg.deltaLat, msg.deltaLng);
      data.version = (data.version || 1) + 1;
      this.renderDrawing(data);
    }
  }

  cleanupRemoteMove(drawingId) {
    if (this.remoteLiveMoves.has(drawingId)) {
      const moveRecord = this.remoteLiveMoves.get(drawingId);
      clearTimeout(moveRecord.timeoutId);
      this.remoteLiveMoves.delete(drawingId);

      const layer = this.layers.get(drawingId);
      if (layer) {
        const el = layer.getElement ? layer.getElement() : layer._path;
        if (el) el.classList.remove('drawing-remote-moving');
      }
    }
  }

  // ==============================================================================
  // SELECTION & INSPECTOR
  // ==============================================================================

  selectDrawing(id) {
    const data = this.drawings.get(id);
    if (!data) return;

    if (this.selectedDrawingId && this.layers.has(this.selectedDrawingId)) {
      const prevLayer = this.layers.get(this.selectedDrawingId);
      const prevEl = prevLayer.getElement ? prevLayer.getElement() : prevLayer._path;
      if (prevEl) prevEl.classList.remove('drawing-selected');
    }

    this.selectedDrawingId = id;
    const currentLayer = this.layers.get(id);
    if (currentLayer) {
      const el = currentLayer.getElement ? currentLayer.getElement() : currentLayer._path;
      if (el) el.classList.add('drawing-selected');
    }

    // Clicking an existing shape always switches to select tool
    // so the user can inspect/move it, regardless of which drawing tool was active
    this.setTool('select');

    mapEngine.selectObject('drawing', data);
  }

  deselect() {
    if (this.selectedDrawingId && this.layers.has(this.selectedDrawingId)) {
      const prevLayer = this.layers.get(this.selectedDrawingId);
      const prevEl = prevLayer.getElement ? prevLayer.getElement() : prevLayer._path;
      if (prevEl) prevEl.classList.remove('drawing-selected');
    }
    this.selectedDrawingId = null;
    mapEngine.clearSelection();
  }

  updateDrawing(id, updates) {
    const data = this.drawings.get(id);
    if (!data) return;

    const prevData = { ...data };
    Object.assign(data, updates);
    data.version = (data.version || 1) + 1;
    this.renderDrawing(data);

    this.historyStack.push({ action: 'update', id: id, prev: prevData, curr: { ...data } });
    window.dispatchEvent(new CustomEvent('dlpc:drawing-saved', { detail: data }));
  }

  deleteDrawing(id) {
    const data = this.drawings.get(id);
    if (!data) return;

    if (this.layers.has(id)) {
      mapEngine.layerGroups.drawings.removeLayer(this.layers.get(id));
      this.layers.delete(id);
    }
    this.drawings.delete(id);
    if (this.selectedDrawingId === id) this.deselect();

    this.historyStack.push({ action: 'delete', data: data });
    window.dispatchEvent(new CustomEvent('dlpc:drawing-deleted', { detail: { id: id } }));
  }

  undo() {
    if (!this.historyStack.length) return;
    const item = this.historyStack.pop();
    this.redoStack.push(item);

    if (item.action === 'create') {
      const data = item.data;
      if (this.layers.has(data.id)) {
        mapEngine.layerGroups.drawings.removeLayer(this.layers.get(data.id));
        this.layers.delete(data.id);
      }
      this.drawings.delete(data.id);
      window.dispatchEvent(new CustomEvent('dlpc:drawing-deleted', { detail: { id: data.id } }));
    } else if (item.action === 'delete') {
      this.addDrawing(item.data, false);
      window.dispatchEvent(new CustomEvent('dlpc:drawing-saved', { detail: item.data }));
    } else if (item.action === 'update') {
      this.drawings.set(item.id, item.prev);
      this.renderDrawing(item.prev);
      window.dispatchEvent(new CustomEvent('dlpc:drawing-saved', { detail: item.prev }));
    }
    if (this.selectedDrawingId) this.deselect();
  }

  redo() {
    if (!this.redoStack.length) return;
    const item = this.redoStack.pop();
    this.historyStack.push(item);

    if (item.action === 'create') {
      this.addDrawing(item.data, false);
      window.dispatchEvent(new CustomEvent('dlpc:drawing-saved', { detail: item.data }));
    } else if (item.action === 'delete') {
      if (this.layers.has(item.data.id)) {
        mapEngine.layerGroups.drawings.removeLayer(this.layers.get(item.data.id));
        this.layers.delete(item.data.id);
      }
      this.drawings.delete(item.data.id);
      window.dispatchEvent(new CustomEvent('dlpc:drawing-deleted', { detail: { id: item.data.id } }));
    } else if (item.action === 'update') {
      this.drawings.set(item.id, item.curr);
      this.renderDrawing(item.curr);
      window.dispatchEvent(new CustomEvent('dlpc:drawing-saved', { detail: item.curr }));
    }
    if (this.selectedDrawingId) this.deselect();
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const drawingEngine = new DrawingEngine();
