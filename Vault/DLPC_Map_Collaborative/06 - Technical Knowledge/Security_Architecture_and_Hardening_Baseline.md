# Security Architecture & Hardening Baseline

Status: VERIFIED (Active)
Last Updated: 2026-09-30
Related: [[CORE_MEMORY]], [[CURRENT_STATE]], [[ADR-005 - Security Architecture and Baseline Hardening Standards]]

---

## 1. Overview & Threat Model

`DLPC_Map_Collaborative` handles spatial asset tracking and collaborative grid mapping for Davao Light and Power Company. Utility mapping systems present unique security considerations:
- **Spatial Asset Confidentiality**: Network topologies, transformer ratings, substation coordinates, and circuit diagrams constitute critical infrastructure assets.
- **Collaborative Integrity**: Simultaneous multi-user editing must prevent malicious or erroneous geometric distortions, phantom assets, or unauthorized circuit switching statuses.
- **Denial of Service Resistance**: Spatial queries (`ST_Intersects`, topological network traces) are computationally intensive; unchecked spatial bounding boxes or unbounded polyline uploads can trigger server exhaustion.

---

## 2. Hardened Workspace Baseline

| Security Domain | Implemented Control | File / Target | Status |
| :--- | :--- | :--- | :--- |
| **Secrets & Keys** | Zero hardcoded tokens; secret scanning across 581 files | Entire Workspace | **PASS** |
| **Version Control** | Enterprise `.gitignore` blocking `.env*`, `*.pem`, `*.key`, `*.sqlite`, `logs/`, `node_modules` | `.gitignore` | **PASS** |
| **Env Templates** | Sanitized `.env.example` with structured schema and safe placeholders | `.env.example` | **PASS** |
| **Package Hygiene** | `private: true` set to block accidental npm registry exposure | `package.json` | **PASS** |
| **MCP Hardening** | Pinned `@playwright/mcp@0.0.83` + `--isolated` memory-only browser profile | `mcp_config.json`, `.vscode/mcp.json`, `.agents/mcp_config.json`, Global config | **PASS** |
| **Dependency Audit** | `npm audit` executed with 0 vulnerabilities detected | `package-lock.json` | **PASS** |
| **Vault Hygiene** | 25 Obsidian vault notes audited with 0 credential leaks | `Vault/DLPC_Map_Collaborative/` | **PASS** |
| **Automated Verification** | Dedicated test script `scripts/security-audit.ps1` with 9 automated checks | `scripts/security-audit.ps1` | **PASS** |

---

## 3. Geospatial Security Controls (PostGIS & MapLibre)

### 3.1 Spatial SQL Injection Prevention
Never concatenate bounding boxes or coordinates into raw SQL queries. Always bind spatial parameters:
```typescript
// SECURE: Parameterized spatial query with explicit coordinate binding
const assets = await db.query(
  `SELECT id, asset_name, asset_type, ST_AsGeoJSON(geom) as geometry
   FROM dlpc_network_assets
   WHERE org_id = $1
     AND ST_Intersects(geom, ST_MakeEnvelope($2, $3, $4, $5, 4326))`,
  [orgId, minX, minY, maxX, maxY]
);
```

### 3.2 Coordinate Sanitization & Bounding Box Constraints
- **Franchise Validation**: Davao Light operates within Davao City and surrounding municipalities in Davao del Norte. Geometries with coordinates outside the operational franchise bounding box (Latitude: `6.8` to `7.6`, Longitude: `125.2` to `125.8`) must be rejected or flagged for verification.
- **Vertex Flooding Defense**: Polygons or polylines with more than 10,000 vertices must be simplified (`ST_SimplifyPreserveTopology`) or rejected to prevent geometry calculation exhaustion attacks.

### 3.3 Map Popup XSS Prevention
Feature properties (e.g., substation inspection notes, line crew tags) often contain dynamic user text. Before rendering in map popups:
```typescript
import DOMPurify from 'dompurify';

export function renderPopupContent(properties: Record<string, any>): string {
  const safeNotes = DOMPurify.sanitize(properties.notes || '');
  const safeName = DOMPurify.sanitize(properties.asset_name || '');
  return `<div class="asset-popup">
    <h4>${safeName}</h4>
    <p>${safeNotes}</p>
  </div>`;
}
```

---

## 4. Role-Based Access Control (RBAC) Matrix

| Operation / Feature | Viewer | Editor | Engineer | Administrator |
| :--- | :---: | :---: | :---: | :---: |
| View Public / Published Map Layers | YES | YES | YES | YES |
| Spatial Search & BBOX Query | YES | YES | YES | YES |
| Draft Asset Updates / Redlines | NO | YES | YES | YES |
| Publish Changes to Live Power Grid Layer | NO | NO | YES | YES |
| Run Circuit Tracing & Capacity Analysis | NO | NO | YES | YES |
| Manage User Roles & Permissions | NO | NO | NO | YES |
| Inspect Security & Audit Logs | NO | NO | NO | YES |
| System Configuration & API Keys | NO | NO | NO | YES |

---

## 5. Security Headers Standard

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(self), camera=(), microphone=()
Content-Security-Policy: default-src 'self'; script-src 'self'; worker-src 'self' blob:; child-src blob:; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://api.mapbox.com; connect-src 'self' https://*.dlpc.com.ph wss://*.dlpc.com.ph https://api.mapbox.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none';
```

---

## 6. Automated Audit Execution

To run the full automated security audit at any time:
```powershell
npm run security:audit
```
Or directly via PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\security-audit.ps1
```
