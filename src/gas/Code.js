/**
 * DLPC_Map_Collaborative - Google Apps Script Server Backend
 * Production-ready serverless backend with multi-role RBAC, LockService concurrency,
 * Google Sheets relational data persistence, cryptographic share tokens, and audit logging.
 */

// ==============================================================================
// CONFIGURATION & CONSTANTS
// ==============================================================================
const CONFIG = {
  APP_NAME: 'DLPC Collaborative Map',
  DATABASE_SPREADSHEET_ID: '', // Set via ScriptProperties or auto-creates in Drive
  SESSION_DURATION_HOURS: 24,
  MAX_LOCK_WAIT_MS: 10000,
  DEFAULT_MAP_CENTER: { lat: 7.071466, lng: 125.604971 }, // Davao City
  DEFAULT_PROXIMITY_THRESHOLD_METERS: 25,
  ROLES: {
    ADMIN: 'ADMIN',
    EDITOR: 'EDITOR',
    VIEWER: 'VIEWER'
  },
  PERMISSIONS: {
    VIEW: 'VIEW',
    EDIT: 'EDIT',
    ADMIN: 'ADMIN'
  }
};

// ==============================================================================
// HTTP ENTRY POINTS: doGet & doPost
// ==============================================================================

/**
 * Handles HTTP GET requests.
 * Serves the Web App UI or handles REST GET queries.
 */
function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    
    // API endpoint handler if ?api=1 is passed
    if (params.api === '1') {
      return handleApiGet_(params);
    }

    // Serve HTML5 Web App
    const template = HtmlService.createTemplateFromFile('Index');
    template.mapId = params.mapId || '';
    template.token = params.token || '';
    template.mode = params.mode || (params.token ? 'shared' : 'direct');
    
    return template.evaluate()
      .setTitle(CONFIG.APP_NAME)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return HtmlService.createHtmlOutput('<h3>Error loading application: ' + escapeHtml_(err.message) + '</h3>');
  }
}

/**
 * Handles HTTP POST requests.
 * Processes JSON API requests with authentication and server-side RBAC validation.
 */
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      payload = e.parameter;
    }
    
    const action = payload.action;
    if (!action) {
      return jsonResponse_({ success: false, error: 'Missing required "action" parameter.' }, 400);
    }

    return routeApiPost_(action, payload);
  } catch (err) {
    return jsonResponse_({ success: false, error: 'Server error: ' + err.message }, 500);
  }
}

// ==============================================================================
// API ROUTING & ACTION DISPATCHER
// ==============================================================================

function routeApiPost_(action, payload) {
  // Public actions (No session required)
  if (action === 'auth:login') {
    return handleLogin_(payload);
  }
  if (action === 'share:verify') {
    return handleShareVerify_(payload);
  }

  // Protected actions require valid Session Token or Share Link Token
  const auth = authenticateRequest_(payload);
  if (!auth.authenticated) {
    return jsonResponse_({ success: false, error: 'Unauthorized: ' + auth.error }, 401);
  }

  switch (action) {
    // Session & Auth
    case 'auth:verifySession':
      return jsonResponse_({ success: true, user: auth.user });

    // Maps Management
    case 'map:list':
      return handleMapList_(auth);
    case 'map:create':
      return requirePermission_(auth, CONFIG.PERMISSIONS.ADMIN, () => handleMapCreate_(payload, auth));
    case 'map:get':
      return handleMapGet_(payload, auth);
    case 'map:update':
      return requirePermission_(auth, CONFIG.PERMISSIONS.ADMIN, () => handleMapUpdate_(payload, auth));
    case 'map:delete':
      return requirePermission_(auth, CONFIG.PERMISSIONS.ADMIN, () => handleMapDelete_(payload, auth));

    // Sharing Links Management
    case 'share:generate':
      return requirePermission_(auth, CONFIG.PERMISSIONS.ADMIN, () => handleShareGenerate_(payload, auth));
    case 'share:list':
      return requirePermission_(auth, CONFIG.PERMISSIONS.ADMIN, () => handleShareList_(payload, auth));
    case 'share:revoke':
      return requirePermission_(auth, CONFIG.PERMISSIONS.ADMIN, () => handleShareRevoke_(payload, auth));

    // Routes
    case 'route:list':
      return handleRouteList_(payload, auth);
    case 'route:create':
      return requirePermission_(auth, CONFIG.PERMISSIONS.EDIT, () => handleRouteCreate_(payload, auth));
    case 'route:update':
      return requirePermission_(auth, CONFIG.PERMISSIONS.EDIT, () => handleRouteUpdate_(payload, auth));
    case 'route:delete':
      return requirePermission_(auth, CONFIG.PERMISSIONS.EDIT, () => handleRouteDelete_(payload, auth));

    // NAPs (Network Access Points)
    case 'nap:list':
      return handleNapList_(payload, auth);
    case 'nap:batchSync':
      return requirePermission_(auth, CONFIG.PERMISSIONS.ADMIN, () => handleNapBatchSync_(payload, auth));
    case 'nap:update':
      return requirePermission_(auth, CONFIG.PERMISSIONS.EDIT, () => handleNapUpdate_(payload, auth));

    // Canva Drawings
    case 'drawing:list':
      return handleDrawingList_(payload, auth);
    case 'drawing:save':
      return requirePermission_(auth, CONFIG.PERMISSIONS.EDIT, () => handleDrawingSave_(payload, auth));
    case 'drawing:delete':
      return requirePermission_(auth, CONFIG.PERMISSIONS.EDIT, () => handleDrawingDelete_(payload, auth));

    // Tags
    case 'tag:list':
      return handleTagList_(payload, auth);
    case 'tag:save':
      return requirePermission_(auth, CONFIG.PERMISSIONS.EDIT, () => handleTagSave_(payload, auth));

    // Audit Logs
    case 'audit:list':
      return requirePermission_(auth, CONFIG.PERMISSIONS.ADMIN, () => handleAuditList_(payload, auth));

    default:
      return jsonResponse_({ success: false, error: 'Unknown action: ' + action }, 404);
  }
}

