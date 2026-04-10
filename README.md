# kto — Knowledge to Obsidian

Turn a code repository into a persistent, auditable Obsidian wiki for your codebase.

kto installs runtime commands/agents for **Claude Code** and **OpenCode**. Inside a project, it uses `.kto/config.json` to run a deterministic wiki pipeline: analyze your codebase, build a knowledge graph, sync markdown pages, keep index/run-log coherence, and support query-driven writeback when explicitly enabled.

## What this tool is

kto provides a 3-phase wiki pipeline:

1. **Analyze (Mapper + Graph Builder)** → scans source and builds `{output_dir}/knowledge.json` + `{output_dir}/enriched_knowledge.json`
2. **Sync/Lint** → updates vault pages (including mandatory Overview/Architecture/Index/Run_Log core pages) and validates wiki coherence (missing core pages or missing root-note links in `Index.md` are blocking lint errors)
3. **Query (opt-in writeback)** → generates deterministic answers from the wiki and optionally writes audited updates

For day-to-day updates, it also provides a **Change Detector** fast path (`diff`) that updates only affected entities while keeping index/log consistency and avoiding unnecessary synthesis-page regeneration.

## Requirements

- Node.js **>= 18**
- Claude Code and/or OpenCode
- A local Obsidian vault path (absolute path)
- Git recommended for incremental diff detection

## Installation

