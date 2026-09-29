# ADR-007: Live Real-Time Collaborative Drawing Synchronization Engine

## Status
Accepted (2026-09-30)

## Context
DLPC (Davao Light and Power Company) electrical and telecom distribution planning requires simultaneous, multi-engineer collaborative map editing. When one network engineer draws an infrastructure route, feeder boundary, or fiber splice polygon, other engineers on different machines and browsers must observe the vector changes at live speed with near-zero latency (<50ms delay).

Previously, vector drawings were only broadcast upon `mouseup` completion, and collaboration across separate browsers relied on HTTP polling fallback or intra-browser `BroadcastChannel`, which did not support network-wide real-time collaboration.

## Decision
1. **WebSocket Collaborative Server Core**:
   - Integrated `ws.WebSocketServer` directly onto the Node.js server engine in `server.js`.
   - Partitioned room synchronization by `mapId` (e.g. `MAP-DAVAO01`).
   - Ultra-low latency bi-directional event distribution broadcasting to all active peers with sub-millisecond dispatch.

2. **Dual-Transport Hybrid Synchronization**:
   - **Network Real-Time Layer**: Full WebSocket connection (`ws://` / `wss://`) connecting multi-user, multi-device clients.
   - **Local Tab Fast Path**: Cross-tab `BroadcastChannel` for zero-latency local tab synchronization.
   - **GAS Fallback**: Adaptive background polling with server database reconciliation for serverless deployment.
   - **Message De-Duplication**: Bounded LRU message tracking via `msgId = ${sessionId}_${counter}` preventing duplicate execution across dual transports.

3. **Streamed In-Progress Live Stroke Engine**:
   - `DRAWING_LIVE_START`: Dispatched on `mousedown` with unique `strokeId`, tool type, origin coordinate, style, and drawer metadata.
   - `DRAWING_LIVE_UPDATE`: Throttled at 25ms (40 FPS) streaming intermediate points (freehand), endpoints (line/arrow), bounding boxes (rectangle), or radius (circle).
   - `DRAWING_LIVE_END`: Dispatched on `mouseup` with finalized vector geometry, smoothly transitioning remote preview layers to permanent canvas layers with 0ms visual flicker.
   - `DRAWING_LIVE_CANCEL`: Purges ghost layers upon aborted drawing or empty strokes.

4. **Live Translation for Interactive Move Tool**:
   - `DRAWING_MOVE_LIVE`: Streams continuous coordinate deltas (`deltaLat`, `deltaLng`) at 25ms intervals as an object is dragged across the map, rendering real-time translations on remote peers before committing final position.

5. **Enhanced Collaborator Cursors & Presence**:
   - Cursors throttled at 30ms with CSS `transform: translate3d(...)` hardware acceleration and 30ms linear interpolation.
   - Dynamic cursor badges indicating active tool (e.g. `✏️ Pen`, `⬜ Rect`, `↔️ Move`, `📍 Pin`) and live status tag (`✏️ Drawing...`).

6. **Self-Healing and Watchdog Resilience**:
   - 6-second watchdog timers per remote live stroke automatically purge abandoned ghost layers if an author unexpectedly disconnects.
   - Auto-reconnection loop with exponential backoff (1s -> 2s -> 4s -> max 10s) and visual connection status indicators (`connected`, `reconnecting`, `offline`).

## Consequences
- **Positive**: True live collaborative drawing experience; network engineers observe remote drawings emerging in real time with imperceptible delay.
- **Positive**: Zero layer duplication through idempotent ID keys and stream lifecycles.
- **Positive**: Resilient across network disconnects, server restarts, and multi-browser setups.
- **Negative / Operational**: Requires WebSocket support on backend host; in pure standalone Google Apps Script without external relay, falls back gracefully to adaptive polling.

## Compliance & Security
- All incoming collaborator names and attributes are sanitized with HTML entity encoding (`escapeHtml`).
- Coordinate payloads are strictly validated against numeric types.
