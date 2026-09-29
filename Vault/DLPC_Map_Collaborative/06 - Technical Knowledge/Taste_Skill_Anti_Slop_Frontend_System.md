# Taste Skill: Anti-Slop Frontend System

This note documents the architecture, principles, and execution guidelines of the **Taste Skill** (v2 by Leonxlnx, install name: `design-taste-frontend`), located at `.agents/skills/taste-skill/SKILL.md`.

---

## 1. System Overview

Taste Skill provides agents with high-craft frontend design guidelines to eliminate "AI slop" (bland, repetitive, cookie-cutter layouts). It is framework-agnostic (React, Svelte, Vue, or Vanilla CSS) and enforces disciplined visual thinking.

### Core Pipeline
```text
Brief Inference (Read the Room) → Calibrate Three Dials → Select Design System Foundation → Apply Anti-Slop Layout & Typography → Motion Skeletons → Strict Pre-Flight Audit
```

---

## 2. Brief Inference (Read the Room)

Before generating any code, identify the operational context:
1. **Page kind**: Landing, dashboard, spatial tool, portal, portfolio, or redesign.
2. **Audience**: Enterprise utility engineers, procurement, GIS analysts, field operators.
3. **Quiet constraints**: High contrast for sunlight readability, accessibility, data density, low-latency rendering.

### Output Standard
Always output a single-line **Design Read**:
```text
Reading this as: [page kind] for [audience], with a [vibe] language, leaning toward [design system / aesthetic family].
```

---

## 3. The Three Dials

Global configuration variables controlling generation:

| Dial | Range | Baseline | High Value Meaning | Low Value Meaning |
| :--- | :---: | :---: | :--- | :--- |
| **`DESIGN_VARIANCE`** | 1 – 10 | `8` (landing) / `5` (app) | Asymmetrical, editorial, artful | Structured, symmetrical, strict grid |
| **`MOTION_INTENSITY`** | 1 – 10 | `6` (web) / `3` (app) | Scroll scrubbers, physics, expressive | Fast subtle fades or static only |
| **`VISUAL_DENSITY`** | 1 – 10 | `4` (landing) / `7` (map UI) | Cockpit, telemetry, compact data | Spacious, airy, gallery-like |

### Presets for DLPC_Map_Collaborative
- **Main Map Workspace / Layer Panel**: `DESIGN_VARIANCE: 4`, `MOTION_INTENSITY: 2`, `VISUAL_DENSITY: 8`
- **Analytics & Report Dashboard**: `DESIGN_VARIANCE: 5`, `MOTION_INTENSITY: 3`, `VISUAL_DENSITY: 7`
- **Public Portal / Overview Landing**: `DESIGN_VARIANCE: 7`, `MOTION_INTENSITY: 5`, `VISUAL_DENSITY: 4`

---

## 4. Design System Selection Matrix

| Brief Context | Foundation | Rationale |
| :--- | :--- | :--- |
| Enterprise / Data-Dense / Operations | Fluent UI (`@fluentui/react-components`) or Carbon (`@carbon/react`) | Built for mission-critical enterprise workflows |
| Modern Modular App / Bespoke Map UI | Tailwind v4 + shadcn/ui + Radix UI | Full ownership of components; lightweight DOM |
| Developer / Technical Tool | Primer (`@primer/css`) or Geist | Crisp, high-information dev tool aesthetic |
| Public Information Portal | USWDS or Gov style guidelines | High trust, high accessibility |

---

## 5. Anti-Slop Execution Rules

1. **Grid Asymmetry**: Avoid identical 3-card rows. Use offset grids (e.g. 5:7, 8:4, bento grids with deliberate primary focal point).
2. **Typography Discipline**:
   - Primary display font (distinct personality) + secondary ultra-legible body font + monospace font for coordinates/telemetry.
   - Use strict typographic scale (`clamp(...)` for fluid headings).
3. **Color Rhythms**:
   - Define purposeful dark and light modes with nuanced contrast steps (avoid flat `#000000` or raw `#ffffff` with high saturated neon borders).
   - Use semantic color tokens: surface, surface-elevated, border-subtle, text-primary, text-secondary.
4. **Copywriting Cleanliness**:
   - Zero em-dashes (`—`). Em-dashes in AI copy are an immediate tell of unedited LLM generation.
   - Use sentence casing for headings when appropriate.

---

## 6. Associated Specialized Skills in Workspace

| Skill Folder | Install Name | Scope |
| :--- | :--- | :--- |
| `taste-skill/` | `design-taste-frontend` | Main v2 anti-slop skill for greenfield and redesign |
| `minimalist-skill/` | `minimalist-ui` | Editorial, Linear-style, calm monochromatic UI |
| `soft-skill/` | `high-end-visual-design` | Soft contrast, luxury whitespace, spring physics |
| `brutalist-skill/` | `industrial-brutalist-ui` | High-contrast industrial UI, technical precision |
| `redesign-skill/` | `redesign-existing-projects` | Audit-first workflow for upgrading existing codebases |
| `gpt-tasteskill/` | `gpt-taste` | Strict layout variance and anti-slop rules |
| `output-skill/` | `full-output-enforcement` | Prevents models from truncating code with placeholders |
| `image-to-code-skill/` | `image-to-code` | Reference image → analyze → code pipeline |
| `brandkit/` | `brandkit` | Visual brand-kit boards |
| `imagegen-frontend-web/` | `imagegen-frontend-web` | Web visual reference mockups |
| `imagegen-frontend-mobile/`| `imagegen-frontend-mobile`| Mobile layout reference mockups |

---

## Related Notes
- [[UI_UX_Design_And_Motion_Preferences]]
- [[Emil_Kowalski_Design_Engineering_And_Motion_System]]
- [[Agent_Skills_Catalog]]
- [[ADR-002 - Adoption of Taste Skill and Emil Kowalski Design Engineering Systems]]