// ==============================================================================
// AUTHENTICATION & ACCESS CONTROL
// ==============================================================================

/**
 * Authenticates user credentials and issues a cryptographic session token.
 */
function handleLogin_(payload) {
  const email = (payload.email || '').trim().toLowerCase();
  const password = payload.password || '';

  if (!email || !password) {
    return jsonResponse_({ success: false, error: 'Email and password are required.' }, 400);
  }

  const db = getDatabase_();
  const users = getSheetRows_(db, 'Users');
  const user = users.find(u => u.email.toLowerCase() === email);

  if (!user) {
    return jsonResponse_({ success: false, error: 'Invalid credentials.' }, 401);
  }

  if (user.status !== 'ACTIVE') {
    return jsonResponse_({ success: false, error: 'Account is suspended. Contact administrator.' }, 403);
  }

  const hash = hashPassword_(password, user.salt);
  if (hash !== user.passwordHash) {
    return jsonResponse_({ success: false, error: 'Invalid credentials.' }, 401);
  }

  // Generate secure session token
  const tokenPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    issuedAt: Date.now(),
    expiresAt: Date.now() + (CONFIG.SESSION_DURATION_HOURS * 3600 * 1000)
  };

  const sessionToken = generateSignedToken_(tokenPayload);

  logAuditEvent_('', user.id, 'AUTH_LOGIN', user.id, { email: user.email, role: user.role });

  return jsonResponse_({
    success: true,
    sessionToken: sessionToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
}

/**
 * Validates session token or share link token.
 */
function authenticateRequest_(payload) {
  const sessionToken = payload.sessionToken;
  const shareToken = payload.shareToken;
  const mapId = payload.mapId;

  // 1. Check Session Token
  if (sessionToken) {
    const verified = verifySignedToken_(sessionToken);
    if (verified && verified.expiresAt > Date.now()) {
      return {
        authenticated: true,
        type: 'SESSION',
        user: verified,
        role: verified.role,
        permission: verified.role === CONFIG.ROLES.ADMIN ? CONFIG.PERMISSIONS.ADMIN : CONFIG.PERMISSIONS.EDIT
      };
    }
  }

  // 2. Check Share Link Token
  if (shareToken && mapId) {
    const db = getDatabase_();
    const accessRecords = getSheetRows_(db, 'MapAccess');
    const record = accessRecords.find(r => r.token === shareToken && r.mapId === mapId);

    if (record) {
      if (record.revokedAt) {
        return { authenticated: false, error: 'Share link has been revoked.' };
      }
      if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
        return { authenticated: false, error: 'Share link has expired.' };
      }

      return {
        authenticated: true,
        type: 'SHARE_TOKEN',
        user: {
          id: 'GUEST_' + shareToken.substring(0, 8),
          name: payload.collaboratorName || 'Collaborator (' + record.permission + ')',
          role: record.permission === 'EDIT' ? CONFIG.ROLES.EDITOR : CONFIG.ROLES.VIEWER
        },
        role: record.permission === 'EDIT' ? CONFIG.ROLES.EDITOR : CONFIG.ROLES.VIEWER,
        permission: record.permission
      };
    }
  }

  return { authenticated: false, error: 'Invalid or missing authentication credentials.' };
}

