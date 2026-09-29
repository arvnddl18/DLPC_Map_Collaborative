# 2026-09-30 - Comprehensive Davao NAP Data Extraction and Streaming Parser Overhaul

## Context
When importing large telecom facility spreadsheets (e.g., `NAP Facility Summary Report-06-05-2026 14-39.csv`, 345MB, 314,537 rows), the import utility previously scanned only **5 records**. The user requested extracting all NAP data for Davao City and the greater Davao region.

## Root Cause Analysis
1. **Embedded Semicolons in Address Field**: In telecom facility summary reports, the address field contains internal semicolons (e.g., `"ZipCode: MIN; State: DAVAO DEL SUR; City: DAVAO CITY; Location: ...; Additional Address Information: ..."`). Naive splitting by `;` divided the address into 6 separate array items, causing all subsequent columns (Latitude, Longitude, Status, OLT ID, Ports) to shift out of position.
2. **Shifted Coordinates Yielded NaN**: Array index `cols[7]` became text like `" State: DAVAO DEL SUR"`, causing `parseFloat()` to return `NaN`. The coordinate validator dropped all records with addresses. Only 5 records in the entire 314,537-row file had completely empty addresses (`;;;`), which is why only 5 were parsed.
3. **Excel Trailing Commas & Wrapping Quotes**: Rows exported by Excel ended with hundreds of empty commas (`,,,,,,,,,`) and were wrapped in outer quotes, breaking strict regex delimiters.

## Solution & Architecture Changes
1. **Streaming Worker Parser (`src/client/js/napParserWorker.js`)**:
   - Implemented line cleaner removing trailing commas and unescaping outer quotes.
   - Designed pattern matcher detecting coordinate anchor `;(lat);(lng);` across all telecom summary rows.
   - Prefix extraction prior to coordinates captures Facility Name (`part[0]`), NAP ID (`part[1]`), Physical Status (`part[2]`), Location Type (`part[3]`), Building (`part[4]`), Floors (`part[5]`), and Address (`parts[6..]`).
   - Suffix extraction captures OLT ID, OLT Port, Total Capacity, and Available Ports.
   - Retained standard column-mapping fallback for arbitrary CSV formats and Excel spreadsheets (`parseXlsxFile`).
   - Expanded geographic envelope to Region XI bounds: `minLat: 5.35, maxLat: 8.00, minLng: 125.10, maxLng: 126.65`.
   - Built precise Davao City classifier: `isDavaoCityRecord(city, upperLine, lat, lng)` checking for Davao City address tags, coordinate box `[6.95, 7.35] / [125.35, 125.68]`, and excluding distinct Davao del Norte / Davao Oriental municipalities.

2. **Scope Filter Selector in Import Modal (`src/client/index.html`, `src/client/js/app.js`)**:
   - Added interactive radio filter allowing users to import either:
     - **All Davao Region**: **19,907 records** across Davao City, Davao del Sur, Davao del Norte, Davao de Oro, and Davao Oriental.
     - **Davao City Only**: **11,393 records** strictly inside Davao City limits.
   - Live preview table updates immediately on toggle.
   - Batch size increased to 2,500 records per HTTP request with live status countdown (`Syncing Database: X / Y...`).

3. **Backend Batch Sync Optimization (`server.js`)**:
   - Replaced O(N^2) array `.findIndex()` searches with an indexed `Map` (`global.napIndexMap`), executing batch upserts in single-digit milliseconds.

4. **Viewport-Aware Spatial Engine (`src/client/js/spatial.js`)**:
   - Added viewport-aware rendering when no route is active (zoom >= 13 renders up to 350 NAPs in the current view at 60 FPS).
   - Applied status color coding: Emerald (`#10b981`) for In Service, Blue (`#3b82f6`) for Planned, and Red (`#ef4444`) for Defective.

## Verification
- Verified end-to-end with Playwright automation against `NAP Facility Summary Report-06-05-2026 14-39.csv`:
  - 314,537 rows scanned in 6.2 seconds.
  - Successfully extracted **19,907 Davao Region records** and **11,393 Davao City records**.
  - Verified toggle between All Davao Region and Davao City Only.
  - Confirmed batch database sync and visual marker rendering on Leaflet map.
