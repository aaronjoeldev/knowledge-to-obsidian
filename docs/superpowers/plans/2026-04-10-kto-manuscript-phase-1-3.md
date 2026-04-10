# KTO Manuscript Alignment — Phase 1-3 Team Implementation Plan


**Goal:** Move kto materially closer to the `gist.md` manuscript pattern by (1) sharpening kto as a codebase wiki, (2) introducing `index` / `log` / `lint` as first-class primitives, and (3) adding synthesis pages plus query writeback with clear guardrails.

**Architecture:** Treat the existing pipeline as the compiler for a persistent codebase wiki. Phase 1 defines the canonical wiki contract and page taxonomy. Phase 2 adds navigation, observability, and hygiene primitives (`index`, `log`, `lint`). Phase 3 layers synthesis and writeback on top of that stable base, with idempotent rules and auditability.

**Tech Stack:** TypeScript, vitest, markdown agent prompts, existing `KtoRunner`, Obsidian markdown vault output

---

## Non-Goals

- No embeddings / vector search in Phase 1-3
- No multi-repo or multi-vault federation
- No broad provider/runtime redesign
- No autonomous self-healing edit loops beyond explicit query writeback
- No separate web UI or dashboard project

---

## Phase Order and Hard Dependencies

1. **Phase 1 — Sharpen kto as a codebase wiki**
   - Hard dependency for everything else.
   - Must define canonical entities, page kinds, provenance/freshness expectations, and deterministic write targets.

2. **Phase 2 — Introduce `index`, `log`, and `lint`**
   - Depends on the canonical wiki contract from Phase 1.
   - Must exist before synthesis/writeback so the team has discoverability, diagnostics, and quality gates.

3. **Phase 3 — Add synthesis pages and query writeback**
   - Depends on both prior phases.
   - Must be idempotent, auditable, and constrained to explicit write targets.

---

## Parallelism Map

```text
Phase 1
  Track A: Knowledge contract + types + graph-builder prompt
  Track B: Obsidian page taxonomy + sync templates
  Track C: README / command language / tests

Phase 2
  Track A: Index generation contract
  Track B: Run log contract
  Track C: Lint agent + lint command + validations

Phase 3
  Track A: Synthesis page schema and templates
  Track B: Query command / runner integration
  Track C: Writeback rules, logging, regression tests
```

Recommended team split:

- **Engineer 1:** graph / types / prompt contract
- **Engineer 2:** sync templates / page layout / Obsidian structure
- **Engineer 3:** commands / runner integration / tests
- **Tech lead or reviewer:** phase gates, idempotency review, scope control

---

## Files

| File | Operation | Phase | Reason |
|---|---|---:|---|
| `README.md` | Modify | 1, 2, 3 | Reposition kto as a persistent codebase wiki and document new commands/workflows |
| `src/types.ts` | Modify | 1, 3 | Add/adjust wiki contract metadata and any synthesis-related fields |
| `src/index.ts` | Modify | 2, 3 | Expose runner support for `lint()` and `query()` workflows |
| `agents/kto-graph-builder.md` | Modify | 1 | Tighten semantic graph generation around wiki contract and provenance/freshness |
| `agents/kto-obsidian-sync.md` | Modify | 1, 2, 3 | Materialize deterministic page taxonomy, index/log pages, synthesis pages |
| `agents/kto-change-detector.md` | Modify | 2, 3 | Ensure incremental updates handle index/log/synthesis pages safely |
| `commands/kto/analyze.md` | Modify | 1, 2 | Reflect wiki-first output and index/log generation |
| `commands/kto/sync.md` | Modify | 1, 2 | Re-sync expanded page set, not just entity pages |
| `commands/kto/diff.md` | Modify | 2, 3 | Keep incremental path consistent with index/log/synthesis updates |
| `commands/kto/lint.md` | Create | 2 | Add first-class wiki health-check command |
| `agents/kto-wiki-lint.md` | Create | 2 | Deterministic lint pass over graph + markdown artifacts |
| `commands/kto/query.md` | Create | 3 | Query the wiki and optionally write back synthesis pages |
| `agents/kto-query-writer.md` | Create | 3 | Query + synthesis + safe writeback workflow |
| `tests/types.test.ts` | Modify | 1, 3 | Cover contract additions and synthesis metadata |
| `tests/index.test.ts` | Modify | 2, 3 | Cover runner methods and command-facing behaviors |
| `tests/knowledge-validator.test.ts` | Modify | 1, 2 | Validate enriched graph and lint assumptions |

