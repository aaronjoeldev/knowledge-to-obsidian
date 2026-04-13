# Runbook — kto

Operational commands and debugging shortcuts for this repository.

## Prerequisites

- Node.js `>=18`
- `npm install`

## Baseline validation

```bash
npm test
npm run typecheck
```

Optional when build/runtime behavior changed:

```bash
npm run build
```

## Installer and init smoke checks

```bash
node bin/install.cjs --help
node bin/kto-tools.cjs detect-providers
node bin/kto-tools.cjs init-context "$PWD"
```

## Debug by surface

### Installer / runtime asset installation

- Entry: `bin/install.cjs`
- Use when command/agent installation or path resolution looks wrong

### Init / provider detection

- Entry: `bin/kto-tools.cjs`
- Check detected providers, default config shaping, and current directory assumptions

### Config loading and validation

- Entry: `src/config.ts`
- Check `vault_path`, `output_dir`, provider values, and agent model fields

### Pipeline orchestration

- Entry: `src/index.ts`
- Check analyze/diff/sync/lint/query runner behavior and model validation flow

### Prompt/command contract issues

- `agents/*.md`
- `commands/kto/*.md`

### Wiki contract issues

- `src/knowledge-validator.ts`
- `agents/kto-obsidian-sync.md`
- `agents/kto-wiki-lint.md`

## Common failure buckets

### Init/config problems

- `.kto/config.json` missing or invalid
- `vault_path` empty
- `output_dir` invalid
- provider/model mismatch

### Invalid graph or wiki metadata

- inspect `src/knowledge-validator.ts`
- run relevant validator tests

### Broken core page generation

- inspect `agents/kto-obsidian-sync.md`
- inspect `agents/kto-wiki-lint.md`
- check core-page and English-only tests

### Provider/runtime oddities

- compare `src/config.ts` agent slots with `bin/kto-tools.cjs` defaults
- confirm whether `inherit` is intended for the selected provider
