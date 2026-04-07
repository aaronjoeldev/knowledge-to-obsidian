# kto — Knowledge to Obsidian

AI-powered codebase analysis and Obsidian knowledge sync for Claude Code and OpenCode.

## Installation

```bash
npm install -g kto-cc
```

For Claude Code only (default):
```bash
node bin/install.js
```

For OpenCode:
```bash
node bin/install.js --opencode
```

For both:
```bash
node bin/install.js --both
```

## Quick Start

**Claude Code:**
```
/kto:init      — Configure vault path and project ID
/kto:analyze   — Full scan → graph → Obsidian sync
/kto:diff      — Incremental update after code changes
/kto:sync      — Re-sync vault from existing knowledge
```

**OpenCode:**
```
/kto-init      — Configure vault path and project ID
/kto-analyze   — Full scan → graph → Obsidian sync
/kto-diff      — Incremental update after code changes
/kto-sync      — Re-sync vault from existing knowledge
```

## Configuration

Create `.kto/config.json` in your project root (or run `/kto:init`):

```json
{
  "vault_path": "/absolute/path/to/your/vault",
  "project_id": "MY-PROJECT",
  "obsidian_subfolder": "Projects/MY-PROJECT",
  "agents": {
    "project_mapper": "claude-haiku-4-5-20251001",
    "graph_builder": "claude-sonnet-4-6",
    "obsidian_sync": "claude-haiku-4-5-20251001",
    "change_detector": "claude-haiku-4-5-20251001"
  }
}
```

Each agent can use a different model — use cheaper/faster models for mechanical tasks, more capable models for reasoning.

## Pipeline

```
Repo → [Project Mapper]  → .kto/knowledge.json
     → [Graph Builder]   → .kto/enriched_knowledge.json
     → [Obsidian Sync]   → Obsidian Vault Notes
```

For incremental updates: `[Change Detector]` updates only affected notes.

## Obsidian Vault Structure

```
{obsidian_subfolder}/
├── Facts.md                    # Project overview
├── Technology.md
├── Features/
│   ├── Features_Index.md
│   └── FEAT-001_Auth.md
├── Code_Map/
│   ├── Modules_Index.md
│   └── MODULE-AuthService.md
├── Third_Party/
│   └── THIRD-Stripe.md
└── Security/
    └── Security_Overview.md
```

User content outside `<!-- AUTO-GENERATED -->` blocks is never overwritten.

## Programmatic API

```typescript
import { KtoRunner } from 'kto-cc';

const runner = new KtoRunner({ projectDir: '/path/to/project' });
await runner.analyze();
```