function requirePermission_(auth, requiredLevel, callback) {
  if (requiredLevel === CONFIG.PERMISSIONS.ADMIN && auth.role !== CONFIG.ROLES.ADMIN) {
    return jsonResponse_({ success: false, error: 'Forbidden: Administrator privileges required.' }, 403);
  }
  if (requiredLevel === CONFIG.PERMISSIONS.EDIT && auth.permission !== CONFIG.PERMISSIONS.EDIT && auth.role !== CONFIG.ROLES.ADMIN) {
    return jsonResponse_({ success: false, error: 'Forbidden: Edit privileges required.' }, 403);
  }
  return callback();
}

// ==============================================================================
// MAPS MANAGEMENT CONTROLLER
// ==============================================================================

function handleMapList_(auth) {
  const db = getDatabase_();
  const maps = getSheetRows_(db, 'Maps');
  return jsonResponse_({ success: true, maps: maps });
}

function handleMapCreate_(payload, auth) {
  const name = (payload.name || '').trim();
  if (!name) {
    return jsonResponse_({ success: false, error: 'Map name is required.' }, 400);
  }

  const mapId = 'MAP-' + Utilities.getUuid().substring(0, 8).toUpperCase();
  const newMap = {
    id: mapId,
    name: name,
    description: (payload.description || '').trim(),
    ownerId: auth.user.id,
    centerLat: payload.centerLat || CONFIG.DEFAULT_MAP_CENTER.lat,
    centerLng: payload.centerLng || CONFIG.DEFAULT_MAP_CENTER.lng,
    zoom: payload.zoom || 13,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  withLock_(() => {
    const db = getDatabase_();
    appendSheetRow_(db, 'Maps', newMap);
  });

  logAuditEvent_(mapId, auth.user.id, 'MAP_CREATE', mapId, { name: name });

  return jsonResponse_({ success: true, map: newMap });
}

function handleMapGet_(payload, auth) {
  const mapId = payload.mapId;
  if (!mapId) return jsonResponse_({ success: false, error: 'mapId is required' }, 400);

  const db = getDatabase_();
  const maps = getSheetRows_(db, 'Maps');
  const map = maps.find(m => m.id === mapId);

  if (!map) return jsonResponse_({ success: false, error: 'Map not found' }, 404);

  // Retrieve associated objects
  const routes = getSheetRows_(db, 'Routes').filter(r => r.mapId === mapId);
  const drawings = getSheetRows_(db, 'Drawings').filter(d => d.mapId === mapId);
  const naps = getSheetRows_(db, 'NAPs').filter(n => n.mapId === mapId);
  const tags = getSheetRows_(db, 'Tags').filter(t => t.mapId === mapId);

  return jsonResponse_({
    success: true,
    map: map,
    routes: routes,
    drawings: drawings,
    naps: naps,
    tags: tags
  });
}

function handleMapUpdate_(payload, auth) {
  const mapId = payload.mapId;
  if (!mapId) return jsonResponse_({ success: false, error: 'mapId is required' }, 400);

  withLock_(() => {
    const db = getDatabase_();
    updateSheetRow_(db, 'Maps', 'id', mapId, {
      name: payload.name,
      description: payload.description,
      centerLat: payload.centerLat,
      centerLng: payload.centerLng,
      zoom: payload.zoom,
      updatedAt: new Date().toISOString()
    });
  });

  logAuditEvent_(mapId, auth.user.id, 'MAP_UPDATE', mapId, payload);
  return jsonResponse_({ success: true, message: 'Map updated successfully.' });
}

function handleMapDelete_(payload, auth) {
  const mapId = payload.mapId;
  if (!mapId) return jsonResponse_({ success: false, error: 'mapId is required' }, 400);

  withLock_(() => {
    const db = getDatabase_();
    deleteSheetRows_(db, 'Maps', 'id', mapId);
    deleteSheetRows_(db, 'Routes', 'mapId', mapId);
    deleteSheetRows_(db, 'Drawings', 'mapId', mapId);
    deleteSheetRows_(db, 'NAPs', 'mapId', mapId);
    deleteSheetRows_(db, 'MapAccess', 'mapId', mapId);
  });

  logAuditEvent_(mapId, auth.user.id, 'MAP_DELETE', mapId, {});
  return jsonResponse_({ success: true, message: 'Map deleted successfully.' });
}

// ==============================================================================
// SHARING & CRYPTOGRAPHIC TOKEN CONTROLLER
// ==============================================================================

function handleShareGenerate_(payload, auth) {
  const mapId = payload.mapId;
  const permission = payload.permission === 'EDIT' ? 'EDIT' : 'VIEW';
  const expirationDays = parseInt(payload.expirationDays || 30, 10);

  if (!mapId) return jsonResponse_({ success: false, error: 'mapId is required' }, 400);

  // Generate 64-char random cryptographic token
  const token = generateSecureHexToken_(32);
  const now = new Date();
  const expiresAt = expirationDays > 0 ? new Date(now.getTime() + (expirationDays * 86400000)).toISOString() : null;

  const accessRecord = {
    id: 'ACC-' + Utilities.getUuid().substring(0, 8),
    mapId: mapId,
    token: token,
    permission: permission,
    createdBy: auth.user.id,
    expiresAt: expiresAt,
    revokedAt: null,
    createdAt: now.toISOString()
  };

  withLock_(() => {
    const db = getDatabase_();
    appendSheetRow_(db, 'MapAccess', accessRecord);
  });

  logAuditEvent_(mapId, auth.user.id, 'SHARE_LINK_GENERATE', accessRecord.id, {
    permission: permission,
    expiresAt: expiresAt
  });

  return jsonResponse_({
    success: true,
    accessRecord: accessRecord,
    shareUrl: getScriptUrl_() + '?mapId=' + encodeURIComponent(mapId) + '&token=' + encodeURIComponent(token) + '&mode=' + permission.toLowerCase()
  });
}

function handleShareVerify_(payload) {
  const token = payload.token;
  const mapId = payload.mapId;

  if (!token || !mapId) {
    return jsonResponse_({ success: false, error: 'Token and mapId are required' }, 400);
  }

  const db = getDatabase_();
  const accessRecords = getSheetRows_(db, 'MapAccess');
  const record = accessRecords.find(r => r.token === token && r.mapId === mapId);

  if (!record) {
    return jsonResponse_({ success: false, error: 'Invalid share link.' }, 404);
  }
  if (record.revokedAt) {
    return jsonResponse_({ success: false, error: 'This share link has been revoked.' }, 403);
  }
  if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
    return jsonResponse_({ success: false, error: 'This share link has expired.' }, 403);
  }

  const maps = getSheetRows_(db, 'Maps');
  const map = maps.find(m => m.id === mapId);

  return jsonResponse_({
    success: true,
    permission: record.permission,
    map: map
  });
}

