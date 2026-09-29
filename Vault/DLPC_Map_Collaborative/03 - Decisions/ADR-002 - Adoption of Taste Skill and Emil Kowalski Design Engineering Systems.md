# ADR-002: Adoption of Taste Skill and Emil Kowalski Design Engineering Systems

## Current
The project system adopts two core UI/UX and animation frameworks integrated directly into `.agents/skills/` and the persistent Obsidian Memory layer:
1. **Taste Skill (v2)** (`design-taste-frontend` by Leonxlnx): Enforces anti-slop visual frontend engineering, contextual brief inference, the Three Dials configuration (`DESIGN_VARIANCE`, `MOTION_INTENSITY`, `VISUAL_DENSITY`), design-system mappings, typography hierarchy, and anti-repetition discipline.
2. **Emil Kowalski Design Engineering & Animation System** (`emil-design-eng`, `animate`, etc. by Emil Kowalski): Enforces craft standards, the Animation Decision Framework, hardware-accelerated transforms (`transform` & `opacity` only), easing curve selection, micro-interaction polish, mobile-native fixes, and markdown table review formats (`| Before | After | Why |`).

## Previous
Default AI code generation tendencies, which commonly generate generic "AI slop":
- Symmetrical 3-column card layouts with generic purple/violet mesh gradients.
- Sluggish or incorrect animation easing (`ease-in` for entrances, 400ms+ dropdown transitions, `scale(0)` animations).
- Animating high-frequency keyboard interactions (e.g. command menus, shortcuts) that must remain instant.
- Non-hardware-accelerated CSS properties (`width`, `height`, `top`, `left`, `margin`).
- Generic typography combinations (e.g. Inter + Slate-900) without typographic hierarchy or personality.

## Reason for Change / Rationale
`DLPC_Map_Collaborative` is a geospatial data and collaborative mapping application for Davao Light and Power Company. Spatial applications demand:
1. **High Visual Clarity & Information Density**: Map overlays, spatial layers, inspection panels, and collaborative indicators must feel crisp, airy, or data-dense depending on the view, without generic marketing fluff.
2. **Snappy, Hardware-Accelerated Performance**: Maps and GIS vector layers already stress GPU and main thread resources. UI animations must never drop frames, trigger layout reflows, or lag touch gestures on mobile devices.
3. **Professional Craft Aesthetic**: A mission-critical utility platform must convey trust, precision, and state-of-the-art software craft rather than looking like an unstyled AI prototype.

## Implementation Scope
- Installed 26 new skill runbooks into `.agents/skills/` covering frontend taste, animation recipes, mobile-native fixes, UI audits, and component prototyping.
- Established persistent design and animation preferences in `05 - User Preferences/UI_UX_Design_And_Motion_Preferences.md`.
- Consolidated technical reference guides in `06 - Technical Knowledge/`.
- Updated Core Memory index (`00 - Core Memory/CORE_MEMORY.md`) and Current State (`09 - Current State/CURRENT_STATE.md`).

## Status
Active

## Date
2026-09-29

## Related Notes
- [[CORE_MEMORY]]
- [[UI_UX_Design_And_Motion_Preferences]]
- [[Taste_Skill_Anti_Slop_Frontend_System]]
- [[Emil_Kowalski_Design_Engineering_And_Motion_System]]
- [[Agent_Skills_Catalog]]