---

## Phase 1 — Sharpen kto as a codebase wiki

### Objective

Make kto explicitly produce a **persistent codebase wiki**, not only a semantic code inventory.

### Deliverables

- Canonical wiki contract documented in code and README
- Deterministic page taxonomy for Obsidian output
- Provenance/freshness expectations defined
- Existing pipeline still passes tests and typecheck

### Task 1A — Define the canonical wiki contract

**Files:**
- Modify: `README.md`
- Modify: `src/types.ts`
- Modify: `tests/types.test.ts`

- [ ] **Step 1: Document the target wiki model in README**
  - Reframe kto terminology around:
    - raw extraction
    - compiled knowledge graph
    - persistent wiki pages
    - deterministic sync

- [ ] **Step 2: Tighten the TypeScript contract**
  - Add only the metadata needed to support a codebase wiki cleanly.
  - Candidate fields (add only if justified):
    - provenance/source references
    - freshness / last_verified_at
    - page kind / page target metadata
    - synthesis metadata for future Phase 3 compatibility

- [ ] **Step 3: Add type tests for new/updated contract rules**

- [ ] **Step 4: Keep the contract minimal**
  - Avoid turning Phase 1 into a full content-management schema.

### Task 1B — Define the deterministic page taxonomy

**Files:**
- Modify: `agents/kto-obsidian-sync.md`
- Modify: `commands/kto/analyze.md`
- Modify: `commands/kto/sync.md`

- [ ] **Step 1: Define first-class page kinds**
  - Minimum set:
    - overview
    - architecture
    - feature
    - module
    - third_party
    - security
    - operations

- [ ] **Step 2: Define deterministic write targets in the vault**
  - Example expectation:
    - `Overview.md`
    - `Architecture.md`
    - `Features/*.md`
    - `Code_Map/*.md`
    - `Third_Party/*.md`
    - `Security/*.md`
    - `Operations/*.md`

- [ ] **Step 3: Preserve the existing "do not overwrite user content outside AUTO-GENERATED blocks" rule**

- [ ] **Step 4: Update analyze/sync command descriptions to match the new wiki-first framing**

### Task 1C — Strengthen graph-builder semantics for wiki usefulness

**Files:**
- Modify: `agents/kto-graph-builder.md`
- Modify: `tests/knowledge-validator.test.ts`

- [ ] **Step 1: Require graph-builder output to support the page taxonomy from Task 1B**

- [ ] **Step 2: Add explicit provenance/freshness expectations where determinable from source**

- [ ] **Step 3: Ensure descriptions remain source-grounded and non-generic**

- [ ] **Step 4: Keep IDs stable and relations valid**

### Phase 1 Success Criteria

- [ ] kto is described and implemented as a persistent **codebase wiki**, not just a repo analyzer
- [ ] Page kinds and vault write targets are explicit and deterministic
- [ ] Graph output contains enough metadata to support future index/log/query work
- [ ] No regression in `analyze()`, `sync()`, or existing Obsidian safety rules
- [ ] `npm test` passes
- [ ] `npm run typecheck` passes

---

## Phase 2 — Introduce `index`, `log`, and `lint`

### Objective

Add the minimum primitives needed for navigation, observability, and wiki hygiene.

### Deliverables

- Generated `index` page(s)
- Append-only run log
- New `/kto:lint` command with deterministic output
- Incremental update story for these artifacts

