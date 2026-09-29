# Emil Kowalski: Design Engineering & Motion System

This note documents the design engineering, animation standards, and interaction principles distilled from **Emil Kowalski's Skills**, located across `.agents/skills/emil-design-eng/`, `.agents/skills/animate/`, and related directories.

---

## 1. Design Engineering Philosophy

1. **Taste is Trained, Not Innate**: Good taste is the ability to recognize subtle friction points, unnatural physics, and awkward layout rhythms.
2. **Unseen Details Compound**: Invisible correctness (instant keyboard actions, zero tap delay, correct transform origin) combines to make software feel natural and trustworthy.
3. **Beauty is Leverage**: Fluid, tactile software differentiates an engineering product from clunky enterprise tools.

---

## 2. The Animation Decision Framework

Before writing any CSS transition or animation hook, step through these five gates in order:

### Gate 1: Should this animate at all?
- **100+ times/day** (command palette toggle, map hotkeys, layer selection via hotkey): **No animation. Ever.**
- **Tens of times/day** (hover states, toolbar clicks): 100–150ms maximum or instant.
- **Occasional** (modal dialogues, inspector drawers, toast messages): Standard 200–300ms animation.
- **Rare / First-time** (initial welcome sequence, onboarding): Expressive animation permitted.

> *Rule: Keyboard-initiated actions are an automatic disqualifier for animation.*

### Gate 2: What is the purpose?
Must serve one of six legitimate purposes:
1. **Feedback**: Confirming an interaction occurred (e.g. `:active` button scale down to `0.97`).
2. **Spatial consistency**: Showing where an element originated (e.g. drawer emerges from screen edge).
3. **State indication**: Visualizing status change (e.g. sync spinner morphing to checkmark).
4. **Preventing jarring changes**: Softening an element's appearance so it doesn't flash abruptly.
5. **Explanation**: Demonstrating a workflow in onboarding.
6. **Delight**: Strictly reserved for rare milestone interactions.

### Gate 3: Cheapest Tool That Works
1. **CSS Transition**: For hover, press, color, class toggle.
2. **CSS `@starting-style`**: For entry animation on DOM mount without JavaScript state libraries.
3. **CSS Animation (`@keyframes`)**: Predetermined loops/loaders (runs off-main-thread).
4. **WAAPI (`element.animate()`)**: Programmatic transitions needing native performance without third-party bundles.
5. **Motion (`motion.dev`)**: Gestures, springs, layout morphs, exit animations.

### Gate 4: Pick Properties (Hardware Acceleration Only)
- **`transform` and `opacity` only**. GPU accelerated; avoids layout reflow and paint cycles.
- **Never animate layout**: `width`, `height`, `margin`, `padding`, `top`, `left` cause layout recalculations on every frame.
- **Never `scale(0)`**: Enter from `scale(0.92–0.97)` + `opacity: 0`. Real-world objects don't spawn from mathematical singularities.
- **`transform-origin`**: Set at the trigger element for popovers and dropdowns (`var(--transform-origin)`). Center modals.
- **In Motion (`motion.dev`)**: Always pass full transform strings:
  ```tsx
  // Good: Hardware accelerated
  <motion.div animate={{ transform: "translateX(100px)" }} />
  
  // Bad: Drops frames under CPU load
  <motion.div animate={{ x: 100 }} />
  ```

### Gate 5: Easing & Duration Curves
- **Entrance**: `ease-out` (starts instantly, decelerates into place; feels responsive to user).
  - Recommended CSS curve: `cubic-bezier(0.16, 1, 0.3, 1)` (snappy ease-out) or `cubic-bezier(0, 0, 0.2, 1)`.
- **Exit**: Fast `ease-in` or quick `ease-out` (150–200ms).
- **Movement across screen**: Tuned spring physics or `cubic-bezier(0.65, 0, 0.35, 1)`.

---

## 3. Mobile-Native Web Standards

Source: `.agents/skills/mobile-native/SKILL.md`

When building map or dashboard interfaces for touchscreens / mobile browsers:
1. **100vh Bug**: Always use `100dvh` (dynamic viewport height) or `100svh` to prevent content jumping under browser address bars.
2. **Tap Highlight**: Set `-webkit-tap-highlight-color: transparent` to eliminate the default gray tap flash.
3. **Touch Callout**: Set `-webkit-touch-callout: none` and `user-select: none` on interactive buttons to prevent text selection on press.
4. **Input Zoom Bug**: Ensure form input font size is at least `16px` on mobile Safari to prevent unwanted automatic page zooming.
5. **Safe Areas**: Use `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` for bottom navigation and floating toolbars.

---

## 4. UI Library Selection Guide

Source: `.agents/skills/pick-ui-library/SKILL.md`

| Need | Recommended Library | Note |
| :--- | :--- | :--- |
| Toasts / Notifications | **Sonner** (`ask-sonner`) | Lightweight, stacked physics, accessible |
| Bottom Sheets | **Vaul** | Fluid gesture-driven drawer for mobile/desktop |
| Primitive Components | **Base UI** or **Radix UI** | Unstyled, fully accessible, handles focus trapping |
| Command Palette | **cmdk** | Fast keyboard navigation with zero motion lag |
| Gestures & Springs | **Motion** (`motion.dev`) | Standard React motion engine |

---

## 5. Associated Emil Kowalski Skills in Workspace

| Skill Folder | Description |
| :--- | :--- |
| `emil-design-eng/` | Core design engineering philosophy and review standards |
| `animate/` | Step-by-step animation builder (curves, properties, recipes) |
| `animate-expo/` | React Native & Expo animation, Reanimated, gesture handoffs |
| `review-animations/` | Strict audit format enforcing craft rules against diffs |
| `improve-animations/` | Codebase-wide motion survey and remediation planner |
| `find-animation-opportunities/` | Identifies where motion adds value and rejects where it harms UX |
| `animation-vocabulary/` | Precise vocabulary for describing motion phenomena |
| `apple-design/` | Fluid physics and interaction principles from Apple WWDC |
| `mobile-native/` | Critical CSS & viewport fixes for touchscreen devices |
| `pick-ui-library/` | Opinionated component library selection guide |
| `prototype/` | Visual multi-variant component switcher workflow |
| `ask-sonner/` | In-depth recipes and troubleshooting for the Sonner toast library |
| `write-swift/` | Modern Swift 6 concurrency, generics, and performance guide |

---

## Related Notes
- [[UI_UX_Design_And_Motion_Preferences]]
- [[Taste_Skill_Anti_Slop_Frontend_System]]
- [[Agent_Skills_Catalog]]
- [[ADR-002 - Adoption of Taste Skill and Emil Kowalski Design Engineering Systems]]
