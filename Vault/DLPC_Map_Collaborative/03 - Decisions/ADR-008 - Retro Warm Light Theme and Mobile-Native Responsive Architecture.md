# ADR-008: Retro Warm Light Theme and Mobile-Native Responsive Architecture

## Status
Accepted (2026-09-30)

## Context
1. **Thematic Motivation**:
   The application previously defaulted to a dark interface, which is traditional for Network Operations Centers (NOCs) and low-light control rooms. However, field utility personnel, municipal planners, and Davao Light engineering teams frequently operate outdoors, on mobile tablets/phones, or in brightly lit offices. In these environments, dark themes cause severe glare and eye fatigue.
   Furthermore, cartographic tradition has long favored warm parchment, sepia ink, and natural mineral pigments (ochre, amber, raw sienna) for maximum spatial readability, high-contrast contour discernment, and aesthetic timelessness.

2. **Mobile Ergonomics**:
   Desktop CAD/GIS software often translates poorly to mobile viewports (e.g., squished multi-column grids, missing map tiles due to grid column placement issues, tiny desktop buttons, unclickable toolbars, and crowded headers). A mobile-first, native-feel responsive layout is required to make field GIS operations fluid and intuitive on smartphones (390px–430px viewports).

## Decisions

### 1. Retro Warm Light Design System
- **Color Palette**:
  - Background Base: Warm parchment cream (`#faf6ef`), elevated surface cream (`#fff9f0`), warm hover tint (`#f5ede0`).
  - Text & Ink: Deep espresso ink (`#2c1a08`), warm sepia body (`#6b4a26`), muted acorn (`#a07850`).
  - Borders: Sepia-tinted translucent lines (`rgba(120, 80, 30, 0.10)` subtle, `0.20` medium).
  - Primary Accent: Rich amber/raw sienna (`#b45309`, hover `#92400e`), glowing amber rings (`rgba(180, 83, 9, 0.18)`).
  - Elevation & Shadows: Sepia-cast multi-layer shadows (`rgba(80, 40, 10, 0.12–0.28)`) instead of artificial cold black.
- **Cartographic Map Tone**:
  - Filter applied to `.leaflet-tile-pane`: `sepia(12%) saturate(108%) contrast(98%)`.
  - Harmonizes OpenStreetMap standard tiles with the surrounding parchment chrome without degrading road or water legibility.
- **Typography Hierarchy**:
  - Display & Brand: `Fraunces` (warm vintage optical serif) for logos, panel headers, and modal titles.
  - Interface Body: `Outfit` (clean geometric sans) for legibility at small sizes.
  - Coordinate Readouts & Telemetry: `JetBrains Mono` for non-proportional tabular numbers.

### 2. Mobile-Native Responsive Architecture (`max-width: 768px`)
- **Full-Bleed Grid Layout**:
  - `#app-container` transitions from 2-column desktop grid to single-column full-bleed layout: `grid-template-rows: 52px 1fr`.
  - `#map-viewport` explicitly occupies `grid-column: 1 / -1; grid-row: 2 / 3; width: 100%; height: 100%`.
  - Leaflet Map Engine listens to `window.resize` and triggers `invalidateSize()` to prevent tile blanking during viewport orientation shifts.
- **Compact Native Header**:
  - 52px height with notch safe-area consideration.
  - Redundant desktop map title hidden to preserve space.
  - Compact fluid search pill (`height: 32px; border-radius: var(--radius-full)`).
  - Compact collaborator bubbles (`26px`) and circular icon-only Share button (`32px`).
- **Floating Bottom Action Dock**:
  - Replaces desktop vertical left toolbar with a floating bottom pill dock above the iOS safe area: `bottom: max(14px, env(safe-area-inset-bottom, 14px))`.
  - Frosted glass backdrop blur (`rgba(250, 246, 239, 0.88)` + `backdrop-filter: blur(20px)`).
  - Horizontal scroll container with momentum scrolling (`-webkit-overflow-scrolling: touch`) and hidden scrollbar.
  - Touch targets calibrated to 40px–44px with scale active feedback (`scale(0.92)`).
  - Tooltips disabled on touch viewports to eliminate sticky hover states.
- **Context Inspector as Mobile Bottom Sheet**:
  - `#right-panel` transforms from desktop right drawer into an iOS-style slide-up bottom sheet (`max-height: 72dvh; border-radius: 20px 20px 0 0`).
  - Tactile drag handle affordance at top.
  - Spring-eased entrance (`translateY(0)` with `cubic-bezier(0.32, 0.72, 0, 1)`).
- **Status Bar Optimization**:
  - Bulky desktop coordinate status bar hidden on mobile to prioritize map interaction surface area.

## Consequences
- **Positive**:
  - Outdoor readability dramatically improved in sunlight and high-glare environments.
  - Consistent visual identity aligned with high-craft cartography and DLPC heritage.
  - Mobile user experience feels like a native iOS/Android application rather than a shrunk desktop site.
  - Desktop functionality remains 100% intact, pixel-perfect, and seamlessly switchable.
- **Trade-offs**:
  - Coordinate readout is hidden on mobile to preserve screen space (coordinates remain accessible via inspector and object selection).