### Recommended (curl installer)

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/aaronjoeldev/knowledge-to-obsidian/main/install.sh)
```

Flags:

- Interactive installer prompts for runtime and location.
- Run `bash <(curl -fsSL ... ) -- --help` to view installer flags.

Examples:

```bash
# Claude Code globally
bash <(curl -fsSL https://raw.githubusercontent.com/aaronjoeldev/knowledge-to-obsidian/main/install.sh) -- --claude --global

# OpenCode globally
bash <(curl -fsSL https://raw.githubusercontent.com/aaronjoeldev/knowledge-to-obsidian/main/install.sh) -- --opencode --global

# Both globally
bash <(curl -fsSL https://raw.githubusercontent.com/aaronjoeldev/knowledge-to-obsidian/main/install.sh) -- --both --global
```

### Alternative (manual from GitHub)

Clone the repository and run the installer directly:

```bash
git clone https://github.com/aaronjoeldev/knowledge-to-obsidian.git
cd knowledge-to-obsidian
node bin/install.cjs
```

Common manual examples:

```bash
# Claude Code globally
node bin/install.cjs --claude --global

# OpenCode globally
node bin/install.cjs --opencode --global

# Both globally
node bin/install.cjs --both --global
```

## What gets installed

### Claude Code

- `~/.claude/kto/agents/*`
- `~/.claude/kto/commands/*`
- `~/.claude/commands/kto/*` (for slash-command discovery)

### OpenCode

- `~/.config/opencode/agents/*` (converted agent files)
- `~/.config/opencode/commands/kto-*.md` (converted command files)

OpenCode global config path resolution:

1. `$OPENCODE_CONFIG_DIR`
2. `$XDG_CONFIG_HOME/opencode`
3. `~/.config/opencode`

## Quick start

In your target repository:

1. Run initialization:
   - Claude Code: `/kto:init`
   - OpenCode: `/kto-init`
2. Provide:
   - absolute `vault_path`
   - stable `project_id`
   - `obsidian_subfolder`
   - `output_dir` (where JSON artifacts are stored)
   - optional per-agent model overrides
3. Run first full analysis:
   - Claude Code: `/kto:analyze`
   - OpenCode: `/kto-analyze`

Generated in your repo (default layout):

```text
.kto/
  config.json
  knowledge.json
  enriched_knowledge.json
```

> `.kto/config.json` is the **authoritative config source** used by commands and agents.
> The graph artifacts live under `output_dir` (default: `.kto`).

## Slash commands and daily workflow

Claude Code command names use `:`. OpenCode uses `-`.

| Purpose | Claude Code | OpenCode |
|---|---|---|
| Initialize project | `/kto:init` | `/kto-init` |
| Full analysis pipeline | `/kto:analyze` | `/kto-analyze` |
| Incremental update | `/kto:diff [files...]` | `/kto-diff [files...]` |
| Vault sync from existing graph | `/kto:sync` | `/kto-sync` |
| Wiki lint/coherence check | `/kto:lint` | `/kto-lint` |
| Query wiki (+ optional writeback) | `/kto:query "question"` | `/kto-query "question"` |

When to use what:

- **analyze**: first run, large refactors, or when you need a clean rebuild
- **diff**: regular development after code changes
- **sync**: regenerate vault notes from existing `enriched_knowledge.json` only
- **lint**: validate wiki consistency (links/index/run-log/coherence) before or after sync
- **query**: answer questions from wiki artifacts; writeback is explicit opt-in only

`/kto:init` now uses a code-backed helper (`bin/kto-tools.cjs`) to detect provider signals and build defaults. It always shows the full provider picker, with detected/recommended options surfaced first. If you pick a non-Anthropic provider (Bedrock, Vertex, Foundry, OpenRouter, OpenAI/Codex, GLM/Z.AI), the safest default is usually `"inherit"` so kto follows the current runtime/provider model instead of forcing Anthropic model IDs.

Currently recognized provider signals during init include:

- **Anthropic** — `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`
- **Bedrock** — `CLAUDE_CODE_USE_BEDROCK`, `ANTHROPIC_BEDROCK_BASE_URL`, `AWS_BEARER_TOKEN_BEDROCK`
- **Vertex AI** — `CLAUDE_CODE_USE_VERTEX`, `ANTHROPIC_VERTEX_PROJECT_ID`, `ANTHROPIC_VERTEX_BASE_URL`
- **Foundry** — `ANTHROPIC_FOUNDRY_API_KEY`, `ANTHROPIC_FOUNDRY_API_ENDPOINT`, `ANTHROPIC_FOUNDRY_MODEL`
- **OpenRouter** — `OPENROUTER_API_KEY`
- **OpenAI / Codex** — `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `CODEX_PROVIDER`, `CODEX_MODEL`, `CODEX_HOME`
- **GLM / Z.AI** — `Z_AI_API_KEY`, `GLM_API_KEY`, `GLM_BASE_URL`, `GLM_MODEL`, `GLM_DELEGATOR_CONFIG`

If multiple providers are detected, `/kto:init` lets you choose which one this repo should target.

## Configuration reference (`.kto/config.json`)

Canonical shape:

```json
{
  "vault_path": "/absolute/path/to/vault",
  "provider": "anthropic",
  "project_id": "MY-PROJECT",
  "obsidian_subfolder": "Projects/MY-PROJECT",
  "output_dir": ".kto",
  "agents": {
    "project_mapper": "claude-haiku-4-5-20251001",
    "graph_builder": "claude-sonnet-4-6",
    "obsidian_sync": "claude-haiku-4-5-20251001",
    "change_detector": "claude-haiku-4-5-20251001",
    "wiki_lint": "claude-haiku-4-5-20251001",
    "query_writer": "claude-haiku-4-5-20251001"
  },
  "model_fallbacks": {
    "graph_builder": "inherit"
  }
}
```

Defaults (if fields are omitted by config loading):

- `vault_path`: `""`
- `provider`: `"anthropic"`
- `project_id`: `"PROJECT"`
- `obsidian_subfolder`: `"Projects/PROJECT"`
- `output_dir`: `".kto"`
- agent model defaults as shown above
- `model_fallbacks`: `{}`

Validation rules (from runtime config loader):

- `vault_path`: string; if set, must be an **absolute path**
- `provider`: one of `anthropic`, `bedrock`, `vertex`, `foundry`, `openrouter`, `openai/codex`, `glm`
- `project_id`: non-empty string
- `obsidian_subfolder`: non-empty string
- `output_dir`: non-empty **relative** path, must not be absolute, must not contain `..`
- each `agents.*`: non-empty string
- `model_fallbacks`: object; each provided `model_fallbacks.*` must be a non-empty string

`agents.*` and `model_fallbacks.*` may also be set to `"inherit"`. In that case, kto does not force a specific model ID and instead lets the current host/runtime/provider decide which model to use.

This is especially useful for:

- Claude Code sessions routed through Bedrock, Vertex, Foundry, or OpenRouter
- Codex / OpenAI-based workflows
- GLM / Z.AI or other Anthropic-compatible gateways

### Model availability preflight and fallback

- `KtoRunner` now validates configured agent models before the pipeline starts.
- If a primary model fails due to invalid model ID, missing authentication, or provider/account access issues, kto raises a clearer error before doing pipeline work.
- You can configure optional per-agent fallbacks in `model_fallbacks`.
- If a fallback model is set and passes validation, kto uses it automatically for that run.
- If a model or fallback is set to `inherit`, kto skips explicit model validation for that slot and lets the current host/provider resolve the model.
- `modelOverrides` still win; when you override an agent model programmatically, config-based fallback is not applied to that override.
- If you need the old behavior, construct `new KtoRunner({ projectDir, skipModelValidation: true })`.

### `output_dir` behavior

- `output_dir` is resolved relative to the project root.
- `knowledge.json` and `enriched_knowledge.json` are read/written under that directory.
- Commands, agents, and the programmatic runner derive artifact paths from this value.
- Invalid config should be fixed instead of relying on fallback behavior.

## Embedding into your own workflow

You can use kto in two ways:

1. **Slash commands** inside Claude Code or OpenCode for interactive use
2. **Programmatic API** via `KtoRunner` if you want to call the pipeline from your own scripts or tools

Typical embedding cases:

- run a full analysis after project setup
- trigger `diff()` from your own automation after file changes
- regenerate vault notes from existing graph data with `sync()`
- supply model overrides from your own wrapper script

## Programmatic API (embedding)

`src/index.ts` exports a programmatic runner:

- `new KtoRunner({ projectDir, modelOverrides?, skipModelValidation? })`
- `runner.analyze()`
- `runner.diff(changedFiles)`
- `runner.sync()`
- `runner.lint()`
- `runner.queryWiki(question, { writeback?, targetPath? })`

Example:

```ts
import { KtoRunner } from 'kto-cc';

const runner = new KtoRunner({
  projectDir: '/absolute/path/to/repo',
  modelOverrides: {
    graph_builder: 'claude-sonnet-4-6'
    // also supports agent names like "kto-graph-builder"
  }
});

const result = await runner.analyze();
if (!result.success) {
  console.error(result.error);
}

const queryResult = await runner.queryWiki('Summarize the authentication flow');
if (!queryResult.success) {
  console.error(queryResult.error);
}
```

## Agent/model selection behavior

There are 6 model slots in config:

- `project_mapper`
- `graph_builder`
- `obsidian_sync`
- `change_detector`
- `wiki_lint`
- `query_writer`

Important distinction:

- **Programmatic API (`KtoRunner`)**: per-agent model assignment is reliably enforced (`config.agents` + `modelOverrides`).
- **Slash commands (`/kto:*`, `/kto-*`)**: model enforcement depends on host/runtime capabilities. Treat config as your intended project-level target, but do not assume hard enforcement in every host.

## Output files and Obsidian vault structure

Repository artifacts:

- `{output_dir}/knowledge.json` (raw structure)
- `{output_dir}/enriched_knowledge.json` (semantic graph)

`knowledge.json` is intended to describe the actual project source tree, not dependency or build noise. By default, kto excludes common generated and dependency directories such as `node_modules/`, `.git/`, `.next/`, `.nuxt/`, `.svelte-kit/`, `.turbo/`, `.cache/`, `.parcel-cache/`, `.vercel/`, `vendor/`, `target/`, `out/`, `dist/`, `build/`, `coverage/`, `generated/`, `__generated__/`, and `{output_dir}/`.

Vault output root:

- `{vault_path}/{obsidian_subfolder}`

Expected structure:

```text
{obsidian_subfolder}/
  Overview.md
  Architecture.md
  Index.md
  Facts.md
  Technology.md
  Features/
    Features_Index.md
    FEAT-*.md
  Code_Map/
    Modules_Index.md
    MODULE-*.md
  Third_Party/
    THIRD-*.md
  Security/
    Security_Overview.md
  Operations/
    Run_Log.md
```

Sync safety model:

- kto manages content inside `<!-- AUTO-GENERATED START --> ... <!-- AUTO-GENERATED END -->`
- user content outside these blocks is preserved

## Troubleshooting

- **"kto is not initialized. Run /kto:init first."**
  - Run init in the repository root to create `.kto/config.json`.

- **Invalid `.kto/config.json` JSON**
  - Fix JSON manually or rerun init to rewrite.

- **`vault_path` missing / empty**
  - Set it in `.kto/config.json` or rerun init.

- **`enriched_knowledge.json` missing for diff/sync**
  - Run analyze first.

- **Unexpected artifact location**
  - Check `.kto/config.json -> output_dir`; all JSON artifacts follow this setting.

- **OpenCode command not found**
  - OpenCode commands are installed as `/kto-init`, `/kto-analyze`, `/kto-diff`, `/kto-sync`, `/kto-lint`, `/kto-query` (hyphen form).

## Development notes

- Core config types/validation: `src/config.ts`
- Programmatic API runner: `src/index.ts`
- Slash command definitions: `commands/kto/*.md`
- Agent definitions: `agents/*.md`
