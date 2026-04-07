---
name: kto:init
description: Initialize kto for the current project. Prompts for vault path and creates .kto/config.json with per-agent model defaults. Safe to re-run — preserves existing configuration.
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<objective>
Initialize kto configuration for the current project by creating or updating `.kto/config.json`.
</objective>

<process>

## Step 1 — Check existing config

```bash
cat .kto/config.json 2>/dev/null || echo "NO_CONFIG"
```

If config exists, display current values and ask if the user wants to update them.

## Step 2 — Gather required information

Ask the user (using AskUserQuestion):

1. **Vault path**: "What is the absolute path to your Obsidian vault? (e.g., /Users/yourname/Notes/MyVault)"
2. **Project ID**: "What short ID should be used for this project? (uppercase, e.g., MY-APP). Press Enter to use the current directory name."
3. **Vault subfolder**: "What subfolder inside the vault should kto use for this project? (e.g., Projects/MY-APP). Press Enter to accept the default."

## Step 3 — Model configuration (optional)

Ask: "Do you want to customize which LLM model each agent uses? (y/N)"

If yes, show current defaults and ask for overrides:
- Project Mapper (default: claude-haiku-4-5-20251001) — cheap, runs on every file
- Graph Builder (default: claude-sonnet-4-6) — the reasoning agent, needs more capability
- Obsidian Sync (default: claude-haiku-4-5-20251001) — templated writing
- Change Detector (default: claude-haiku-4-5-20251001) — fast, targeted

## Step 4 — Write config

Create `.kto/` directory and write `config.json`:

```bash
mkdir -p .kto
```

Write `.kto/config.json` with the Write tool:

```json
{
  "vault_path": "{user_answer_1}",
  "project_id": "{user_answer_2}",
  "obsidian_subfolder": "{user_answer_3}",
  "output_dir": ".kto",
  "agents": {
    "project_mapper": "claude-haiku-4-5-20251001",
    "graph_builder": "claude-sonnet-4-6",
    "obsidian_sync": "claude-haiku-4-5-20251001",
    "change_detector": "claude-haiku-4-5-20251001"
  }
}
```

## Step 5 — Add to .gitignore

Append `.kto/` to `.gitignore` if not already present:

```bash
grep -q "^\.kto/" .gitignore 2>/dev/null || echo ".kto/" >> .gitignore
```

## Step 6 — Confirm

Display a summary:
```
✓ kto initialized
  Config: .kto/config.json
  Vault: {vault_path}
  Project: {project_id}
  Subfolder: {obsidian_subfolder}

Run /kto:analyze to perform the first full analysis.
```

</process>
