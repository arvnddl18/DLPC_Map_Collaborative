/**
 * DLPC_Map_Collaborative - Real-Time Collaboration and Presence Engine
 * Handles live collaborator cursors (throttled at 30ms with smooth 60fps interpolation),
 * user presence stack, ultra-low latency live drawing stream synchronization over WebSockets,
 * cross-tab BroadcastChannel, and resilient GAS hybrid fallback.
 */

import { CONFIG } from './config.js';
import { mapEngine } from './map.js';
import { auth } from './auth.js';

export class CollaborationEngine {
  constructor() {
    this.sessionId = 'SESS_' + Math.random().toString(36).substring(2, 9);
    this.collaborators = new Map(); // sessionId -> { name, color, cursorLat, cursorLng, activeTool, isDrawing, lastSeen, element }
    this.connectionState = 'disconnected'; // 'connected', 'reconnecting', 'offline'
    this.socket = null;
    this.broadcastChannel = null;
    this.cursorContainer = null;
    this.userColor = this.generateUserColor();
    this.msgCounter = 0;
    this.recentMsgIds = new Set();
    
    // Throttle tracking
    this.lastCursorBroadcast = 0;
    this.lastStrokeBroadcast = 0;
    this.lastMoveBroadcast = 0;
    
    // Reconnection parameters
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.pollInterval = null;
    this.heartbeatInterval = null;
  }

  init() {
    this.cursorContainer = document.getElementById('map-viewport');
    
    // 1. Setup local cross-tab BroadcastChannel
    try {
      this.broadcastChannel = new BroadcastChannel('dlpc_map_collab_' + (auth.mapId || 'default'));
      this.broadcastChannel.onmessage = (event) => this.handleIncomingMessage(event.data);
    } catch (e) {
      console.warn('BroadcastChannel not supported in this environment');
    }

    // 2. Setup WebSocket connection for multi-client / network collaboration
    this.connectWebSocket();

    // 3. Attach mouse tracking for collaborator cursor broadcast
    mapEngine.onMouseMoveCoords((lat, lng) => {
      this.broadcastCursor(lat, lng);
    });

    // 4. Start heartbeat and background polling fallback
    this.startPresenceHeartbeat();
    this.startAdaptivePolling();

    // 5. Broadcast initial presence
    this.broadcastPresence();

    window.addEventListener('beforeunload', () => {
      this.broadcastLeave();
    });
  }

  connectWebSocket() {
    // Determine WebSocket URL based on current host & protocol
    let wsUrl = '';
    if (window.DLPC_CONFIG?.WS_URL) {
      wsUrl = window.DLPC_CONFIG.WS_URL;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host || 'localhost:3000';
      const mapId = encodeURIComponent(auth.mapId || 'MAP-DAVAO01');
      wsUrl = `${protocol}//${host}/ws/collab?mapId=${mapId}`;
    }

    try {
      this.setConnectionState('reconnecting');
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.setConnectionState('connected');
        // Announce presence on connect
        this.broadcastPresence();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingMessage(data);
        } catch (err) {
          console.warn('Failed to parse WebSocket message:', err);
        }
      };

      this.socket.onclose = () => {
        this.socket = null;
        this.setConnectionState('reconnecting');
        this.scheduleReconnect();
      };

