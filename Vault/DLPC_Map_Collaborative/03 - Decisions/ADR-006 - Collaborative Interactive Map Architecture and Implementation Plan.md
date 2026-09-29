# ADR-006: Collaborative Interactive Map Architecture and Implementation Plan

## Status
Approved / Active (2026-09-30)

## Context
Davao Light and Power Company (DLPC) requires a production-ready, interactive, and real-time collaborative mapping web application. The platform must be deployed using Google Apps Script (GAS) as its primary backend, supporting:
1. Multi-role authentication (Admin, Editor, Viewer)
2. Cryptographic view-only and edit-access share links (revocable, expiratory)
3. Road-aligned routing following street networks with coordinate input & address reverse geocoding
4. Editable operational addresses preserving geocoded addresses
5. Dynamic tagging and filtering
6. Canva/Figma-style vector and freehand drawing tools on map canvas
7. Real-time multi-user collaboration with live collaborator cursors and live object sync
8. Concurrent edit safeguards (optimistic locking, version vectors, conflict detection)
9. High-performance NAP Excel/CSV importation (supporting 300MB+ / 314,000+ row datasets) with client-side streaming and strict Davao North & Davao South geographic filtering
10. Spatial proximity calculation (25m threshold) to dynamically reveal relevant NAPs along route polylines
11. Clean GIS layer management and audit logging

## Evaluated Alternatives for Technical Constraints

### 1. Real-Time Collaboration & Live Cursors
- **Option A (Pure GAS Polling):** Clients poll GAS `doGet` every 1-2 seconds.
  - *Cons:* GAS execution latency is 800ms-2000ms. High concurrent polling rapidly exhausts Google Workspace quotas (`Service invoked too many times`). Cursors cannot achieve 60fps smooth interpolation.
- **Option B (Firebase Realtime Database / Firestore pairing - RECOMMENDED):**
  - *Pros:* Native Google Cloud ecosystem service. Sub-100ms WebSocket synchronization, built-in presence detection (`.info/connected`, `onDisconnect()`), zero-quota impact on GAS, free tier covers thousands of concurrent connections.
  - *Resilience:* We pair this with a graceful **Hybrid Fallback Engine** in pure GAS (adaptive ETag polling at 3s intervals) so the application functions 100% out of the box even before Firebase credentials are configured.

### 2. Road Routing and Geocoding
- **Pluggable Multi-Provider Architecture:**
  - **OSRM (Open Source Routing Machine) + Nominatim:** Free, zero API key required, excellent Davao street network coverage, open-source fallback.
  - **Google Maps Platform (Directions API + Geocoding API):** Enterprise tier, switchable via configuration.
  - Keys stored in GAS `ScriptProperties` or secure environment, never exposed in client source.

### 3. Large Dataset NAP Import (345MB CSV / 314,000+ rows)
- **Server-Side GAS Upload:** GAS request body limit is 50MB and execution timeout is 6 minutes. A 345MB file upload will fail immediately.
- **Client-Side Streaming with Web Worker & IndexedDB (CHOSEN):**
  - PapaParse stream parsing in browser Web Worker.
  - Instant row-by-row filtering: strictly retains rows where region/city/location matches "Davao South", "Davao North", "Davao City", "Davao del Sur", "Davao del Norte", or coordinates fall within the Davao bounding box (`[6.7, 7.6]`, `[125.2, 126.3]`).
  - Drops 96% of irrelevant data in seconds without main-thread UI freezing.
  - Fast client-side IndexedDB spatial cache with batch synchronization to backend.

### 4. Spatial Proximity Algorithm
- **Broad Phase:** Axis-Aligned Bounding Box (AABB) envelope filtering around route polylines expanded by the proximity threshold ($\epsilon = 25\text{m}$).
- **Narrow Phase:** Point-to-segment minimum perpendicular distance using equirectangular / Haversine geodesics.

## Consequences
- Clean separation of concerns: GAS manages persistent storage (Google Sheets / Drive / Properties), token issuance, authentication, and security authorization.
- Firebase RTDB / Local Hybrid provides instant real-time collaboration.
- Leaflet / MapLibre with OpenStreetMap / Google Maps tiles provides high-performance vector rendering.
