# Guardrails — kto

Safety rules for contributors and AI agents working on kto.

## Non-negotiables

1. **`.kto/config.json` is authoritative.**
   Use it as the runtime source of truth for `vault_path`, `provider`, `output_dir`, and agent model settings.

2. **`output_dir` must remain relative.**
   Do not introduce absolute paths or `..` traversal into generated artifact locations.

3. **Generated markdown must be English-only.**
   This includes headings, placeholders, labels, summaries, and template text.

4. **Only AUTO-GENERATED blocks may be overwritten.**
   User-authored content outside those markers is off-limits.

5. **Core pages are mandatory.**
   `Overview.md`, `Architecture.md`, `Index.md`, and `Run_Log.md` are first-class artifacts, not optional extras.

6. **Never read real `.env` contents.**
   Existence is acceptable; values are not.

7. **Writeback must stay explicit.**
   Query/writeback flows need an explicit target and auditable behavior.

8. **Preserve determinism.**
   Stable IDs, stable page targets, and minimal regeneration are preferred over broad rewrites.

## Sharp edges to keep in mind

- `src/config.ts` supports six agent slots, while `bin/kto-tools.cjs` currently seeds defaults for four slots.
- Prompt files are easy to mistake for docs; in this repo they are runtime contracts.
- Tests intentionally enforce English-only generated output and mandatory core page behavior.

## Escalate before proceeding when

- A change would weaken AUTO-GENERATED block safety
- A change would alter the mandatory core-page contract
- A change would broaden writeback scope without explicit user intent
- A change introduces a new workflow surface without tests or documentation updates
