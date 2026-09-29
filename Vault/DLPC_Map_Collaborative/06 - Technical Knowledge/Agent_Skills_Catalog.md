# Agent Skills Catalog

This document is the central registry of all active skills installed in the project's agent system (`.agents/skills/`). Each skill acts as an on-demand procedural runbook accessible to Antigravity agents.

---

## 1. Core Memory System

| Skill Folder | Skill Name | Purpose | Primary Files |
| :--- | :--- | :--- | :--- |
| `obsidian-memory/` | `obsidian-memory` | Governs persistent project memory, context retrieval, and silent knowledge extraction via Obsidian vault. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/obsidian-memory/SKILL.md) |

---

## 2. Taste & Anti-Slop Frontend System (Leonxlnx)

Repository: [leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill)

| Skill Folder | Install Name | Description & When to Use | Path |
| :--- | :--- | :--- | :--- |
| `taste-skill/` | `design-taste-frontend` | **Main v2 Skill**: Contextual brief inference, Three Dials (`VARIANCE`, `MOTION`, `DENSITY`), design-system map, anti-slop rules, GSAP skeletons. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/taste-skill/SKILL.md) |
| `taste-skill-v1/` | `design-taste-frontend-v1` | Preserved v1 version of Taste Skill for legacy pinning. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/taste-skill-v1/SKILL.md) |
| `gpt-tasteskill/` | `gpt-taste` | Stricter variant optimized for GPT/Codex with higher layout variance enforcement. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/gpt-tasteskill/SKILL.md) |
| `minimalist-skill/`| `minimalist-ui` | Editorial product UI (Linear/Notion vibes), restrained palette, crisp information hierarchy. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/minimalist-skill/SKILL.md) |
| `soft-skill/` | `high-end-visual-design` | High-end visual design with soft contrast, generous whitespace, and spring motion. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/soft-skill/SKILL.md) |
| `brutalist-skill/` | `industrial-brutalist-ui` | High-contrast industrial and Swiss-style typography for technical interfaces. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/brutalist-skill/SKILL.md) |
| `redesign-skill/` | `redesign-existing-projects` | Audit-first workflow for upgrading layout, spacing, and styling of existing code. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/redesign-skill/SKILL.md) |
| `output-skill/` | `full-output-enforcement` | Enforces full file outputs without lazy placeholders or truncated snippets. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/output-skill/SKILL.md) |
| `stitch-skill/` | `stitch-design-taste` | Google Stitch design taste guidelines and `DESIGN.md` export. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/stitch-skill/SKILL.md) |

---

## 3. Design Engineering & Animation System (Emil Kowalski)

Repository: [emilkowalski/skills](https://github.com/emilkowalski/skills)

| Skill Folder | Skill Name | Description & When to Use | Path |
| :--- | :--- | :--- | :--- |
| `emil-design-eng/` | `emil-design-eng` | **Core Philosophy**: Craft standards, invisible details, review format, and decision framework. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/emil-design-eng/SKILL.md) |
| `animate/` | `animate` | Motion builder from scratch (frequency gate, properties, tool selection, exact curves). | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/animate/SKILL.md) |
| `review-animations/` | `review-animations` | Strict audit of animation pull requests/diffs in table format (`| Before | After | Why |`). | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/review-animations/SKILL.md) |
| `improve-animations/`| `improve-animations` | Codebase-wide audit identifying motion defects and generating prioritized action plans. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/improve-animations/SKILL.md) |
| `find-animation-opportunities/` | `find-animation-opportunities` | Identifies where motion adds functional value and rejects where it harms UX. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/find-animation-opportunities/SKILL.md) |
| `animation-vocabulary/` | `animation-vocabulary` | Reverse lookup glossary converting vague motion descriptions to precise terminology. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/animation-vocabulary/SKILL.md) |
| `apple-design/` | `apple-design` | Apple WWDC fluid motion principles, materials, tracking, and springs for the web. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/apple-design/SKILL.md) |
| `mobile-native/` | `mobile-native` | Touchscreen & mobile Safari fixes: 100dvh, tap highlights, safe areas, fast taps. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/mobile-native/SKILL.md) |
| `pick-ui-library/` | `pick-ui-library` | Curated UI library recommendations for toasts, dialogs, drawers, and command menus. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/pick-ui-library/SKILL.md) |
| `prototype/` | `prototype` | Multi-variant visual component switcher for rapid UI exploration. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/prototype/SKILL.md) |
| `ask-sonner/` | `ask-sonner` | Recipes, positioning, theming, and debugging for the Sonner toast notification system. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/ask-sonner/SKILL.md) |
| `animate-expo/` | `animate-expo` | React Native & Expo animation builder with Reanimated and gesture handlers. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/animate-expo/SKILL.md) |
| `write-swift/` | `write-swift` | Modern Swift 6 guidelines (value types, data-race safety, concurrency). | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/write-swift/SKILL.md) |

---

## 4. Image Generation & Visual Pipeline Skills

