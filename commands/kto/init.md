---
name: kto:init
description: Initialize kto for the current project. Uses code-backed provider detection/defaults and writes .kto/config.json. Safe to re-run — preserves existing configuration.
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

## Step 1 — Resolve kto helper and load init context

Use Bash to resolve the installed helper script. Check in this order and store the first existing path as `KTO_TOOLS`:

- `.claude/kto/bin/kto-tools.cjs`
- `.opencode/kto/bin/kto-tools.cjs`
- `$HOME/.claude/kto/bin/kto-tools.cjs`
- `$HOME/.config/opencode/kto/bin/kto-tools.cjs`

If no helper exists, STOP with: `kto helper script not found. Reinstall kto.`

Then run:

```bash
node "$KTO_TOOLS" init-context "$PWD"
```

Parse the JSON result as `init_context`.

Important fields:

- `init_context.detectedProviders`
- `init_context.providerOptions`
- `init_context.selectedProvider`
- `init_context.defaults.vault_path`
- `init_context.defaults.provider`
- `init_context.defaults.project_id`
- `init_context.defaults.obsidian_subfolder`
- `init_context.defaults.output_dir`
- `init_context.defaults.agents.*`
- `init_context.defaults.model_fallbacks.*`

## Step 2 — Gather required information

**Continue automatically after getting the init context** — do not wait for user confirmation to proceed.

Ask the user (using AskUserQuestion):

1. **Vault path**: `What is the absolute path to your Obsidian vault? Example: /Users/yourname/Documents/Obsidian/MyVault. Press Enter to keep empty and configure later (required for /kto:analyze). [current: {init_context.defaults.vault_path}]`
2. **Project ID**: `What short ID should be used for this project? Use uppercase letters, numbers, and dashes only. Example: MY-PROJECT. [current: {init_context.defaults.project_id}]`
3. **Vault subfolder**: `What subfolder inside the vault should kto use? Example: Projects/MY-PROJECT. [current: {init_context.defaults.obsidian_subfolder}]`
4. **Output directory**: `Where should kto write its output files? This is relative to your project root. Example: .kto. [current: {init_context.defaults.output_dir}]`

If the user presses Enter, keep the current/default value.

**After asking each question, immediately proceed to the next step** — do not pause or emit completion messages between questions.

## Step 3 — Provider selection

**Continue automatically after Step 2** — do not wait for confirmation.

Always show a provider picker using AskUserQuestion with **all** `init_context.providerOptions`, not only detected ones.

Rules:

- Put the recommended option first. The recommended option is the one where `recommended === true`.
- For every detected provider, append ` (Detected)` to the label.
- For the recommended option, append ` (Recommended)`.
- If an option is both recommended and detected, append both in that order.
- Use the provider's `description` as the option description.

Question:

- `Which provider should kto target for this repo?`

Header:

- `Provider`

**Immediately after the user answers**, proceed to Step 4 — do not pause.

If `selected_provider !== "anthropic"`, tell the user:

- `inherit` is recommended unless you know the exact provider-native model IDs your runtime accepts.

## Step 4 — Refresh provider defaults from code

**Continue automatically** — do not wait for user input.

Run the helper again and use `selected_provider` to derive provider-aware defaults for the rest of the flow:

```bash
node - <<'EOF'
const tools = require(process.env.KTO_TOOLS);
const ctx = tools.buildInitContext(process.cwd());
const defaults = tools.buildProviderDefaults(process.env.SELECTED_PROVIDER, ctx.existingConfig || {});
process.stdout.write(JSON.stringify({
  selectedProvider: process.env.SELECTED_PROVIDER,
  agents: defaults.agents,
  model_fallbacks: defaults.model_fallbacks,
}, null, 2));
EOF
```

Pass environment variables:

- `KTO_TOOLS={resolved helper path}`
- `SELECTED_PROVIDER={selected_provider}`

Parse the JSON result as `provider_defaults`.

## Step 5 — Model configuration (optional)

**Continue automatically to the provider defaults refresh** — do not wait.

Ask: `Do you want to customize which LLM model each agent uses? (y/N)`

If yes, ask per-agent model with current defaults from `provider_defaults.agents`:

- Project Mapper (`project_mapper`) — cheap, runs on every file
- Graph Builder (`graph_builder`) — the reasoning agent, needs more capability
- Obsidian Sync (`obsidian_sync`) — templated writing
- Change Detector (`change_detector`) — fast, targeted

**Immediately after each model answer**, proceed to the next question.

If no, set `final_agents = provider_defaults.agents`.

Then ask:

- `Do you want to set per-agent fallback models? (y/N)`

If yes, ask per-agent fallback values using `provider_defaults.model_fallbacks` as defaults.
**Immediately after each fallback answer**, proceed to the next question or Step 6.

If no, set `final_fallbacks = provider_defaults.model_fallbacks`.

Important:

- Keep `inherit` exactly as the literal string `"inherit"`.
- Do not keep empty-string fallback values.

## Step 6 — Write config

Create `.kto/` directory:

```bash
mkdir -p .kto
```

Write `.kto/config.json` with the Write tool:

```json
{
  "vault_path": "{final_vault_path}",
  "provider": "{selected_provider}",
  "project_id": "{final_project_id}",
  "obsidian_subfolder": "{final_obsidian_subfolder}",
  "output_dir": "{final_output_dir}",
  "agents": {
    "project_mapper": "{final_agents.project_mapper}",
    "graph_builder": "{final_agents.graph_builder}",
    "obsidian_sync": "{final_agents.obsidian_sync}",
    "change_detector": "{final_agents.change_detector}"
  },
  "model_fallbacks": {
    ...only include fallback entries whose values are non-empty...
  }
}
```

## Step 7 — Add to .gitignore

Append `.kto/` and the configured output directory to `.gitignore` if not already present:

```bash
grep -q "^\.kto/" .gitignore 2>/dev/null || echo ".kto/" >> .gitignore
grep -q "^${final_output_dir}/" .gitignore 2>/dev/null || echo "${final_output_dir}/" >> .gitignore
```

## Step 8 — Confirm

Display:

```text
✓ kto initialized
  Config: .kto/config.json
  Provider: {selected_provider}
  Vault: {final_vault_path}
  Project: {final_project_id}
  Subfolder: {final_obsidian_subfolder}

Run /kto:analyze to perform the first full analysis.
```

</process>
