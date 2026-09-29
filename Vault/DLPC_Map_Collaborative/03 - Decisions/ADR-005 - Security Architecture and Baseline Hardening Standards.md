# ADR-005: Security Architecture and Baseline Hardening Standards

## Status
Active (Verified)

## Date
2026-09-30

## Category
Architecture / Security

## Context
`DLPC_Map_Collaborative` is a collaborative spatial data and mapping platform for Davao Light and Power Company (DLPC). The platform visualizes critical utility infrastructure (transmission lines, distribution transformers, utility poles, substations, and customer service drop connections) and supports multi-user collaborative editing and spatial querying.

Given the mission-critical nature of electrical distribution mapping and utility asset security:
1. **Critical Infrastructure Protection**: Spatial data on power grids and substation assets must be protected against unauthorized disclosure, tampering, or exfiltration.
2. **Pre-Scaffolding Hardening**: Establishing zero-trust security controls, authorization boundaries, and secrets hygiene prior to application scaffolding prevents technical security debt and architectural vulnerabilities.
3. **OWASP Top 10 & CWE Alignment**: All upcoming frontend, backend API, geospatial database (PostGIS), and real-time collaboration (WebSockets) components must follow strict defense-in-depth controls.

## Decision

### 1. API Key & Secret Management
- **Zero Hardcoded Secrets**: No credentials, private keys, database passwords, or JWT secrets shall ever be committed to git.
- **Enterprise `.gitignore`**: All `.env*` files (except `.env.example`), private certificates (`*.pem`, `*.key`), database files (`*.sqlite`, `*.db`), and debug logs are strictly ignored.
- **Scoped Public Tokens**: Third-party mapping tokens (e.g., Mapbox public tokens) must be URL/domain-restricted to DLPC domains only and granted read-only tile rendering permissions.
- **Server-Side Secret Injection**: Production backend credentials (database passwords, GIS services, session keys) must be injected via runtime environment variables or KMS/secret managers.

### 2. Authentication & Role-Based Access Control (RBAC)
- **Token Architecture**:
  - Stateless Access Tokens (JWT) with short lifespan (15 minutes), signed using HMAC-SHA256 or RS256.
  - Refresh tokens stored with high-entropy random keys, stored in secure `HttpOnly; Secure; SameSite=Strict` cookies.
  - Refresh token rotation and instant revocation blacklist upon logout or privilege modification.
- **Role Hierarchy**:
  - `Viewer`: Read-only access to published public/internal network layers and basic search.
  - `Editor`: Draft feature edits, create asset change requests, stage updates (requires review/approval).
  - `Engineer`: Direct network editing, spatial analysis, circuit trace, asset status override, publish changes.
  - `Administrator`: Full system management, user role assignment, audit log inspection, system configuration.
- **Administrative Endpoint Enforcement**:
  - All admin endpoints (`/api/v1/admin/*`) require dual-factor validation and explicit `role === 'Administrator'` claims verified at the middleware layer.
  - Tenant and organization isolation (`org_id`) must be strictly enforced on every spatial query to prevent Insecure Direct Object References (IDOR).

### 3. API Security & CORS Policy
- **CORS Configuration**:
  - No wildcard `*` allowed when credentials/cookies are enabled.
  - Strict origin allowlist: Only explicitly authorized frontends (e.g., `http://localhost:3000`, `https://map.dlpc.com.ph`).
  - Allowed methods: Explicitly restricted to `GET, POST, PUT, PATCH, DELETE, OPTIONS`.
  - Allowed headers: Restricted to `Content-Type, Authorization, X-Requested-With, Idempotency-Key`.
- **Schema Validation**: Every endpoint must validate and sanitize request payloads using strict schema parsers (e.g., Zod) before business logic execution.

### 4. Input Validation, GeoJSON Sanitization & XSS Protections
- **Geospatial Payload Validation**:
  - All GeoJSON payloads (Points, LineStrings, Polygons) must validate geometry coordinates (valid WGS84 latitude [-90 to 90] and longitude [-180 to 180]).
  - Coordinate Bomb & DoS Mitigation: Impose strict limits on geometry vertex counts (maximum 10,000 vertices per polygon) and payload sizes (maximum 5MB per upload).
  - Bounding Box (BBOX) Verification: Validate that geometries fall within the geographic bounds of Davao Light's operational franchise.
- **Map Popup & Attribute XSS Prevention**:
  - Feature attributes and annotations displayed in map popups/tooltips must be HTML-escaped by default.
  - Rich text fields must undergo sanitization via `DOMPurify` before rendering.

### 5. Rate Limiting & Abuse Prevention
- **Tiered Rate Limiting**:
  - Authentication endpoints: 5 failed attempts per 15-minute window per IP.
  - Spatial Vector Tile endpoints (`/tiles/{z}/{x}/{y}`): 60 requests per second per IP with token bucket bursts.
  - REST API operations: 100 requests per minute per authenticated user.
  - WebSocket collaboration streams: 30 messages per second per client.

### 6. Database & Spatial Query Security
- **Strict Parameterization**:
  - All database queries (PostGIS / PostgreSQL) must use parameterized prepared statements.
  - Zero raw string concatenation inside spatial functions (e.g., `ST_GeomFromGeoJSON`, `ST_Intersects`, `ST_DWithin`).
- **Least-Privilege Database Roles**:
  - Application runtime connects with restricted spatial user permissions (no `SUPERUSER`, no DDL `DROP`/`ALTER` privileges during normal operation).
  - Heavy spatial queries and reporting routed to read-only database replicas.

### 7. HTTP Security Headers
All web server responses must include the following hardened headers:
```text
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(self), camera=(), microphone=()
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{RANDOM}'; worker-src 'self' blob:; child-src blob:; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://api.mapbox.com; connect-src 'self' https://*.dlpc.com.ph wss://*.dlpc.com.ph https://api.mapbox.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none';
```

### 8. Tooling & MCP Security Hardening
- **Pinned MCP Dependencies**: `@playwright/mcp` pinned to verified version `@playwright/mcp@0.0.83` to eliminate supply chain risks from unpinned `@latest` execution.
- **Isolated Browser Profiles**: `--isolated` flag enabled across all MCP configs to maintain browser sessions in memory without persisting sensitive tokens or cache to disk.
- **Automated Verification**: Dedicated `scripts/security-audit.ps1` automated check script added to `package.json` (`npm run security:audit`).

## Consequences

### Positive
- Preemptively eliminates OWASP Top 10 vulnerabilities (Injection, Broken Authentication, IDOR, Security Misconfiguration, Vulnerable Components) before code is scaffolded.
- Guarantees zero credential leaks through version control or Obsidian memory.
- Standardizes spatial validation rules (BBOX, coordinate limits) specific to Davao Light's operational grid.
- Hardens MCP and testing infrastructure against remote code execution and session persistence.

### Considerations / Trade-offs
- Strict CSP requires WebGL map rendering workers to use explicit `blob:` and `worker-src` allowances.
- Developers must maintain `.env` files locally from `.env.example`.

## Related Notes
- [[CORE_MEMORY]]
- [[CURRENT_STATE]]
- [[Security_Architecture_and_Hardening_Baseline]]
- [[Playwright_MCP_Browser_Automation_System]]
- [[ECC_Agent_Harness_System]]