| Skill Folder | Install Name | Description | Path |
| :--- | :--- | :--- | :--- |
| `image-to-code-skill/` | `image-to-code` | Reference image → visual analysis → responsive code implementation pipeline. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/image-to-code-skill/SKILL.md) |
| `imagegen-frontend-web/` | `imagegen-frontend-web` | Generates prompt instructions for web landing and dashboard UI reference comps. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/imagegen-frontend-web/SKILL.md) |
| `imagegen-frontend-mobile/` | `imagegen-frontend-mobile` | Generates prompt instructions for mobile app UI flows and mockups. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/imagegen-frontend-mobile/SKILL.md) |
| `brandkit/` | `brandkit` | Generates brand identity, typography, and palette boards. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/brandkit/SKILL.md) |

---

## 5. ECC (Everything Claude Code) Developer Suite

Repository: [affaan-m/ECC](https://github.com/affaan-m/ECC) (Installed via `ecc-universal` target `antigravity`)

### 5.A Key Quality & Architecture Skills (`.agents/skills/`)
| Skill Folder | Skill Name | Description & When to Use | Path |
| :--- | :--- | :--- | :--- |
| `tdd-workflow/` | `tdd-workflow` | Test-driven development loop: write tests first, verify red, implement minimal green, refactor. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/tdd-workflow/SKILL.md) |
| `verification-loop/`| `verification-loop` | Automated multi-check verification: TypeScript, linter, tests, and build check. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/verification-loop/SKILL.md) |
| `codebase-onboarding/` | `codebase-onboarding` | Architecture, dependency, and pattern discovery across new and existing codebases. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/codebase-onboarding/SKILL.md) |
| `architecture-decision-records/` | `architecture-decision-records` | Architectural Decision Record (ADR) creation and governance runbook. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/architecture-decision-records/SKILL.md) |
| `intent-driven-development/` | `intent-driven-development` | Maps business intent directly to unit specifications and execution paths. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/intent-driven-development/SKILL.md) |
| `browser-qa/` | `browser-qa` | Automated browser inspection, console log analysis, and DOM debugging. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/browser-qa/SKILL.md) |
| `git-workflow/` | `git-workflow` | Branching, atomic commit conventions, PR hygiene, and merge strategy. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/git-workflow/SKILL.md) |
| `backend-patterns/`| `backend-patterns` | Backend API design, connection pooling, idempotency, and transactional consistency. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/backend-patterns/SKILL.md) |
| `api-design/` | `api-design` | REST and RPC API contract design, payload validation, and error envelopes. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/api-design/SKILL.md) |
| `strategic-compact/` | `strategic-compact` | Long-session context window compaction and token conservation. | [SKILL.md](file:///c:/arvincodework/DLPC_Map_Collaborative/.agents/skills/strategic-compact/SKILL.md) |

### 5.B Specialized Sub-Agent Personas (`.agents/agents/`)
| Agent | Role | Focus |
| :--- | :--- | :--- |
| `planner.md` | Feature Implementation Planner | Decomposes complex tasks, identifies edge cases and dependencies. |
| `architect.md` | System Architect | Module boundaries, state flow, database schemas, ADRs. |
| `code-reviewer.md` | Senior Code Reviewer | Code quality, maintainability, performance, standards. |
| `security-reviewer.md` | Security Auditor | Vulnerability scanning, OWASP top 10, sanitization, auth fences. |
| `tdd-guide.md` | TDD Specialist | Test suites, test-first specs, red-green-refactor loop. |
| `build-error-resolver.md` | Build Repair Specialist | Typescript/compiler errors, bundling issues, package conflicts. |
| `e2e-runner.md` | E2E Testing Specialist | Playwright and browser journey testing. |
| `refactor-cleaner.md` | Refactoring Specialist | Dead code elimination, abstraction simplification. |
| `database-reviewer.md` | Database Specialist | Schema migration safety, spatial query indexing, query optimization. |

### 5.C Workflows & Rules
- **Workflows (`.agents/workflows/`)**: 94 slash command definitions including `/feature-dev`, `/code-review`, `/build-fix`, `/checkpoint`, `/evolve`.
- **Rules (`.agents/rules/`)**: 122 workspace rules providing standards for React, TypeScript, security, testing, and performance.

---

## 6. Model Context Protocol (MCP) Tool Providers

| Server Name | Package / Source | Transport | Capabilities | Config Path |
| :--- | :--- | :--- | :--- | :--- |
| `playwright` | `@playwright/mcp@latest` ([Docs](https://playwright.dev/mcp/installation)) | `stdio` via `npx -y` | 25 browser automation tools (accessibility tree snapshotting, navigation, clicking, form filling, network logging, console diagnostics) | `.agents/mcp_config.json`, `~/.gemini/config/mcp_config.json` |

*For complete tool listings and operational runbooks, see [[Playwright_MCP_Browser_Automation_System]].*

---

## Related Notes
- [[CORE_MEMORY]]
- [[CURRENT_STATE]]
- [[UI_UX_Design_And_Motion_Preferences]]
- [[Taste_Skill_Anti_Slop_Frontend_System]]
- [[Emil_Kowalski_Design_Engineering_And_Motion_System]]
- [[ECC_Agent_Harness_System]]
- [[Playwright_MCP_Browser_Automation_System]]
- [[ADR-002 - Adoption of Taste Skill and Emil Kowalski Design Engineering Systems]]
- [[ADR-003 - Adoption of ECC Everything Claude Code System]]
- [[ADR-004 - Implementation of Playwright MCP Browser Automation Server]]

