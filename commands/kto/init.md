---
name: kto:init
description: Initialize kto for the current project. Detects available model providers, lets the user choose one, and creates .kto/config.json with provider-appropriate agent model defaults. Safe to re-run — preserves existing configuration.
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
- `default_fallbacks = existing_config.model_fallbacks || {}`

Also detect which providers are already configured in the current host/session.

Use Bash to inspect known Claude Code provider signals:

```bash
node - <<'EOF'
const detected = [];
if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_BASE_URL) detected.push('anthropic');
if (process.env.CLAUDE_CODE_USE_BEDROCK || process.env.ANTHROPIC_BEDROCK_BASE_URL || process.env.AWS_BEARER_TOKEN_BEDROCK) detected.push('bedrock');
if (process.env.CLAUDE_CODE_USE_VERTEX || process.env.ANTHROPIC_VERTEX_PROJECT_ID || process.env.ANTHROPIC_VERTEX_BASE_URL) detected.push('vertex');
if (process.env.ANTHROPIC_FOUNDRY_API_KEY || process.env.ANTHROPIC_FOUNDRY_API_ENDPOINT || process.env.ANTHROPIC_FOUNDRY_MODEL) detected.push('foundry');
if (process.env.OPENROUTER_API_KEY) detected.push('openrouter');
if (process.env.OPENAI_API_KEY || process.env.OPENAI_BASE_URL || process.env.CODEX_PROVIDER || process.env.CODEX_MODEL || process.env.CODEX_HOME) detected.push('openai/codex');
if (process.env.Z_AI_API_KEY || process.env.GLM_API_KEY || process.env.GLM_BASE_URL || process.env.GLM_MODEL || process.env.GLM_DELEGATOR_CONFIG) detected.push('glm');
process.stdout.write(JSON.stringify([...new Set(detected)]));
EOF
```

Store the parsed result as `available_providers`.

If no providers are detected, use `['anthropic']` as the fallback choice list and tell the user detection was inconclusive.

## Step 2 — Gather required information

Ask the user (using AskUserQuestion):

1. **Vault path**: "What is the absolute path to your Obsidian vault? [current: {default_vault_path}]"
2. **Project ID**: "What short ID should be used for this project? [current: {default_project_id}]"
3. **Vault subfolder**: "What subfolder inside the vault should kto use? [current: {default_obsidian_subfolder}]"
4. **Output directory**: "Where should kto write its output files? [current: {default_output_dir}]"

Important behavior:
- If user presses Enter on any prompt, keep the current/default value.
- Do not replace existing values with static defaults when the user provides empty input.

## Step 3 — Provider selection

If `available_providers.length === 1`, use it as `selected_provider` and tell the user.

If multiple providers are detected, ask the user which provider kto should target for this repo.

Use AskUserQuestion with only detected providers as options:

- Anthropic API — direct Claude model IDs
- Amazon Bedrock — use runtime/provider-managed model by default (`inherit`)
- Google Vertex AI — use runtime/provider-managed model by default (`inherit`)
- Microsoft Foundry — use runtime/provider-managed model by default (`inherit`)
- OpenRouter — use runtime/provider-managed model by default (`inherit`)
- OpenAI / Codex — use runtime/provider-managed model by default (`inherit`)
- GLM / Z.AI — use runtime/provider-managed model by default (`inherit`)

Provider defaults:

- If `selected_provider === "anthropic"`:
  - `provider_default_agents = existing_config.agents || default_agents`
  - `provider_default_fallbacks = default_fallbacks`
- Otherwise:
  - `provider_default_agents.project_mapper = existing_config.agents?.project_mapper || "inherit"`
  - `provider_default_agents.graph_builder = existing_config.agents?.graph_builder || "inherit"`
  - `provider_default_agents.obsidian_sync = existing_config.agents?.obsidian_sync || "inherit"`
  - `provider_default_agents.change_detector = existing_config.agents?.change_detector || "inherit"`
  - `provider_default_fallbacks = default_fallbacks`

Explain briefly:

- Anthropic provider → kto can safely use explicit Claude model IDs.
- Non-Anthropic providers → recommend `inherit` so kto follows the current session/provider model instead of forcing Anthropic IDs.

## Step 4 — Model configuration (optional)

Ask: "Do you want to customize which LLM model each agent uses? (y/N)"

If yes, ask per-agent model with current defaults (Enter keeps existing value):
- Project Mapper (current: `{provider_default_agents.project_mapper}`) — cheap, runs on every file
- Graph Builder (current: `{provider_default_agents.graph_builder}`) — the reasoning agent, needs more capability
- Obsidian Sync (current: `{provider_default_agents.obsidian_sync}`) — templated writing
- Change Detector (current: `{provider_default_agents.change_detector}`) — fast, targeted

If `selected_provider !== "anthropic"`, tell the user:

- `inherit` is recommended unless they know the exact provider-native model IDs their runtime accepts.

Optionally ask whether they want to configure fallbacks too:

- "Do you want to set per-agent fallback models? (y/N)"

If yes, ask per-agent fallback values using current defaults from `provider_default_fallbacks`.
For non-Anthropic providers, suggest `inherit` as the safest fallback.

Store answers as:
- `final_agents.project_mapper`
- `final_agents.graph_builder`
- `final_agents.obsidian_sync`
- `final_agents.change_detector`
- `final_fallbacks.project_mapper?`
- `final_fallbacks.graph_builder?`
- `final_fallbacks.obsidian_sync?`
- `final_fallbacks.change_detector?`

If user chooses "No", set `final_agents = provider_default_agents`.

If fallback customization is skipped, set `final_fallbacks = provider_default_fallbacks`.

## Step 5 — Write config

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
  },
  "model_fallbacks": {
    ...only include agent fallback entries whose values are non-empty...
  }
}
```

This final JSON must use the computed `final_*` values (including model customizations), not hardcoded defaults.

Important:

- If any chosen agent model is `inherit`, write the literal string `"inherit"`.
- Do not write empty-string fallback entries.

## Step 6 — Add to .gitignore

Append `.kto/` and the configured output directory to `.gitignore` if not already present:

```bash
grep -q "^\.kto/" .gitignore 2>/dev/null || echo ".kto/" >> .gitignore
grep -q "^${final_output_dir}/" .gitignore 2>/dev/null || echo "${final_output_dir}/" >> .gitignore
```

## Step 7 — Confirm

Display a summary:
```
✓ kto initialized
  Config: .kto/config.json
  Provider: {selected_provider}
  Vault: {vault_path}
  Project: {project_id}
  Subfolder: {obsidian_subfolder}

Run /kto:analyze to perform the first full analysis.
```

</process>
