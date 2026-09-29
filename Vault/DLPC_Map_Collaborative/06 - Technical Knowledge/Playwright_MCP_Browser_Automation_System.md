# Playwright MCP Browser Automation System

## Overview
The **Playwright MCP Server** (`@playwright/mcp@latest`) is the official Microsoft Model Context Protocol implementation for browser automation. It connects LLM coding assistants and agents directly to browser instances using structured accessibility trees rather than raw visual pixels, drastically reducing token consumption while increasing element targeting precision.

Official Documentation: [playwright.dev/mcp/installation](https://playwright.dev/mcp/installation)

---

## 1. System Configuration Files

The Playwright MCP server is configured across both global and workspace-level configuration locations:

| Location | Path | Scope |
| :--- | :--- | :--- |
| **Global Antigravity** | `C:\Users\lorea\.gemini\config\mcp_config.json` | All workspace sessions in Antigravity |
| **Workspace Customization Root** | `.agents/mcp_config.json` | Project-specific Antigravity sessions |
| **Project Root** | `mcp_config.json` | Cross-tool workspace discovery |
| **VS Code / Copilot** | `.vscode/mcp.json` | VS Code & compatible IDE runners |

### Configuration Schema
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "-y",
        "@playwright/mcp@latest"
      ]
    }
  }
}
```

---

## 2. Verified Capabilities & 25 Native MCP Tools

The server communicates via standard JSON-RPC (`protocolVersion: 2024-11-05`) over `stdio`, exposing 25 tools:

### Page Exploration & Navigation
- `browser_navigate`: Navigate to a specific URL (supports navigation timeout parameters).
- `browser_navigate_back`: Return to the previous entry in history.
- `browser_snapshot`: Capture a structured accessibility snapshot of the current page with semantic element references (`ref`).
- `browser_find`: Search the accessibility tree for text patterns or matching criteria.
- `browser_tabs`: List, open, switch, or close browser tabs.
- `browser_close`: Close the active browser page or session.

### Element Interaction
- `browser_click`: Click elements using their unique snapshot element reference (`ref`).
- `browser_type`: Type text into input fields, textareas, or content-editable nodes.
- `browser_fill_form`: Atomically fill multiple form inputs in a single tool call.
- `browser_press_key`: Trigger keyboard keys (e.g. `Enter`, `Tab`, `Escape`, arrow keys).
- `browser_select_option`: Select option(s) in HTML dropdown selects.
- `browser_hover`: Trigger hover/mouse-over states on UI elements.
- `browser_drag` & `browser_drop`: Perform drag-and-drop operations between UI nodes.
- `browser_file_upload`: Attach one or multiple files to file input elements.

### Synchronization & Diagnostics
- `browser_wait_for`: Wait for specific text or element state changes to appear/disappear.
- `browser_console_messages`: Retrieve console warnings, errors, and logs from the page context.
- `browser_network_requests`: Inspect numbered list of HTTP network requests made by the page.
- `browser_network_request`: Retrieve headers and payload details of a specific network request.
- `browser_handle_dialog`: Accept, dismiss, or respond to JavaScript alerts, prompts, or confirms.

### Viewport & Media Emulation
- `browser_resize`: Adjust viewport dimensions dynamically (e.g. testing desktop vs mobile breakpoints).
- `browser_emulate_media`: Emulate media queries (e.g., `prefers-color-scheme: dark`, `color-scheme: light`).
- `browser_take_screenshot`: Capture visual screenshots for visual verification when needed.
- `browser_evaluate`: Evaluate client-side JavaScript expressions in the page context.
- `browser_run_code_unsafe`: Execute arbitrary Playwright automation snippets.

---

## 3. Operational Workflow for Agents

```text
1. browser_navigate(url: "http://localhost:3000")
         ↓
2. browser_snapshot()
   → Returns accessibility tree:
     - [button "Add Layer" ref=4]
     - [textbox "Layer Name" ref=7]
         ↓
3. browser_click(ref: 4) or browser_fill_form(...)
         ↓
4. browser_wait_for(text: "Layer Created")
         ↓
5. browser_console_messages() & browser_network_requests()
   → Confirms clean execution with zero unhandled client errors
```

---

## 4. Advanced Configuration Flags

Flags can be added to `args` in `mcp_config.json`:

- **Headless Execution**: `"--headless"` (default is headed to allow real-time observation).
- **Alternative Engine**: `"--browser=chrome"` or `"--browser=firefox"` or `"--browser=webkit"` or `"--browser=msedge"`.
- **Device Emulation**: `"--device=iPhone 15"` or `"--mobile"`.
- **Vision Mode (Coordinates)**: `"--caps=vision"` (adds coordinate-based mouse interaction alongside accessibility snapshots).
- **Bounding Boxes in Snapshots**: `"--snapshot-boxes"` (injects `[box=x,y,w,h]` bounding box attributes).
- **Secrets Redaction**: `"--secrets=.env"` (automatically masks sensitive API keys/tokens from tool outputs).

---

## 5. Integration with ECC Agents & Skills

- **`browser-qa` Skill** (`.agents/skills/browser-qa/SKILL.md`): Automatically invokes Playwright MCP for 4-phase verification (Smoke Test, Interaction Test, Visual Check, Accessibility Audit).
- **`e2e-runner` Persona** (`.agents/agents/e2e-runner.md`): Uses Playwright MCP tools to test user journeys against live development servers.
- **Taste & Emil Kowalski Verification**: Verifies layout shift, hover transitions, and dark/light mode toggles on the live DOM.

---

## Related Notes
- [[ADR-004 - Implementation of Playwright MCP Browser Automation Server]]
- [[Agent_Skills_Catalog]]
- [[ECC_Agent_Harness_System]]
- [[CORE_MEMORY]]
- [[CURRENT_STATE]]