      this.socket.onerror = (err) => {
        this.socket = null;
      };
    } catch (err) {
      console.warn('WebSocket connection attempt failed:', err);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectAttempts++;
    const delay = Math.min(
      (CONFIG.COLLAB.WS_RECONNECT_BASE_MS || 1000) * Math.pow(1.5, this.reconnectAttempts - 1),
      CONFIG.COLLAB.WS_RECONNECT_MAX_MS || 10000
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWebSocket();
    }, delay);
  }

  setConnectionState(state) {
    this.connectionState = state;
    const indicator = document.getElementById('status-connection-dot');
    const label = document.getElementById('status-connection-text');
    if (indicator) {
      indicator.className = `status-dot ${state === 'connected' ? 'connected' : state === 'reconnecting' ? 'reconnecting' : 'offline'}`;
    }
    if (label) {
      label.textContent = state === 'connected' ? 'Live Connected' : state === 'reconnecting' ? 'Reconnecting...' : 'Offline';
    }
  }

  generateUserColor() {
    const colors = [
      '#0284c7', // Sky Azure
      '#10b981', // Emerald
      '#f59e0b', // Amber
      '#8b5cf6', // Violet
      '#ec4899', // Pink
      '#06b6d4', // Cyan
      '#f97316', // Orange
      '#14b8a6'  // Teal
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // ==============================================================================
  // REAL-TIME BROADCAST DISPATCHER
  // ==============================================================================

  sendMessage(payload) {
    payload.sessionId = this.sessionId;
    payload.mapId = auth.mapId || 'MAP-DAVAO01';
    payload.msgId = `${this.sessionId}_${++this.msgCounter}`;
    payload.timestamp = Date.now();

    const rawMsg = JSON.stringify(payload);

    // 1. Dispatch over WebSocket for cross-network / multi-device clients
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(rawMsg);
    }

    // 2. Dispatch over BroadcastChannel for instant local cross-tab clients
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(payload);
      } catch (e) {}
    }
  }

  broadcastCursor(lat, lng, activeTool = null, isDrawing = false) {
    const now = Date.now();
    if (now - this.lastCursorBroadcast < (CONFIG.COLLAB.CURSOR_THROTTLE_MS || 30)) return;
    this.lastCursorBroadcast = now;

    this.sendMessage({
      type: 'CURSOR',
      userId: auth.currentUser?.id,
      name: auth.currentUser?.name || 'Guest',
      color: this.userColor,
      lat: lat,
      lng: lng,
      activeTool: activeTool,
      isDrawing: isDrawing
    });
  }

  broadcastLiveStrokeStart(strokeId, tool, startPoint, style) {
    this.sendMessage({
      type: 'DRAWING_LIVE_START',
      strokeId: strokeId,
      tool: tool,
      startPoint: startPoint,
      style: style,
      name: auth.currentUser?.name || 'Editor',
      color: this.userColor
    });
  }

  broadcastLiveStrokeUpdate(strokeId, tool, updateData) {
    const now = Date.now();
    if (now - this.lastStrokeBroadcast < (CONFIG.COLLAB.LIVE_DRAW_THROTTLE_MS || 25)) return;
    this.lastStrokeBroadcast = now;

    this.sendMessage({
      type: 'DRAWING_LIVE_UPDATE',
      strokeId: strokeId,
      tool: tool,
      update: updateData
    });
  }

  broadcastLiveStrokeEnd(strokeId, finalDrawing) {
    this.sendMessage({
      type: 'DRAWING_LIVE_END',
      strokeId: strokeId,
      finalDrawing: finalDrawing
    });
  }

  broadcastLiveStrokeCancel(strokeId) {
    this.sendMessage({
      type: 'DRAWING_LIVE_CANCEL',
      strokeId: strokeId
    });
  }

  broadcastLiveMove(drawingId, deltaLat, deltaLng, isFinal) {
    const now = Date.now();
    if (!isFinal && now - this.lastMoveBroadcast < (CONFIG.COLLAB.LIVE_MOVE_THROTTLE_MS || 25)) return;
    this.lastMoveBroadcast = now;

    this.sendMessage({
      type: 'DRAWING_MOVE_LIVE',
      drawingId: drawingId,
      deltaLat: deltaLat,
      deltaLng: deltaLng,
      isFinal: isFinal,
      name: auth.currentUser?.name || 'Editor',
      color: this.userColor
    });
  }

  broadcastPresence() {
    this.sendMessage({
      type: 'PRESENCE_JOIN',
      userId: auth.currentUser?.id,
      name: auth.currentUser?.name || 'Guest',
      color: this.userColor
    });
  }

  broadcastLeave() {
    this.sendMessage({
      type: 'PRESENCE_LEAVE'
    });
  }

  broadcastObjectChange(action, objectType, objectData) {
    this.sendMessage({
      type: 'OBJECT_MUTATION',
      action: action, // 'CREATE', 'UPDATE', 'DELETE'
      objectType: objectType, // 'ROUTE', 'DRAWING', 'NAP', 'TAG'
      data: objectData
    });
  }

  // ==============================================================================
  // INCOMING MESSAGE ROUTER
  // ==============================================================================

  handleIncomingMessage(msg) {
    if (!msg || msg.sessionId === this.sessionId) return; // Ignore own messages

    // De-duplication check across WebSocket and BroadcastChannel
    if (msg.msgId) {
      if (this.recentMsgIds.has(msg.msgId)) return;
      this.recentMsgIds.add(msg.msgId);
      if (this.recentMsgIds.size > 1500) {
        const first = this.recentMsgIds.values().next().value;
        this.recentMsgIds.delete(first);
      }
    }

    switch (msg.type) {
      case 'CURSOR':
        this.updateCollaboratorCursor(msg);
        break;
      case 'PRESENCE_JOIN':
        this.addCollaborator(msg);
        break;
      case 'PRESENCE_LEAVE':
        this.removeCollaborator(msg.sessionId);
        break;
      case 'OBJECT_MUTATION':
        this.handleRemoteObjectMutation(msg);
        break;
      case 'DRAWING_LIVE_START':
      case 'DRAWING_LIVE_UPDATE':
      case 'DRAWING_LIVE_END':
      case 'DRAWING_LIVE_CANCEL':
        window.dispatchEvent(new CustomEvent('dlpc:remote-live-stroke', { detail: msg }));
        break;
      case 'DRAWING_MOVE_LIVE':
        window.dispatchEvent(new CustomEvent('dlpc:remote-live-move', { detail: msg }));
        break;
    }
  }

  // ==============================================================================
  // COLLABORATOR CURSORS & PRESENCE AVATARS
  // ==============================================================================

  updateCollaboratorCursor(data) {
    let collab = this.collaborators.get(data.sessionId);
    if (!collab) {
      collab = {
        name: data.name,
        color: data.color,
        cursorLat: data.lat,
        cursorLng: data.lng,
        activeTool: data.activeTool || null,
        isDrawing: data.isDrawing || false,
        lastSeen: Date.now(),
        element: null
      };
      this.collaborators.set(data.sessionId, collab);
      this.createCursorElement(data.sessionId, collab);
      this.updateAvatarStack();
    }

    collab.cursorLat = data.lat;
    collab.cursorLng = data.lng;
    collab.activeTool = data.activeTool || collab.activeTool;
    collab.isDrawing = data.isDrawing || false;
    collab.lastSeen = Date.now();

    // Position cursor element on screen via Leaflet latLngToContainerPoint
    if (mapEngine.map && collab.element) {
      const pt = mapEngine.map.latLngToContainerPoint([data.lat, data.lng]);
      collab.element.style.transform = `translate3d(${Math.round(pt.x)}px, ${Math.round(pt.y)}px, 0)`;
      collab.element.style.display = 'block';

      // Update cursor tool badge if changed
      const toolBadge = collab.element.querySelector('.cursor-tool-badge');
      if (toolBadge) {
        if (collab.isDrawing) {
          toolBadge.innerHTML = '✏️ Drawing...';
          toolBadge.style.display = 'inline-block';
        } else if (collab.activeTool && collab.activeTool !== 'select') {
          toolBadge.textContent = this.getToolIconName(collab.activeTool);
          toolBadge.style.display = 'inline-block';
        } else {
          toolBadge.style.display = 'none';
        }
      }
    }
  }

  getToolIconName(tool) {
    switch (tool) {
      case 'freehand': return '✏️ Pen';
      case 'line': return '📏 Line';
      case 'arrow': return '↗️ Arrow';
      case 'rect': return '⬜ Rect';
      case 'circle': return '⭕ Circle';
      case 'move': return '↔️ Move';
      case 'marker': return '📍 Pin';
      case 'text': return '🔤 Text';
      default: return tool;
    }
  }

  createCursorElement(sessionId, collab) {
    if (!this.cursorContainer) return;
    const el = document.createElement('div');
    el.className = 'collaborator-cursor';
    el.id = `cursor-${sessionId}`;
    el.innerHTML = `
      <svg class="cursor-pointer-icon" viewBox="0 0 24 24" fill="${collab.color}">
        <path d="M4 0l16 12.279-6.951 1.17 4.325 8.817-3.596 1.734-4.35-8.879-5.428 5.428z" stroke="#ffffff" stroke-width="1.5" />
      </svg>
      <div class="cursor-label" style="background-color: ${collab.color};">
        ${escapeHtml(collab.name)}
        <span class="cursor-tool-badge" style="display:none;"></span>
      </div>
    `;
    this.cursorContainer.appendChild(el);
    collab.element = el;

    // Reposition cursor on map zoom or pan
    mapEngine.map.on('move', () => {
      if (collab.cursorLat && collab.cursorLng && collab.element) {
        const pt = mapEngine.map.latLngToContainerPoint([collab.cursorLat, collab.cursorLng]);
        collab.element.style.transform = `translate3d(${Math.round(pt.x)}px, ${Math.round(pt.y)}px, 0)`;
      }
    });
  }

  addCollaborator(data) {
    if (this.collaborators.has(data.sessionId)) {
      const c = this.collaborators.get(data.sessionId);
      c.lastSeen = Date.now();
      return;
    }
    this.collaborators.set(data.sessionId, {
      name: data.name,
      color: data.color,
      lastSeen: Date.now(),
      element: null
    });
    this.updateAvatarStack();
  }

  removeCollaborator(sessionId) {
    const collab = this.collaborators.get(sessionId);
    if (collab && collab.element) {
      collab.element.remove();
    }
    this.collaborators.delete(sessionId);
    this.updateAvatarStack();
  }

  updateAvatarStack() {
    const stack = document.getElementById('collaborator-stack');
    if (!stack) return;

    stack.innerHTML = '';
    // Current user avatar
    const selfAvatar = document.createElement('div');
    selfAvatar.className = 'avatar-bubble';
    selfAvatar.style.backgroundColor = this.userColor;
    selfAvatar.title = `${auth.currentUser?.name || 'You'} (You)`;
    selfAvatar.textContent = (auth.currentUser?.name || 'Y').substring(0, 1).toUpperCase();
    selfAvatar.innerHTML += '<div class="avatar-pulse-dot"></div>';
    stack.appendChild(selfAvatar);

    // Active collaborators
    this.collaborators.forEach(c => {
      const bubble = document.createElement('div');
      bubble.className = 'avatar-bubble';
      bubble.style.backgroundColor = c.color;
      bubble.title = `${c.name} (Online)`;
      bubble.textContent = c.name.substring(0, 1).toUpperCase();
      bubble.innerHTML += '<div class="avatar-pulse-dot"></div>';
      stack.appendChild(bubble);
    });

    const countElem = document.getElementById('status-collaborator-count');
    if (countElem) {
      const total = this.collaborators.size + 1;
      countElem.textContent = `${total} collaborator${total > 1 ? 's' : ''} online`;
    }
  }

  startPresenceHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      // Remove stale collaborators older than 30s
      this.collaborators.forEach((c, sid) => {
        if (now - c.lastSeen > 30000) {
          this.removeCollaborator(sid);
        }
      });
      this.broadcastPresence();
    }, CONFIG.COLLAB.PRESENCE_HEARTBEAT_MS || 8000);
  }

  startAdaptivePolling() {
    // Graceful background sync fallback when offline or in standalone GAS mode
    this.pollInterval = setInterval(async () => {
      if (this.connectionState === 'connected' && this.socket) return;
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
        if (data.success && data.drawings) {
          window.dispatchEvent(new CustomEvent('dlpc:poll-drawings-sync', { detail: data.drawings }));
        }
      } catch (e) {}
    }, CONFIG.COLLAB.POLL_FALLBACK_INTERVAL_MS || 3000);
  }

  handleRemoteObjectMutation(msg) {
    window.dispatchEvent(new CustomEvent('dlpc:remote-mutation', { detail: msg }));
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const collabEngine = new CollaborationEngine();