### Task 2A — Add index generation

**Files:**
- Modify: `agents/kto-obsidian-sync.md`
- Modify: `commands/kto/analyze.md`
- Modify: `commands/kto/sync.md`
- Modify: `commands/kto/diff.md`

- [ ] **Step 1: Define the index contract**
  - Decide whether there is one global `index.md` or a small fixed set such as:
    - `Index.md`
    - `Features_Index.md`
    - `Modules_Index.md`
    - `Third_Party_Index.md`

- [ ] **Step 2: Make index generation deterministic**
  - Stable ordering
  - Short summaries
  - Link targets only to existing pages

- [ ] **Step 3: Define update behavior for `analyze`, `sync`, and `diff`**

### Task 2B — Add run logging

**Files:**
- Modify: `agents/kto-obsidian-sync.md`
- Modify: `src/index.ts`
- Modify: `README.md`

- [ ] **Step 1: Define a strict run-log format**
  - One append-only markdown file
  - Entries for:
    - analyze
    - diff
    - sync
    - lint
    - query/writeback (Phase 3)

- [ ] **Step 2: Make entries useful for diagnostics**
  - timestamp
  - operation
  - project id
  - counts / key outputs
  - warnings or skipped work where relevant

- [ ] **Step 3: Avoid prompt-noise or excessive verbosity**

### Task 2C — Add linting as a first-class workflow

**Files:**
- Create: `agents/kto-wiki-lint.md`
- Create: `commands/kto/lint.md`
- Modify: `src/index.ts`
- Modify: `README.md`
- Modify: `tests/index.test.ts`

- [ ] **Step 1: Create a dedicated lint agent**
  - Deterministic checks only
  - No speculative rewriting in Phase 2

- [ ] **Step 2: Define the lint rule set**
  - Minimum checks:
    - orphan pages
    - missing links to referenced entities
    - empty or placeholder descriptions
    - invalid relation targets
    - stale/missing index entries
    - missing required overview/security pages

- [ ] **Step 3: Add runner and command support**
  - `runner.lint()`
  - `/kto:lint`

- [ ] **Step 4: Decide output contract**
  - Human-readable summary
  - Machine-parseable severity buckets if feasible

### Task 2D — Keep the fast path healthy

**Files:**
- Modify: `agents/kto-change-detector.md`
- Modify: `commands/kto/diff.md`
- Modify: `tests/index.test.ts`

- [ ] **Step 1: Ensure `diff` updates index/log artifacts correctly**

- [ ] **Step 2: Ensure `diff` does not regenerate unrelated synthesis pages**

- [ ] **Step 3: Capture regression tests for incremental behavior**

### Phase 2 Success Criteria

- [ ] The wiki exposes a deterministic index contract
- [ ] Every run produces a diagnosable append-only log entry
- [ ] `/kto:lint` exists and checks real wiki health issues
- [ ] Incremental updates keep index/log artifacts coherent
- [ ] `npm test` passes
- [ ] `npm run typecheck` passes

---

## Phase 3 — Add synthesis pages and query writeback

### Objective

Allow the wiki to answer questions from existing pages and optionally persist valuable answers back into the vault as synthesis pages.

### Deliverables

- Query workflow over the wiki
- Synthesis page taxonomy
- Safe, idempotent writeback rules
- Audit trail for writeback actions

### Task 3A — Define synthesis page types

**Files:**
- Modify: `agents/kto-obsidian-sync.md`
- Modify: `README.md`
- Modify: `src/types.ts`
- Modify: `tests/types.test.ts`

- [ ] **Step 1: Define the allowed synthesis page kinds**
  - Recommended minimum set:
    - comparison
    - architecture_summary
    - security_review
    - open_questions
    - decision_note

- [ ] **Step 2: Define write targets and frontmatter**
  - Pages must be easy to locate and distinguish from entity pages.

- [ ] **Step 3: Define provenance rules**
  - A synthesis page must point back to the wiki pages or graph entities it was derived from.