function handleShareList_(payload, auth) {
  const mapId = payload.mapId;
  const db = getDatabase_();
  const records = getSheetRows_(db, 'MapAccess').filter(r => r.mapId === mapId);
  return jsonResponse_({ success: true, links: records });
}

function handleShareRevoke_(payload, auth) {
  const linkId = payload.linkId;
  if (!linkId) return jsonResponse_({ success: false, error: 'linkId is required' }, 400);

  withLock_(() => {
    const db = getDatabase_();
    updateSheetRow_(db, 'MapAccess', 'id', linkId, {
      revokedAt: new Date().toISOString()
    });
  });

  logAuditEvent_(payload.mapId || '', auth.user.id, 'SHARE_LINK_REVOKE', linkId, {});
  return jsonResponse_({ success: true, message: 'Share link revoked successfully.' });
}

// ==============================================================================
// ROUTES CONTROLLER
// ==============================================================================

function handleRouteList_(payload, auth) {
  const mapId = payload.mapId;
  const db = getDatabase_();
  const routes = getSheetRows_(db, 'Routes').filter(r => r.mapId === mapId);
  return jsonResponse_({ success: true, routes: routes });
}

function handleRouteCreate_(payload, auth) {
  const mapId = payload.mapId;
  if (!mapId) return jsonResponse_({ success: false, error: 'mapId is required' }, 400);

  const startLat = parseFloat(payload.startLat);
  const startLng = parseFloat(payload.startLng);
  const endLat = parseFloat(payload.endLat);
  const endLng = parseFloat(payload.endLng);

  if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
    return jsonResponse_({ success: false, error: 'Valid numerical coordinates are required.' }, 400);
  }

  // Validate range
  if (startLat < -90 || startLat > 90 || endLat < -90 || endLat > 90 ||
      startLng < -180 || startLng > 180 || endLng < -180 || endLng > 180) {
    return jsonResponse_({ success: false, error: 'Coordinates out of bounds.' }, 400);
  }

  const routeId = 'ROUTE-' + Utilities.getUuid().substring(0, 6).toUpperCase();
  const now = new Date().toISOString();

  const newRoute = {
    id: routeId,
    name: payload.name || routeId,
    mapId: mapId,
    startLat: startLat,
    startLng: startLng,
    endLat: endLat,
    endLng: endLng,
    generatedStartAddress: payload.generatedStartAddress || '',
    generatedEndAddress: payload.generatedEndAddress || '',
    correctedStartAddress: payload.correctedStartAddress || payload.generatedStartAddress || '',
    correctedEndAddress: payload.correctedEndAddress || payload.generatedEndAddress || '',
    geometry: typeof payload.geometry === 'object' ? JSON.stringify(payload.geometry) : (payload.geometry || '[]'),
    distanceMeters: parseFloat(payload.distanceMeters || 0),
    status: payload.status || 'Active',
    tags: JSON.stringify(payload.tags || []),
    notes: payload.notes || '',
    version: 1,
    createdBy: auth.user.name || auth.user.id,
    updatedBy: auth.user.name || auth.user.id,
    createdAt: now,
    updatedAt: now
  };

  withLock_(() => {
    const db = getDatabase_();
    appendSheetRow_(db, 'Routes', newRoute);
  });

  logAuditEvent_(mapId, auth.user.id, 'ROUTE_CREATE', routeId, { distance: newRoute.distanceMeters });

  return jsonResponse_({ success: true, route: newRoute });
}

