# Claude Notes for kto

See `AGENTS.md` for the canonical repo guidance.

## Read order

1. `AGENTS.md`
2. `GUARDRAILS.md`
3. `README.md`
4. `RUNBOOK.md`
5. `TESTING.md`

## Important repo truths

- Prompt markdown under `agents/` and `commands/kto/` is executable product behavior.
- Generated markdown must remain English-only.
- Only AUTO-GENERATED blocks may be overwritten in synced vault notes.
- `.kto/config.json` is authoritative for runtime config.
- The four core pages are mandatory: `Overview.md`, `Architecture.md`, `Index.md`, `Run_Log.md`.

## Validation baseline

- `npm test`
- `npm run typecheck`
- `npm run build` when runtime/build behavior changes

## When touching specific areas

- `src/config.ts` or init behavior → also inspect `bin/kto-tools.cjs` and config tests
- `agents/` or `commands/` → also inspect tests covering core pages, English-only defaults, and runner behavior
- `README.md` → keep command names and workflows aligned with actual repo behavior
