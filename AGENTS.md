# Workspace Instructions: DLPC_Map_Collaborative

## Persistent Long-Term Memory (Obsidian Vault)

This project uses an external Obsidian vault as its persistent long-term memory layer:
- **Vault Location**: `Vault/DLPC_Map_Collaborative/`
- **Memory Skill**: Use `.agents/skills/obsidian-memory/SKILL.md` for memory workflows, procedures, and templates.

### Core Operating Loop
```text
Chat → Understand → Extract → Store → Connect → Retrieve → Apply → Refine
```

### Hierarchy of Authority
1. Current User Instruction
2. Actual Project Files / Source Code (Authoritative for what exists)
3. Project Configuration
4. Obsidian Memory (`Vault/DLPC_Map_Collaborative/`)
5. Project Documentation
6. Relevant Chat History
7. General Knowledge

*Never allow Obsidian memory to override verified source code.*

### Key Memory Files
- Core Memory Index: `Vault/DLPC_Map_Collaborative/00 - Core Memory/CORE_MEMORY.md`
- Current Project State: `Vault/DLPC_Map_Collaborative/09 - Current State/CURRENT_STATE.md`

### Autonomous Protocol
- **Search First**: Before answering or implementing complex tasks, search relevant notes in `Vault/DLPC_Map_Collaborative/`.
- **Verify Against Code**: Inspect actual code files before acting.
- **Silent Autonomous Extraction**: After meaningful progress, extract durable knowledge (decisions, preferences, solutions, state updates) into the appropriate Obsidian notes without requiring the user to prompt it.
- **Do Not Save Transcripts**: Save consolidated, structured knowledge only. Never store secrets, passwords, or credentials.