### Task 3B — Add query command and runner integration

**Files:**
- Create: `agents/kto-query-writer.md`
- Create: `commands/kto/query.md`
- Modify: `src/index.ts`
- Modify: `tests/index.test.ts`

- [ ] **Step 1: Add a first-class query workflow**
  - Query reads the wiki/index first, then drills into relevant pages.

- [ ] **Step 2: Support two modes**
  - answer-only
  - answer + writeback

- [ ] **Step 3: Make the writeback path explicit and opt-in**

### Task 3C — Define writeback safety and idempotency

**Files:**
- Modify: `agents/kto-query-writer.md`
- Modify: `agents/kto-obsidian-sync.md`
- Modify: `README.md`
- Modify: `tests/index.test.ts`

- [ ] **Step 1: Define explicit writeback rules**
  - allowed folders
  - naming convention
  - frontmatter minimum
  - conflict behavior

- [ ] **Step 2: Guarantee idempotency**
  - Same question + same source state should not create duplicate pages.

- [ ] **Step 3: Guarantee auditability**
  - Every writeback must create a run-log entry.

- [ ] **Step 4: Keep user-authored content safe**
  - Continue respecting AUTO-GENERATED boundaries or equivalent writeback rules.

### Task 3D — Regression and smoke testing

**Files:**
- Modify: `tests/index.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Add tests for query + writeback behavior**

- [ ] **Step 2: Add smoke-test instructions for a real sample repo**

- [ ] **Step 3: Verify Phase 3 does not break `analyze`, `sync`, `diff`, or `lint`**

### Phase 3 Success Criteria

- [ ] kto can answer from the wiki rather than only re-analyzing raw repo structure
- [ ] Valuable answers can be written back as synthesis pages in a controlled, opt-in way
- [ ] Query writeback is idempotent and auditable
- [ ] Synthesis pages retain provenance to underlying wiki pages/entities
- [ ] Existing pipeline commands keep working without regressions
- [ ] `npm test` passes
- [ ] `npm run typecheck` passes

---

## Risks and Scope Traps

- **Phase 1 becomes too broad** by mixing schema redesign, prompt quality work, and UX polish into one bucket
- **Index/log/lint becomes three products** instead of one enabling infrastructure phase
- **Writeback lands before guardrails** and creates duplicates or unsafe page edits
- **Synthesis pages ship without provenance** and become hard to trust
- **Incremental updates regress** because new page kinds are not accounted for in `diff`
- **The plan turns into a feature wishlist** instead of a gated delivery plan with exits

---

## Phase Gates

### Gate after Phase 1

- [ ] Team agrees on canonical wiki contract
- [ ] Team agrees on page taxonomy and deterministic vault paths
- [ ] Existing analyze/sync flow remains stable

### Gate after Phase 2

- [ ] Team agrees index/log/lint are useful enough to support daily work
- [ ] `diff` handles the new artifacts without obvious regressions
- [ ] Lint output is actionable rather than noisy

### Gate after Phase 3

- [ ] Query workflow is useful on a real repo
- [ ] Writeback creates durable value without damaging vault hygiene
- [ ] The three phases together clearly move kto toward the manuscript pattern

---

## Validation Checklist

- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] Full `analyze()` smoke test on a sample repo
- [ ] `diff()` smoke test on a small code change
- [ ] `sync()` smoke test against an existing enriched graph
- [ ] `lint()` smoke test with at least one intentionally broken wiki case
- [ ] `query` smoke test in answer-only mode
- [ ] `query` smoke test in writeback mode

---

## Suggested Delivery Order

1. Merge Phase 1 first, end-to-end.
2. Merge Phase 2 second, with `lint` kept read-only.
3. Merge Phase 3 last, with writeback strictly opt-in on first release.

Do **not** start synthesis/writeback implementation before the team has signed off on the Phase 1 wiki contract and Phase 2 index/log/lint guardrails.