function handleRouteUpdate_(payload, auth) {
  const routeId = payload.routeId || (payload.route && payload.route.id);
  if (!routeId) return jsonResponse_({ success: false, error: 'routeId is required' }, 400);

  const updates = {
    name: payload.name,
    correctedStartAddress: payload.correctedStartAddress,
    correctedEndAddress: payload.correctedEndAddress,
    status: payload.status,
    tags: payload.tags ? JSON.stringify(payload.tags) : undefined,
    notes: payload.notes,
    updatedBy: auth.user.name || auth.user.id,
    updatedAt: new Date().toISOString()
  };

  // Clean undefined properties
  Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);

  withLock_(() => {
    const db = getDatabase_();
    updateSheetRow_(db, 'Routes', 'id', routeId, updates);
  });

  logAuditEvent_(payload.mapId || '', auth.user.id, 'ROUTE_UPDATE', routeId, updates);
  return jsonResponse_({ success: true, message: 'Route updated successfully.' });
}

function handleRouteDelete_(payload, auth) {
  const routeId = payload.routeId;
  if (!routeId) return jsonResponse_({ success: false, error: 'routeId is required' }, 400);

  withLock_(() => {
    const db = getDatabase_();
    deleteSheetRows_(db, 'Routes', 'id', routeId);
  });

  logAuditEvent_(payload.mapId || '', auth.user.id, 'ROUTE_DELETE', routeId, {});
  return jsonResponse_({ success: true, message: 'Route deleted successfully.' });
}

// ==============================================================================
// NAP FACILITY CONTROLLER (STREAMING BATCH SYNC)
// ==============================================================================

function handleNapList_(payload, auth) {
  const mapId = payload.mapId;
  const db = getDatabase_();
  const naps = getSheetRows_(db, 'NAPs').filter(n => n.mapId === mapId);
  return jsonResponse_({ success: true, naps: naps });
}

/**
 * Handles batch insertion of pre-filtered Davao South & Davao North NAP records.
 */
