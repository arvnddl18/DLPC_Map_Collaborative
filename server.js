/**
 * DLPC_Map_Collaborative - Local Development & Test Server
 * Replicates Google Apps Script Web App environment, providing full API compatibility
 * for local testing and Playwright automated verification.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const CLIENT_DIR = path.join(__dirname, 'src', 'client');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-Memory & File-backed Database Replicating Google Sheets
let db = {
  users: [
    {
      id: 'USR-ADMIN01',
      email: 'admin@dlpc.com.ph',
      name: 'DLPC Administrator',
      role: 'ADMIN',
      password: 'dlpc2026!',
      status: 'ACTIVE'
    }
  ],
  maps: [
    {
      id: 'MAP-DAVAO01',
      name: 'DLPC Davao Central Grid',
      description: 'Davao City Electrical & Fiber Distribution Network',
      ownerId: 'USR-ADMIN01',
      centerLat: 7.071466,
      centerLng: 125.604971,
      zoom: 14,
      createdAt: new Date().toISOString()
    }
  ],
  mapAccess: [],
  routes: [],
  naps: [
    {
      id: 'DVO_007_L369_N01',
      mapId: 'MAP-DAVAO01',
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
      mapId: 'MAP-DAVAO01',
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
      mapId: 'MAP-DAVAO01',
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
      mapId: 'MAP-DAVAO01',
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
      mapId: 'MAP-DAVAO01',
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
  ],
  drawings: [],
  tags: [
    { id: 'TAG-1', mapId: 'MAP-DAVAO01', name: 'Fiber' },
    { id: 'TAG-2', mapId: 'MAP-DAVAO01', name: 'NAP' },
    { id: 'TAG-3', mapId: 'MAP-DAVAO01', name: 'Maintenance' }
  ],
  auditLogs: []
};

// Load saved database if exists
if (fs.existsSync(DB_FILE)) {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    db = JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load db file, using fresh db');
  }
}

function persistDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // Handle API Requests (/api)
  if (url.pathname === '/api' || url.searchParams.get('api') === '1') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          handleApi(payload, res);
        } catch (err) {
          sendJson(res, { success: false, error: 'Malformed JSON payload: ' + err.message }, 400);
        }
      });
      return;
    }
  }

  // Handle Static File Serving
  let filePath = path.join(CLIENT_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Fallback to index.html for client-side routing
        fs.readFile(path.join(CLIENT_DIR, 'index.html'), (err2, indexContent) => {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(indexContent);
          }
        });
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

function handleApi(payload, res) {
  const action = payload.action;

  // 1. Public: Login
  if (action === 'auth:login') {
    const user = db.users.find(u => u.email.toLowerCase() === (payload.email || '').toLowerCase());
    if (user && user.password === payload.password) {
      const token = 'MOCK_TOKEN_' + Buffer.from(JSON.stringify({ userId: user.id, role: user.role, time: Date.now() })).toString('base64');
      return sendJson(res, {
        success: true,
        sessionToken: token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      });
    }
    return sendJson(res, { success: false, error: 'Invalid email or password.' }, 401);
  }

  // 2. Public: Share Verify
  if (action === 'share:verify') {
    const record = db.mapAccess.find(r => r.token === payload.token && r.mapId === payload.mapId);
    if (!record) return sendJson(res, { success: false, error: 'Invalid share link.' }, 404);
    if (record.revokedAt) return sendJson(res, { success: false, error: 'Link has been revoked.' }, 403);
    const map = db.maps.find(m => m.id === payload.mapId);
    return sendJson(res, { success: true, permission: record.permission, map: map });
  }

  // 3. Map Get
  if (action === 'map:get') {
    const map = db.maps.find(m => m.id === payload.mapId) || db.maps[0];
    const routes = db.routes.filter(r => r.mapId === map.id);
    const drawings = db.drawings.filter(d => d.mapId === map.id);
    const naps = db.naps.filter(n => !n.mapId || n.mapId === map.id);
    const tags = db.tags.filter(t => !t.mapId || t.mapId === map.id);
    return sendJson(res, { success: true, map, routes, drawings, naps, tags });
  }

  // 4. Route Create / Save
  if (action === 'route:create') {
    const existingIdx = db.routes.findIndex(r => r.id === payload.id);
    if (existingIdx !== -1) {
      db.routes[existingIdx] = { ...db.routes[existingIdx], ...payload };
    } else {
      db.routes.push(payload);
    }
    persistDb();
    return sendJson(res, { success: true, route: payload });
  }

  // 5. Route Delete
  if (action === 'route:delete') {
    db.routes = db.routes.filter(r => r.id !== payload.routeId);
    persistDb();
    return sendJson(res, { success: true });
  }

  // 6. Drawing Save
  if (action === 'drawing:save') {
    const drawing = payload.drawing;
    const existingIdx = db.drawings.findIndex(d => d.id === drawing.id);
    if (existingIdx !== -1) {
      db.drawings[existingIdx] = { ...db.drawings[existingIdx], ...drawing };
    } else {
      db.drawings.push(drawing);
    }
    persistDb();
    return sendJson(res, { success: true, drawing });
  }

  // 7. Drawing Delete
  if (action === 'drawing:delete') {
    db.drawings = db.drawings.filter(d => d.id !== payload.drawingId);
    persistDb();
    return sendJson(res, { success: true });
  }

  // 8. NAP Batch Sync
  if (action === 'nap:batchSync') {
    const newRecords = payload.records || [];
    const targetMapId = payload.mapId || 'MAP-DAVAO01';
    if (!global.napIndexMap || global.napIndexMapSize !== db.naps.length) {
      global.napIndexMap = new Map();
      for (let i = 0; i < db.naps.length; i++) {
        global.napIndexMap.set(db.naps[i].id, i);
      }
      global.napIndexMapSize = db.naps.length;
    }

    for (let i = 0; i < newRecords.length; i++) {
      const rec = newRecords[i];
      if (!rec.mapId) rec.mapId = targetMapId;
      if (global.napIndexMap.has(rec.id)) {
        const idx = global.napIndexMap.get(rec.id);
        db.naps[idx] = { ...db.naps[idx], ...rec };
      } else {
        global.napIndexMap.set(rec.id, db.naps.length);
        db.naps.push(rec);
      }
    }
    global.napIndexMapSize = db.naps.length;
    persistDb();
    return sendJson(res, { success: true, importedCount: newRecords.length });
  }

  // 9. Share Generate
  if (action === 'share:generate') {
    const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    const record = {
      id: 'ACC-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      mapId: payload.mapId,
      token: token,
      permission: payload.permission || 'VIEW',
      createdAt: new Date().toISOString(),
      revokedAt: null
    };
    db.mapAccess.push(record);
    persistDb();
    return sendJson(res, { success: true, accessRecord: record });
  }

  // 10. Share List
  if (action === 'share:list') {
    const links = db.mapAccess.filter(l => l.mapId === payload.mapId);
    return sendJson(res, { success: true, links: links });
  }

  // 11. Share Revoke
  if (action === 'share:revoke') {
    const link = db.mapAccess.find(l => l.id === payload.linkId);
    if (link) link.revokedAt = new Date().toISOString();
    persistDb();
    return sendJson(res, { success: true });
  }

  return sendJson(res, { success: false, error: 'Action not found: ' + action }, 404);
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ==============================================================================
// REAL-TIME COLLABORATIVE WEBSOCKET HUB
// Ultra-low latency bi-directional message synchronization across clients
// ==============================================================================
const wss = new WebSocketServer({ server });
const rooms = new Map(); // mapId -> Set<WebSocket>

wss.on('connection', (ws, req) => {
  let clientMapId = 'MAP-DAVAO01';
  let clientSessionId = null;

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.searchParams.get('mapId')) {
      clientMapId = url.searchParams.get('mapId');
    }
  } catch (e) {}

  addClientToRoom(clientMapId, ws);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.mapId && data.mapId !== clientMapId) {
        removeClientFromRoom(clientMapId, ws);
        clientMapId = data.mapId;
        addClientToRoom(clientMapId, ws);
      }
      if (data.sessionId) {
        clientSessionId = data.sessionId;
      }

      // Live drawing persistence for completed drawing objects
      if (data.type === 'OBJECT_MUTATION' && data.objectType === 'DRAWING' && data.data) {
        const drawing = data.data;
        if (data.action === 'CREATE' || data.action === 'UPDATE') {
          const idx = db.drawings.findIndex(d => d.id === drawing.id);
          if (idx !== -1) db.drawings[idx] = { ...db.drawings[idx], ...drawing };
          else db.drawings.push(drawing);
          persistDb();
        } else if (data.action === 'DELETE') {
          db.drawings = db.drawings.filter(d => d.id !== (drawing.id || drawing));
          persistDb();
        }
      } else if (data.type === 'DRAWING_LIVE_END' && data.finalDrawing) {
        const drawing = data.finalDrawing;
        const idx = db.drawings.findIndex(d => d.id === drawing.id);
        if (idx !== -1) db.drawings[idx] = { ...db.drawings[idx], ...drawing };
        else db.drawings.push(drawing);
        persistDb();
      }

      // Broadcast immediately with 0 delay to all other connected peers in this map room
      broadcastToRoom(clientMapId, ws, data);
    } catch (err) {
      console.warn('WebSocket message error:', err.message);
    }
  });

  ws.on('close', () => {
    removeClientFromRoom(clientMapId, ws);
    if (clientSessionId) {
      broadcastToRoom(clientMapId, ws, {
        type: 'PRESENCE_LEAVE',
        sessionId: clientSessionId,
        timestamp: Date.now()
      });
    }
  });

  ws.on('error', (err) => {
    removeClientFromRoom(clientMapId, ws);
  });
});

function addClientToRoom(mapId, ws) {
  if (!rooms.has(mapId)) {
    rooms.set(mapId, new Set());
  }
  rooms.get(mapId).add(ws);
}

function removeClientFromRoom(mapId, ws) {
  if (rooms.has(mapId)) {
    rooms.get(mapId).delete(ws);
    if (rooms.get(mapId).size === 0) {
      rooms.delete(mapId);
    }
  }
}

function broadcastToRoom(mapId, senderWs, messageObj) {
  const room = rooms.get(mapId);
  if (!room) return;
  const rawMsg = JSON.stringify(messageObj);
  for (const client of room) {
    if (client !== senderWs && client.readyState === WebSocket.OPEN) {
      client.send(rawMsg);
    }
  }
}

server.listen(PORT, () => {
  console.log(`DLPC Collaborative Map Test Server running at http://localhost:${PORT}`);
  console.log(`WebSocket Collaborative Server active on port ${PORT}`);
});
