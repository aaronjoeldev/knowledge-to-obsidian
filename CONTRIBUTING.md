# Contributing — kto

## Local setup

```bash
npm install
npm test
npm run typecheck
```

## Repo surfaces

- `bin/` — installer and init helpers
- `src/` — TypeScript runtime, config, validation
- `agents/` — runtime agent contracts
- `commands/kto/` — slash-command workflows
- `tests/` — contract and regression coverage
- `README.md` — user-facing workflow and setup docs

## Contribution rules

1. Keep diffs focused.
2. Treat `agents/*.md` and `commands/kto/*.md` as executable behavior.
3. When changing user-visible behavior, update docs and tests in the same batch.
4. Prefer additive changes over broad rewrites.
5. Do not commit generated project artifacts, secrets, or local runtime state.

## Pull request expectations

State which surface changed:

- installer
- init/provider detection
- runner/pipeline
- prompt contract
- validation/schema
- docs only

Also include:

- what changed
- why it changed
- how it was validated

## Do not commit

- `.env*` with real values
- `.kto/` runtime artifacts from analyzed projects
- `node_modules/`
- `dist/`

## Compatibility reminder

Keep Claude Code and OpenCode workflows aligned where the repo already supports both:

- Claude Code: `/kto:*`
- OpenCode: `/kto-*`
