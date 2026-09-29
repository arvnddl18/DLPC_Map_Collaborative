# Core Memory

## Project
- Name: DLPC_Map_Collaborative
- Purpose: Collaborative mapping and spatial data platform for Davao Light and Power Company (DLPC)
- Current objective: Initial environment setup, memory vault initialization, and requirements definition

## Current State
- Active feature: Collaborative Map Architecture & Production Implementation
- Current development phase: Phase 1 (Audit) & Phase 2 (Architecture Plan) Complete -> Phase 3-14 Implementation
- Important blockers: None

## Technology
- Frontend: HTML5 / Modern ES6+ / Scoped Vanilla CSS / Leaflet & MapLibre GIS / PapaParse & SheetJS Streaming Worker
- Backend: Google Apps Script Web App (doGet/doPost), LockService, PropertiesService, Utilities HMAC
- Database: Google Sheets (structured relational tabs) + IndexedDB client spatial cache
- Infrastructure: Google Apps Script Web App + Firebase Realtime Database (with GAS Hybrid Fallback)
- GIS & Routing: OSRM Road Routing + OSM Nominatim Geocoding + Google Maps Platform (optional pluggable)

## Architecture
- Key architectural decisions:
  - [[Obsidian Memory Architecture]]: External vault in `Vault/DLPC_Map_Collaborative` acts as persistent long-term cognitive context and memory graph
  - [[ADR-006 - Collaborative Interactive Map Architecture and Implementation Plan]]: Realtime collaboration via Firebase RTDB + GAS hybrid fallback, streaming client CSV/XLSX filter for Davao North/South, AABB broad-phase spatial proximity engine.
- Important modules: GAS Controller, Frontend GIS Map Canvas, Realtime Sync Manager, Streaming NAP Parser Worker, Canva Drawing Engine

## Permanent Constraints
- Repository source code is authoritative; never allow Obsidian memory to override verified source code
- Never store secrets, passwords, or credentials in memory files
- Keep Core Memory compact as a high-level index, not a full transcript

## Important User Preferences
- Autonomous memory management: extract, connect, retrieve, and refine memory silently
- Progressive memory refinement: update and consolidate existing notes instead of creating duplicates
- Anti-slop frontend design (Taste Skill): Brief inference before coding, calibrated Three Dials (`DESIGN_VARIANCE`, `MOTION_INTENSITY`, `VISUAL_DENSITY`), anti-repetition discipline, no generic purple gradient slop
- Emil Kowalski motion & craft standards: Animation Decision Framework (never animate 100+/day keyboard actions), `transform` and `opacity` only, enter on `ease-out`, table review format (`| Before | After | Why |`)

## Critical Decisions
- [[Obsidian Memory Architecture]] (Active, 2026-09-29)
- [[ADR-002 - Adoption of Taste Skill and Emil Kowalski Design Engineering Systems]] (Active, 2026-09-29)
- [[ADR-003 - Adoption of ECC Everything Claude Code System]] (Active, 2026-09-29)
- [[ADR-004 - Implementation of Playwright MCP Browser Automation Server]] (Active, 2026-09-30)
- [[ADR-005 - Security Architecture and Baseline Hardening Standards]] (Active, 2026-09-30)
- [[ADR-006 - Collaborative Interactive Map Architecture and Implementation Plan]] (Active, 2026-09-30)
- [[ADR-007 - Live Real-Time Collaborative Drawing Synchronization Engine]] (Active, 2026-09-30)
- [[ADR-008 - Retro Warm Light Theme and Mobile-Native Responsive Architecture]] (Active, 2026-09-30)

## Active Problems
- None

## Important Memory References
- [[CURRENT_STATE]]
- [[PROJECT_OVERVIEW]]
- [[Realtime_Collaborative_Drawing_Engine]]
- [[UI_UX_Design_And_Motion_Preferences]]
- [[Taste_Skill_Anti_Slop_Frontend_System]]
- [[Emil_Kowalski_Design_Engineering_And_Motion_System]]
- [[ECC_Agent_Harness_System]]
- [[Playwright_MCP_Browser_Automation_System]]
- [[Security_Architecture_and_Hardening_Baseline]]
- [[Agent_Skills_Catalog]]