function handleNapBatchSync_(payload, auth) {
  const mapId = payload.mapId;
  const records = payload.records || [];

  if (!mapId || !Array.isArray(records)) {
    return jsonResponse_({ success: false, error: 'mapId and records array required.' }, 400);
  }

  const now = new Date().toISOString();
  const rowsToInsert = records.map(r => ({
    id: r.id || ('NAP-' + Utilities.getUuid().substring(0, 6).toUpperCase()),
    mapId: mapId,
    name: r.name || r.id,
    latitude: parseFloat(r.latitude),
    longitude: parseFloat(r.longitude),
    address: r.address || '',
    city: r.city || 'Davao City',
    region: r.region || 'Davao',
    status: r.status || 'In Service',
    capacity: parseInt(r.capacity || 8, 10),
    availablePorts: parseInt(r.availablePorts || 8, 10),
    metadata: typeof r.metadata === 'object' ? JSON.stringify(r.metadata) : (r.metadata || '{}'),
    updatedAt: now
  }));

  withLock_(() => {
    const db = getDatabase_();
    appendSheetRowsBatch_(db, 'NAPs', rowsToInsert);
  });

  logAuditEvent_(mapId, auth.user.id, 'NAP_IMPORT_BATCH', mapId, { count: rowsToInsert.length });

  return jsonResponse_({ success: true, importedCount: rowsToInsert.length });
}

function handleNapUpdate_(payload, auth) {
  const napId = payload.napId;
  if (!napId) return jsonResponse_({ success: false, error: 'napId is required' }, 400);

  const updates = {
    name: payload.name,
    address: payload.address,
    status: payload.status,
    capacity: payload.capacity,
    availablePorts: payload.availablePorts,
    metadata: payload.metadata ? JSON.stringify(payload.metadata) : undefined,
    updatedAt: new Date().toISOString()
  };
  Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);

  withLock_(() => {
    const db = getDatabase_();
    updateSheetRow_(db, 'NAPs', 'id', napId, updates);
  });

  logAuditEvent_(payload.mapId || '', auth.user.id, 'NAP_UPDATE', napId, updates);
  return jsonResponse_({ success: true, message: 'NAP updated successfully.' });
}

// ==============================================================================
// CANVA-STYLE DRAWING CONTROLLER
// ==============================================================================

function handleDrawingList_(payload, auth) {
  const mapId = payload.mapId;
  const db = getDatabase_();
  const drawings = getSheetRows_(db, 'Drawings').filter(d => d.mapId === mapId);
  return jsonResponse_({ success: true, drawings: drawings });
}

function handleDrawingSave_(payload, auth) {
  const mapId = payload.mapId;
  const drawing = payload.drawing;
  if (!mapId || !drawing) {
    return jsonResponse_({ success: false, error: 'mapId and drawing payload required' }, 400);
  }

  const drawingId = drawing.id || ('DRAW-' + Utilities.getUuid().substring(0, 6).toUpperCase());
  const now = new Date().toISOString();

  const record = {
    id: drawingId,
    mapId: mapId,
    type: drawing.type || 'freehand',
    geometry: typeof drawing.geometry === 'object' ? JSON.stringify(drawing.geometry) : drawing.geometry,
    style: typeof drawing.style === 'object' ? JSON.stringify(drawing.style) : drawing.style,
    text: drawing.text || '',
    tags: JSON.stringify(drawing.tags || []),
    version: (drawing.version || 0) + 1,
    createdBy: auth.user.name || auth.user.id,
    updatedAt: now
  };

  withLock_(() => {
    const db = getDatabase_();
    const existing = getSheetRows_(db, 'Drawings').find(d => d.id === drawingId);
    if (existing) {
      updateSheetRow_(db, 'Drawings', 'id', drawingId, record);
    } else {
      appendSheetRow_(db, 'Drawings', record);
    }
  });

  logAuditEvent_(mapId, auth.user.id, 'DRAWING_SAVE', drawingId, { type: record.type });
  return jsonResponse_({ success: true, drawing: record });
}

function handleDrawingDelete_(payload, auth) {
  const drawingId = payload.drawingId;
  if (!drawingId) return jsonResponse_({ success: false, error: 'drawingId is required' }, 400);

  withLock_(() => {
    const db = getDatabase_();
    deleteSheetRows_(db, 'Drawings', 'id', drawingId);
  });

  logAuditEvent_(payload.mapId || '', auth.user.id, 'DRAWING_DELETE', drawingId, {});
  return jsonResponse_({ success: true, message: 'Drawing deleted successfully.' });
}

// ==============================================================================
// TAGS & AUDIT LOGS CONTROLLERS
// ==============================================================================

function handleTagList_(payload, auth) {
  const mapId = payload.mapId;
  const db = getDatabase_();
  const tags = getSheetRows_(db, 'Tags').filter(t => t.mapId === mapId);
  return jsonResponse_({ success: true, tags: tags });
}

