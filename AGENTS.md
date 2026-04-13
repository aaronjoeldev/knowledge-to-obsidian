# kto Agent Guide

Canonical guidance for humans and AI agents working in this repository.

## Scope

### Read first

1. `README.md`
2. `GUARDRAILS.md`
3. `RUNBOOK.md`
4. `TESTING.md`
5. `CONTRIBUTING.md`

### Primary code surfaces

- `src/` — TypeScript API, config loading, validation, runner orchestration
- `bin/` — installer and init/provider helpers
- `agents/` — runtime agent contracts; these are product logic
- `commands/kto/` — slash-command workflows; these are product logic
- `tests/` — repo contracts and regression coverage

### Secondary/reference surfaces

- `docs/` — plans and design notes
- `briefing/` — reference material and historical context; read only when relevant to the task

## Working rules

1. **Treat prompt files as code.**
   Changes in `agents/*.md` and `commands/kto/*.md` can change runtime behavior and must be reviewed like source changes.

2. **Check the whole surface for behavior changes.**
   If a workflow changes, review the matching command, agent, TypeScript support code, and tests together.

3. **Prefer small, explicit diffs.**
   Do not combine standards work, feature work, and refactors unless required.

4. **Keep generated-content rules intact.**
   English-only generated markdown, stable page targets, and AUTO-GENERATED block safety are core product invariants.

5. **Use the existing toolchain.**
   Standard validation is:
   - `npm test`
   - `npm run typecheck`
   - `npm run build` when runtime/build behavior is affected

## Repo-specific expectations

- `.kto/config.json` is the authoritative runtime config for analyzed projects.
- `src/config.ts` is the source of truth for config validation.
- `src/knowledge-validator.ts` is the source of truth for graph/wiki contract validation.
- `bin/kto-tools.cjs` drives init-context/provider detection behavior.
- `README.md` must stay aligned with user-visible workflow changes.

## Off-limits

- Real `.env` values or secrets
- Real user vault contents
- Destructive git history operations without explicit approval
- Unrelated formatting-only repo churn

## Validation minimums

### Docs-only / standards-only changes

- Self-review for consistency and accuracy

### Behavior or contract changes

- `npm test`
- `npm run typecheck`

### Installer or command-surface changes

- `node bin/install.cjs --help`
- `node bin/kto-tools.cjs init-context "$PWD"`
