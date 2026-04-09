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

If config exists, parse it and keep it in memory as `existing_config`.
If parsing fails, continue with empty object `{}` and tell the user defaults will be used.

Also compute `current_dir_name` from the current directory basename.

Build effective defaults from existing values first, then fall back to static defaults:

- `default_vault_path = existing_config.vault_path || ""`
- `default_project_id = existing_config.project_id || current_dir_name.toUpperCase()`
- `default_obsidian_subfolder = existing_config.obsidian_subfolder || "Projects/" + default_project_id`
- `default_output_dir = existing_config.output_dir || ".kto"`
- `default_agents.project_mapper = existing_config.agents?.project_mapper || "claude-haiku-4-5-20251001"`
- `default_agents.graph_builder = existing_config.agents?.graph_builder || "claude-sonnet-4-6"`
- `default_agents.obsidian_sync = existing_config.agents?.obsidian_sync || "claude-haiku-4-5-20251001"`
- `default_agents.change_detector = existing_config.agents?.change_detector || "claude-haiku-4-5-20251001"`

## Step 2 — Gather required information

Ask the user (using AskUserQuestion):

1. **Vault path**: "What is the absolute path to your Obsidian vault? [current: {default_vault_path}]"
2. **Project ID**: "What short ID should be used for this project? [current: {default_project_id}]"
3. **Vault subfolder**: "What subfolder inside the vault should kto use? [current: {default_obsidian_subfolder}]"
4. **Output directory**: "Where should kto write its output files? [current: {default_output_dir}]"

Important behavior:
- If user presses Enter on any prompt, keep the current/default value.
- Do not replace existing values with static defaults when the user provides empty input.

## Step 3 — Model configuration (optional)

Ask: "Do you want to customize which LLM model each agent uses? (y/N)"

If yes, ask per-agent model with current defaults (Enter keeps existing value):
- Project Mapper (current: `{default_agents.project_mapper}`) — cheap, runs on every file
- Graph Builder (current: `{default_agents.graph_builder}`) — the reasoning agent, needs more capability
- Obsidian Sync (current: `{default_agents.obsidian_sync}`) — templated writing
- Change Detector (current: `{default_agents.change_detector}`) — fast, targeted

Store answers as:
- `final_agents.project_mapper`
- `final_agents.graph_builder`
- `final_agents.obsidian_sync`
- `final_agents.change_detector`

If user chooses "No", set `final_agents = default_agents`.

## Step 4 — Write config

Create `.kto/` directory and write `config.json`:

```bash
mkdir -p .kto
```

Write `.kto/config.json` with the Write tool:

```json
{
  "vault_path": "{final_vault_path}",
  "project_id": "{final_project_id}",
  "obsidian_subfolder": "{final_obsidian_subfolder}",
  "output_dir": "{final_output_dir}",
  "agents": {
    "project_mapper": "{final_agents.project_mapper}",
    "graph_builder": "{final_agents.graph_builder}",
    "obsidian_sync": "{final_agents.obsidian_sync}",
    "change_detector": "{final_agents.change_detector}"
  }
}
```

This final JSON must use the computed `final_*` values (including model customizations), not hardcoded defaults.

## Step 5 — Add to .gitignore

Append `.kto/` and the configured output directory to `.gitignore` if not already present:

```bash
grep -q "^\.kto/" .gitignore 2>/dev/null || echo ".kto/" >> .gitignore
grep -q "^${final_output_dir}/" .gitignore 2>/dev/null || echo "${final_output_dir}/" >> .gitignore
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
