# UI/UX Design & Motion Preferences

This document records the user and project conventions for visual design, layout architecture, animation performance, and interaction review in **DLPC_Map_Collaborative**.

---

## 1. Core Operating Philosophy

1. **Taste is Trained & Intentional**: Do not rely on default LLM aesthetics. Every design must read the room first (audience, utility context, data density, brand tone).
2. **Unseen Details Compound**: High-craft software feels great because hundreds of invisible details are correct: no tap highlights on mobile, no sticky hover states on touchscreens, no layout thrashing during animations.
3. **Utility & Beauty as Leverage**: For a utility company mapping tool, beauty means absolute clarity, crisp typographic hierarchy, snappy response times, and intentional feedback.

---

## 2. Taste Skill Anti-Slop Rules

Source: `.agents/skills/taste-skill/SKILL.md` (`design-taste-frontend`)

### 2.1 The "Design Read" Protocol
Before generating any visual layout or component code, output a one-line Design Read:
> *"Reading this as: <page kind> for <audience>, with a <vibe> language, leaning toward <design system or aesthetic family>."*

### 2.2 The Three Dials
Always calibrate decisions against the three dials:
- **`DESIGN_VARIANCE` (1–10)**: Baseline `8` for landing/promotional, `5-6` for clean utility/dashboards.
- **`MOTION_INTENSITY` (1–10)**: Baseline `6` for general web, `3-4` for dense map controls/dashboards.
- **`VISUAL_DENSITY` (1–10)**: Baseline `4` for web apps, `6-8` for map inspector toolbars and GIS telemetry panels.

### 2.3 Strict Anti-Slop Constraints
- **Ban on Generic Defaults**: Never use AI-purple gradient meshes, three identical cards with icons in colored circles, or default Inter + slate-900 combinations.
- **Copywriting**: Absolute ban on em-dashes (`—`) in UI copy. Use short, punchy phrases and active verbs.
- **Typography**: Select paired display and monospace/sans families tailored to maps and engineering data (e.g., JetBrains Mono, Geist, Space Grotesk, Plus Jakarta Sans).

---

## 3. Emil Kowalski Animation Decision Framework

Source: `.agents/skills/emil-design-eng/SKILL.md` & `.agents/skills/animate/SKILL.md`

### 3.1 The 4-Question Gate (Before Writing Motion Code)
1. **Should this animate at all?**
   - **100+ times/day** (keyboard shortcuts, quick map tool switches, command palette): **NO animation. Ever.** Instant state changes only.
   - **Tens of times/day** (hover states, layer toggles): Near-imperceptible, fast (100–150ms).
   - **Occasional** (modals, slide-out attribute drawers, toasts): Standard motion (200–300ms).
   - **Rare/First-time** (onboarding, initial map load): Delight budget allowed.
2. **What is the purpose?**
   - Must be one of: *Feedback*, *Spatial consistency*, *State indication*, *Preventing jarring change*, *Explanation*, or *Delight*.
3. **What is the cheapest tool that works?**
   - CSS transitions → `@starting-style` → CSS animations (off-main-thread) → WAAPI → Motion (`motion.dev`).
4. **Hardware acceleration only:**
   - Animate `transform` and `opacity` only.
   - **Never** animate `width`, `height`, `top`, `left`, `margin`, or `padding` (except height on accordions if unavoidable).
   - **Never `scale(0)`**: always enter from `scale(0.92–0.97)` + `opacity: 0`.

### 3.2 Easing & Duration Standards
- **Enter transitions**: Must use `ease-out` (starts fast, feels immediate to user input).
- **Exit transitions**: Fast `ease-in` or quick `ease-out`.
- **Moving on screen**: `ease-in-out` or tuned physics springs.
- **Transform-Origin**: Set `transform-origin` at the trigger for popovers and menus. Modals remain centered.
- **Motion library syntax**: Always write `transform: "translateX(...)"` in Motion to ensure hardware acceleration, avoiding `x: ...` shorthands that drop frames under CPU load.

---

## 4. UI Review Format Standard

When reviewing UI, animation, or frontend styling code, always format the critique as a single markdown table:

| Before | After | Why |
| :--- | :--- | :--- |
| `transition: all 300ms` | `transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1)` | Specify exact properties; avoid expensive reflow `all` |
| `transform: scale(0)` | `transform: scale(0.95); opacity: 0` | Physical objects do not appear from zero |
| `ease-in` on dropdown | `cubic-bezier(0.16, 1, 0.3, 1)` | `ease-in` feels sluggish on user-initiated menus |

---

## 5. UI Libraries & Dependencies Standard

Source: `.agents/skills/pick-ui-library/SKILL.md`

- **Toasts & Notifications**: [Sonner](https://sonner.emilkowal.ski) (`ask-sonner`)
- **Accessible Primitives**: Radix UI / Base UI
- **Drawers / Bottom Sheets**: Vaul
- **Command Menu**: cmdk
- **Spring & Gestures**: Motion (`motion.dev`)

---

## 6. Retro Warm Light & Mobile-Native Architecture

### 6.1 Theme Directives (Retro Warm Light)
- **Palette**: Warm parchment base (`#faf6ef`), cream card surface (`#fff9f0`), amber/raw sienna accent (`#b45309`), deep espresso ink (`#2c1a08`).
- **Cartographic Blend**: Filter applied to `.leaflet-tile-pane`: `sepia(12%) saturate(108%) contrast(98%)` for harmonious vintage atlas aesthetic.
- **Typography Pairing**:
  - `Fraunces` (optical serif): Brand badges, modal headers, inspector panel titles.
  - `Outfit` (clean geometric sans): General UI controls, labels, buttons, form elements.
  - `JetBrains Mono`: Spatial coordinates, telemetry readings, tabular data.
- **Elevation**: Multi-layer warm sepia shadows (`rgba(80, 40, 10, 0.12–0.28)`) replacing cold grey/black drop shadows.

### 6.2 Mobile-Native UX Guidelines
- **No Layout Bleed**: Single-column full-bleed layout on screens <= 768px (`grid-template-rows: 52px 1fr`).
- **Floating Action Dock**: Tool dock floats above bottom safe area with pill border-radius, frosted glass blur, and horizontal touch momentum scroll.
- **Touch Targets**: Minimum 40px–44px hit bounds with instant active feedback (`scale(0.92)`).
- **Inspector Bottom Sheet**: Slides up from bottom with spring easing (`cubic-bezier(0.32, 0.72, 0, 1)`), top drag handle, and max-height 72dvh.
- **Auto Tile Invalidation**: Window resize listener on Leaflet map ensures zero tile blanking across mobile rotation.

---

## Related Notes
- [[CORE_MEMORY]]
- [[ADR-002 - Adoption of Taste Skill and Emil Kowalski Design Engineering Systems]]
- [[ADR-008 - Retro Warm Light Theme and Mobile-Native Responsive Architecture]]
- [[Taste_Skill_Anti_Slop_Frontend_System]]
- [[Emil_Kowalski_Design_Engineering_And_Motion_System]]
- [[Agent_Skills_Catalog]]