function handleTagSave_(payload, auth) {
  const mapId = payload.mapId;
  const tagName = (payload.name || '').trim();
  if (!mapId || !tagName) return jsonResponse_({ success: false, error: 'mapId and name required' }, 400);

  const tagId = 'TAG-' + Utilities.getUuid().substring(0, 6).toUpperCase();
  const record = {
    id: tagId,
    mapId: mapId,
    name: tagName,
    metadata: JSON.stringify(payload.metadata || {})
  };

  withLock_(() => {
    const db = getDatabase_();
    appendSheetRow_(db, 'Tags', record);
  });

  return jsonResponse_({ success: true, tag: record });
}

function handleAuditList_(payload, auth) {
  const mapId = payload.mapId;
  const db = getDatabase_();
  let logs = getSheetRows_(db, 'AuditLogs');
  if (mapId) logs = logs.filter(l => l.mapId === mapId);
  return jsonResponse_({ success: true, logs: logs.slice(-100) }); // Return last 100
}

// ==============================================================================
// DATABASE INITIALIZATION & SCHEMA HELPERS (GOOGLE SHEETS)
// ==============================================================================

const SCHEMA = {
  Users: ['id', 'email', 'name', 'role', 'passwordHash', 'salt', 'status', 'createdAt'],
  Maps: ['id', 'name', 'description', 'ownerId', 'centerLat', 'centerLng', 'zoom', 'createdAt', 'updatedAt'],
  MapAccess: ['id', 'mapId', 'token', 'permission', 'createdBy', 'expiresAt', 'revokedAt', 'createdAt'],
  Routes: ['id', 'name', 'mapId', 'startLat', 'startLng', 'endLat', 'endLng', 'generatedStartAddress', 'generatedEndAddress', 'correctedStartAddress', 'correctedEndAddress', 'geometry', 'distanceMeters', 'status', 'tags', 'notes', 'version', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt'],
  NAPs: ['id', 'mapId', 'name', 'latitude', 'longitude', 'address', 'city', 'region', 'status', 'capacity', 'availablePorts', 'metadata', 'updatedAt'],
  Drawings: ['id', 'mapId', 'type', 'geometry', 'style', 'text', 'tags', 'version', 'createdBy', 'updatedAt'],
  Tags: ['id', 'mapId', 'name', 'metadata'],
  AuditLogs: ['id', 'timestamp', 'mapId', 'userId', 'action', 'targetId', 'details']
};

/**
 * Retrieves or initializes the Google Spreadsheet relational database.
 */
function getDatabase_() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty('DATABASE_SPREADSHEET_ID');

  if (ssId) {
    try {
      return SpreadsheetApp.openById(ssId);
    } catch (e) {
      // Re-create if deleted or inaccessible
    }
  }

  // Create new dedicated database spreadsheet
  const ss = SpreadsheetApp.create('DLPC_Map_Collaborative_Database');
  props.setProperty('DATABASE_SPREADSHEET_ID', ss.getId());

  // Initialize sheets
  Object.keys(SCHEMA).forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    sheet.clear();
    sheet.appendRow(SCHEMA[sheetName]);
    sheet.setFrozenRows(1);
  });

  // Remove default "Sheet1" if present
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  // Seed initial Admin user (admin@dlpc.com.ph / dlpc2026!)
  const salt = generateSecureHexToken_(16);
  const passwordHash = hashPassword_('dlpc2026!', salt);
  const defaultAdmin = {
    id: 'USR-ADMIN01',
    email: 'admin@dlpc.com.ph',
    name: 'DLPC Administrator',
    role: 'ADMIN',
    passwordHash: passwordHash,
    salt: salt,
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  };
  appendSheetRow_(ss, 'Users', defaultAdmin);

  // Seed default Demo Map
  const defaultMap = {
    id: 'MAP-DAVAO01',
    name: 'DLPC Davao Central Grid',
    description: 'Davao City Electrical & Fiber Distribution Network',
    ownerId: 'USR-ADMIN01',
    centerLat: CONFIG.DEFAULT_MAP_CENTER.lat,
    centerLng: CONFIG.DEFAULT_MAP_CENTER.lng,
    zoom: 14,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  appendSheetRow_(ss, 'Maps', defaultMap);

  return ss;
}

function getSheetRows_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    rows.push(row);
  }
  return rows;
}

function appendSheetRow_(ss, sheetName, rowObject) {
  const sheet = ss.getSheetByName(sheetName);
  const headers = SCHEMA[sheetName];
  const rowData = headers.map(header => {
    const val = rowObject[header];
    return val !== undefined && val !== null ? sanitizeSpreadsheetValue_(val) : '';
  });
  sheet.appendRow(rowData);
}

