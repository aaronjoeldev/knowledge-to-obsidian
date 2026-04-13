# Testing — kto

## Canonical commands

```bash
npm test
npm run test:coverage
npm run typecheck
npm run build
```

## Minimum gate for behavior changes

```bash
npm test && npm run typecheck
```

## What to run by change type

### `agents/` or `commands/kto/`

- `npm test`
- Pay attention to:
  - `tests/core-pages-navigation.test.ts`
  - `tests/english-only-generated-content.test.ts`
  - `tests/index.test.ts`

### Config / init / provider logic

- `npm test`
- Pay attention to:
  - `tests/config.test.ts`
  - `tests/kto-tools.test.ts`

### Types / validator / schema changes

- `npm test`
- Pay attention to:
  - `tests/types.test.ts`
  - `tests/knowledge-validator.test.ts`
  - `tests/index.test.ts`

### Installer or command-surface changes

- `npm test`
- `node bin/install.cjs --help`

## Notes

- There is currently no ESLint/Prettier gate in the repo.
- Coverage is useful for riskier refactors but is not the default requirement for every small change.
- Prompt markdown and command markdown are product logic; do not treat them as docs-only changes.
