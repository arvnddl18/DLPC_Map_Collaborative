# ADR-004: Implementation of Playwright MCP Browser Automation Server

## Current
The project integrates the official **Playwright MCP (Model Context Protocol) Server** (`@playwright/mcp@latest`) by Microsoft ([playwright.dev/mcp/installation](https://playwright.dev/mcp/installation)) across both workspace and global Antigravity configurations:
1. **Workspace Configuration**: `.agents/mcp_config.json`, `mcp_config.json`, and `.vscode/mcp.json`.
2. **Global Configuration**: `~/.gemini/config/mcp_config.json` (`C:\Users\lorea\.gemini\config\mcp_config.json`).
3. **Execution Command**:
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
4. **Browser Runtime**: Chromium binary verified and present in LocalAppData (`ms-playwright/chromium-1243`).
5. **Tool Provider**: Exposes 25 structured browser automation and DOM accessibility tools directly to the agent harness.

## Previous
The agent previously relied on:
- Text-based code analysis or standard static HTTP requests (`read_url_content`).
- Built-in browser subagents with pixel/screenshot-based loops.
- ECC `browser-qa` and `e2e-runner` skills that referenced external browser MCPs without a configured, tested local MCP server instance.

## Reason for Change / Rationale
For `DLPC_Map_Collaborative`, web UI rendering, real-time spatial interaction, map canvas verification, and user journeys require reliable, token-efficient browser automation:
1. **Accessibility Tree Snapshotting over Pixel Dumps**: `@playwright/mcp` generates compact, structured accessibility trees rather than raw token-heavy pixel screenshots, allowing the agent to target elements with unambiguous semantic locators (`ref`).
2. **25 Specialized Web Automation Tools**: Enables navigating, snapshotting, clicking, form-filling, typing, file uploading, drag-and-drop, console message capture, network inspection, and JavaScript evaluation.
3. **Full Integration with ECC Skills**: Directly powers the ECC `browser-qa` skill and `e2e-runner` persona for automated regression testing and UI verification without human intervention.
4. **Cross-Client Standardization**: By maintaining configuration across `.agents/mcp_config.json`, project root, and global Antigravity config, the MCP server is accessible regardless of how the project is launched.

## Implementation Scope
- Configured global MCP server in `C:\Users\lorea\.gemini\config\mcp_config.json`.
- Configured project-level MCP server in `.agents/mcp_config.json`, `mcp_config.json`, and `.vscode/mcp.json`.
- Verified JSON-RPC protocol initialization (`protocolVersion: 2024-11-05`) and tool availability via test runner.
- Documented technical architecture in [[Playwright_MCP_Browser_Automation_System]].
- Updated [[CORE_MEMORY]], [[CURRENT_STATE]], and [[Agent_Skills_Catalog]].

## Status
Active

## Date
2026-09-30

## Related Notes
- [[CORE_MEMORY]]
- [[CURRENT_STATE]]
- [[Playwright_MCP_Browser_Automation_System]]
- [[Agent_Skills_Catalog]]
- [[ECC_Agent_Harness_System]]
- [[ADR-003 - Adoption of ECC Everything Claude Code System]]