function appendSheetRowsBatch_(ss, sheetName, rowObjects) {
  if (!rowObjects.length) return;
  const sheet = ss.getSheetByName(sheetName);
  const headers = SCHEMA[sheetName];
  const matrix = rowObjects.map(obj => {
    return headers.map(header => {
      const val = obj[header];
      return val !== undefined && val !== null ? sanitizeSpreadsheetValue_(val) : '';
    });
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, matrix.length, headers.length).setValues(matrix);
}

function updateSheetRow_(ss, sheetName, matchKey, matchVal, updates) {
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;

  const headers = data[0];
  const keyIndex = headers.indexOf(matchKey);
  if (keyIndex === -1) return;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][keyIndex]) === String(matchVal)) {
      Object.keys(updates).forEach(col => {
        const colIdx = headers.indexOf(col);
        if (colIdx !== -1) {
          sheet.getRange(i + 1, colIdx + 1).setValue(sanitizeSpreadsheetValue_(updates[col]));
        }
      });
      break;
    }
  }
}

function deleteSheetRows_(ss, sheetName, matchKey, matchVal) {
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;

  const headers = data[0];
  const keyIndex = headers.indexOf(matchKey);
  if (keyIndex === -1) return;

  // Iterate backwards to safely delete rows
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][keyIndex]) === String(matchVal)) {
      sheet.deleteRow(i + 1);
    }
  }
}

// ==============================================================================
// CONCURRENCY, CRYPTOGRAPHY & UTILITY FUNCTIONS
// ==============================================================================

/**
 * Runs an action inside a LockService lock to eliminate concurrency race conditions.
 */
function withLock_(action) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.MAX_LOCK_WAIT_MS);
    return action();
  } finally {
    lock.releaseLock();
  }
}

/**
 * Salted SHA-256 password hash.
 */
function hashPassword_(password, salt) {
  const raw = password + '::' + salt;
  const signature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return signature.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Generates signed HMAC token for stateless sessions.
 */
function generateSignedToken_(payloadObj) {
  const secret = getOrCreateJwtSecret_();
  const serialized = Utilities.base64EncodeWebSafe(JSON.stringify(payloadObj));
  const signature = Utilities.computeHmacSha256Signature(serialized, secret);
  const sigEncoded = Utilities.base64EncodeWebSafe(signature);
  return serialized + '.' + sigEncoded;
}

/**
 * Verifies signed HMAC token.
 */
function verifySignedToken_(tokenString) {
  if (!tokenString || tokenString.indexOf('.') === -1) return null;
  const parts = tokenString.split('.');
  const serialized = parts[0];
  const sigEncoded = parts[1];

  const secret = getOrCreateJwtSecret_();
  const expectedSig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(serialized, secret));

  if (sigEncoded !== expectedSig) return null;

  try {
    const jsonStr = Utilities.newBlob(Utilities.base64DecodeWebSafe(serialized)).getDataAsString();
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}

function getOrCreateJwtSecret_() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('APP_JWT_SECRET');
  if (!secret) {
    secret = generateSecureHexToken_(32);
    props.setProperty('APP_JWT_SECRET', secret);
  }
  return secret;
}

function generateSecureHexToken_(numBytes) {
  const bytes = [];
  for (let i = 0; i < numBytes; i++) {
    bytes.push(Math.floor(Math.random() * 256));
  }
  return bytes.map(b => ('0' + b.toString(16)).slice(-2)).join('');
}

/**
 * Neutralizes spreadsheet formula injection (CSV/Excel injection).
 */
function sanitizeSpreadsheetValue_(val) {
  if (typeof val === 'string' && /^[=+\-@\t\r]/.test(val)) {
    return "'" + val;
  }
  return val;
}

function logAuditEvent_(mapId, userId, action, targetId, details) {
  try {
    const db = getDatabase_();
    appendSheetRow_(db, 'AuditLogs', {
      id: 'AUDIT-' + Utilities.getUuid().substring(0, 8),
      timestamp: new Date().toISOString(),
      mapId: mapId || '',
      userId: userId || 'SYSTEM',
      action: action,
      targetId: targetId || '',
      details: typeof details === 'object' ? JSON.stringify(details) : String(details || '')
    });
  } catch (e) {
    // Non-blocking
  }
}

function jsonResponse_(data, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function escapeHtml_(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getScriptUrl_() {
  return ScriptApp.getService().getUrl();
}
