---
name: obsidian-memory
description: >-
  Persistent long-term memory system using an external Obsidian vault. Use this skill to retrieve, extract, store, update, consolidate, and connect durable project context, architecture decisions, requirements, user preferences, and problem solutions for DLPC_Map_Collaborative.
---

# Obsidian Memory Skill

This skill governs the persistent long-term memory layer for the **DLPC_Map_Collaborative** project.

Obsidian is not merely documentation. **Obsidian is the project's external memory, knowledge base, and evolving cognitive context.**

Your responsibility is to continuously learn useful information from interactions, preserve durable context, retrieve relevant memories when needed, update outdated knowledge, detect contradictions, and progressively improve your understanding of the project.

The objective is:
**Chat → Understand → Extract → Store → Connect → Retrieve → Apply → Refine**
while minimizing unnecessary token usage and preventing hallucinations.

---

## 1. Authority Hierarchy

The repository remains the authoritative source for actual implementation.

```text
CURRENT USER INSTRUCTION
        ↓
ACTUAL PROJECT FILES / SOURCE CODE
        ↓
PROJECT CONFIGURATION
        ↓
OBSIDIAN MEMORY
        ↓
PROJECT DOCUMENTATION
        ↓
RELEVANT CHAT HISTORY
        ↓
GENERAL KNOWLEDGE
```

* Obsidian stores knowledge about the project and its history.
* The source code determines what actually exists.
* **Never allow Obsidian memory to override verified source code.**

---

## 2. Automatic Memory Extraction (Silent & Autonomous)

For every interaction, automatically analyze the conversation for durable information that improves future tasks:
* Project requirements & user requirements
* User preferences relevant to the project (coding style, UI style, workflows)
* Architecture, technical, database, and API decisions
* Coding conventions, naming conventions, business rules, constraints
* Completed work, current progress, known blockers
* Problem-solution pairs (root causes, verified fixes)
* Approaches that failed and why (to avoid repeating them)
* Important corrections from the user

Do this silently without requiring the user to explicitly say "remember this" or "save this".

---

## 3. What NOT to Store

Never automatically store:
* Raw transcripts or conversation dumps
* Every user or assistant turn
* Large code blocks or copy-pasted files
* Temporary debugging output or one-time commands
* Speculation or unverified assumptions
* Sensitive secrets, credentials, or API keys
* Ephemeral details with no future development value

**Rule of thumb:** *If knowing this information in two weeks would not improve development, it does not belong in long-term memory.*

---

## 4. Vault Organization & Paths

Vault root location:
`Vault/DLPC_Map_Collaborative/`

```text
Vault/DLPC_Map_Collaborative/
├── .obsidian/
├── 00 - Core Memory/
│   └── CORE_MEMORY.md            # High-level project index & quick pointers
├── 01 - Project Memory/          # High-level project overviews & domain scope
├── 02 - Architecture/            # System architecture, components, data flows
├── 03 - Decisions/               # Architecture Decision Records (ADRs) & technical decisions
├── 04 - Requirements/            # Functional & non-functional requirements
├── 05 - User Preferences/        # Developer/user conventions, style guides, workflows
├── 06 - Technical Knowledge/     # Library integrations, APIs, protocols, algorithms
├── 07 - Problems & Solutions/    # Solved issues, root causes, failed approaches
├── 08 - Completed Work/          # Completed milestones, features, changelogs
├── 09 - Current State/           # Active phase, in-progress tasks, blockers
│   └── CURRENT_STATE.md
├── 10 - Temporary/               # Work-in-progress notes, scratch data
└── 99 - Archive/                 # Obsolete or superseded notes
```

---

## 5. Core Memory Management (`CORE_MEMORY.md`)

Location: `Vault/DLPC_Map_Collaborative/00 - Core Memory/CORE_MEMORY.md`

Acts as the compact central index of the entire project memory. It must remain small and concise.

```markdown
# Core Memory

## Project
- Name: DLPC_Map_Collaborative
- Purpose: [High-level purpose]
- Current objective: [Active objective]

## Current State
- Active feature: [...]
- Current development phase: [...]
- Important blockers: [...]

## Technology
- Frontend: [...]
- Backend: [...]
- Database: [...]
- Infrastructure: [...]

## Architecture
- Key architectural decisions: [...]
- Important modules: [...]

## Permanent Constraints
- [...]

## Important User Preferences
- [...]

## Critical Decisions
- [...]

## Active Problems
- [...]

## Important Memory References
- [[...]]
```

---

## 6. Progressive Memory & Lifecycle Classification

When new information arrives, compare it against existing Obsidian knowledge. Categorize:
* **NEW**: Create a new note if it represents a distinct durable concept.
* **UPDATED**: Consolidate and update the existing note instead of creating duplicates.
* **CONFIRMED**: Reaffirm existing knowledge.
* **CORRECTED**: User correction takes precedence; update existing note with context.
* **CONTRADICTED**: Investigate conflict against current codebase; flag or ask for clarification.
* **OBSOLETE**: Mark `Status: Obsolete` or move to `99 - Archive/`.
* **DUPLICATE**: Merge into single authoritative note.
* **TEMPORARY**: Place in `10 - Temporary/` or discard.

### Confidence States
Every piece of stored knowledge conceptually has a confidence state:
* `VERIFIED`: Confirmed by current project files or authoritative source code.
* `INFERRED`: Derived from context but not yet verified in code.
* `PROPOSED`: Suggested design or idea under consideration.
* `HISTORICAL`: Previously true, kept for architectural rationale.
* `OBSOLETE`: No longer applicable.

---

## 7. Problem & Solution Templates

### Successful Solution (`07 - Problems & Solutions/`)
```markdown
# Problem: [Issue Title]

## Symptom
[What was observed or broken]

## Root Cause
[Why it occurred]

## Solution
[What fixed it]

## Verification
[How it was verified]

## Related
[[Related Architecture or Concept]]
```

### Failed Approach (`07 - Problems & Solutions/`)
```markdown
# Failed Approach: [Attempt Title]

## Attempt
[What was tried]

## Result
[Why it failed]

## Avoid When
[Context where this should not be repeated]

## Alternative
[What to do instead]

## Related
[[Related Architecture or Concept]]
```

---

## 8. Memory Retrieval & Token Optimization

Before answering a development request:
1. **Targeted Search**: Search `Vault/DLPC_Map_Collaborative/` for relevant concepts (keywords, related synonyms, linked notes).
2. **Read Selectively**: Read only the relevant notes. Never load the entire vault into context.
3. **Verify Against Code**: Inspect the affected repository files to ensure reality matches memory.
4. **Execute**: Proceed with the task grounded in verified context.
5. **Update**: After completing work, update `CURRENT_STATE.md`, `CORE_MEMORY.md`, or relevant topic notes if durable knowledge was produced.

---

## 9. Security & Privacy Rules

* NEVER store secrets, API tokens, database passwords, private keys, or credentials in any Obsidian note.
* Reference configuration keys or `.env` variable names (e.g. `DLPC_MAP_API_KEY`) rather than secret values.
