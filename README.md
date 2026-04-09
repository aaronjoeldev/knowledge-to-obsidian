# kto — Knowledge to Obsidian

Turn a code repository into a structured Obsidian knowledge base.

kto installs runtime commands/agents for **Claude Code** and **OpenCode**. Inside a project, it uses `.kto/config.json` to analyze your codebase, build a knowledge graph, and sync markdown notes into your Obsidian vault.

## What this tool is

kto provides a 3-step pipeline:

1. **Project Mapper** → scans repository structure into `{output_dir}/knowledge.json`
2. **Graph Builder** → builds semantic graph into `{output_dir}/enriched_knowledge.json`
3. **Obsidian Sync** → writes/updates notes in your vault

For day-to-day updates, it also provides a **Change Detector** fast path (`diff`) that updates only affected entities.

## Requirements

- Node.js **>= 18**
- Claude Code and/or OpenCode
- A local Obsidian vault path (absolute path)
- Git recommended for incremental diff detection

## Installation

### Recommended (npx)

```bash
npx kto-cc@latest
```

Flags:

- `--claude` (Claude Code only)
- `--opencode` (OpenCode only)
- `--both` / `--all`
- `--global` / `-g`
- `--local` / `-l`
- `--uninstall` / `-u`
- `--help` / `-h`

Examples:

```bash
# Claude Code globally
npx kto-cc@latest --claude --global

# OpenCode globally
npx kto-cc@latest --opencode --global

# Both globally
npx kto-cc@latest --both --global
```

### Alternative (curl installer)

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/aaronjoeldev/knowledge-to-obsidian/main/install.sh)
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

When to use what:

- **analyze**: first run, large refactors, or when you need a clean rebuild
- **diff**: regular development after code changes
- **sync**: regenerate vault notes from existing `enriched_knowledge.json` only

## Configuration reference (`.kto/config.json`)

Canonical shape:

```json
{
  "vault_path": "/absolute/path/to/vault",
  "project_id": "MY-PROJECT",
  "obsidian_subfolder": "Projects/MY-PROJECT",
  "output_dir": ".kto",
  "agents": {
    "project_mapper": "claude-haiku-4-5-20251001",
    "graph_builder": "claude-sonnet-4-6",
    "obsidian_sync": "claude-haiku-4-5-20251001",
    "change_detector": "claude-haiku-4-5-20251001"
  }
}
```

Defaults (if fields are omitted by config loading):

- `vault_path`: `""`
- `project_id`: `"PROJECT"`
- `obsidian_subfolder`: `"Projects/PROJECT"`
- `output_dir`: `".kto"`
- agent model defaults as shown above

Validation rules (from runtime config loader):

- `vault_path`: string; if set, must be an **absolute path**
- `project_id`: non-empty string
- `obsidian_subfolder`: non-empty string
- `output_dir`: non-empty **relative** path, must not be absolute, must not contain `..`
- each `agents.*`: non-empty string

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

- `new KtoRunner({ projectDir, modelOverrides? })`
- `runner.analyze()`
- `runner.diff(changedFiles)`
- `runner.sync()`

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
```

## Agent/model selection behavior

There are 4 model slots in config:

- `project_mapper`
- `graph_builder`
- `obsidian_sync`
- `change_detector`

Important distinction:

- **Programmatic API (`KtoRunner`)**: per-agent model assignment is reliably enforced (`config.agents` + `modelOverrides`).
- **Slash commands (`/kto:*`, `/kto-*`)**: model enforcement depends on host/runtime capabilities. Treat config as your intended project-level target, but do not assume hard enforcement in every host.

## Output files and Obsidian vault structure

Repository artifacts:

- `{output_dir}/knowledge.json` (raw structure)
- `{output_dir}/enriched_knowledge.json` (semantic graph)

Vault output root:

- `{vault_path}/{obsidian_subfolder}`

Expected structure:

```text
{obsidian_subfolder}/
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
  - OpenCode commands are installed as `/kto-init`, `/kto-analyze`, `/kto-diff`, `/kto-sync` (hyphen form).

## Development notes

- Core config types/validation: `src/config.ts`
- Programmatic API runner: `src/index.ts`
- Slash command definitions: `commands/kto/*.md`
- Agent definitions: `agents/*.md`
