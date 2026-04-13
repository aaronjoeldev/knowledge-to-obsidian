---
name: kto:query
description: Query the persistent codebase wiki and optionally perform deterministic, auditable writeback when explicitly enabled.
allowed-tools:
  - Read
  - Write
  - Bash
  - Agent
---

<objective>
Answer user questions from wiki artifacts (`{output_dir}/enriched_knowledge.json` + vault pages). Writeback is opt-in only.
</objective>

<arguments>
- Required: natural language query
- Optional flags:
  - `--writeback=true|false` (default: false)
  - `--target=<relative_page_path>` (required only when writeback=true)
  - `--kind=<synthesis_kind>` (optional, defaults to 'open_questions'; one of: comparison, architecture_summary, security_review, open_questions, decision_note)
</arguments>

<pre_check>
```bash
test -f .kto/config.json && echo "CONFIG_OK" || echo "NO_CONFIG"
OUTPUT_DIR=$(node -e "const fs=require('fs');const raw=fs.readFileSync('.kto/config.json','utf8');let c;try{c=JSON.parse(raw)}catch(err){console.error('CONFIG_PARSE_ERROR: '+(err&&err.message?err.message:String(err)));process.exit(2)}const out=(typeof c.output_dir==='string'&&c.output_dir.trim()!=='')?c.output_dir.trim():'.kto';process.stdout.write(out)")
test -f "$OUTPUT_DIR/enriched_knowledge.json" && echo "OK" || echo "MISSING"
```

If MISSING: "enriched_knowledge.json not found. Run /kto:analyze first."
If NO_CONFIG: "kto is not initialized. Run /kto:init first."
If config parsing fails: ".kto/config.json is invalid JSON. Fix it or run /kto:init to rewrite it."
</pre_check>

<execution>
Spawn `kto-query-writer` with:
- user query
- writeback mode (`false` by default)
- optional target page (required when writeback=true, must be under `Synthesis/`)
- optional kind (defaults to 'open_questions' when writeback=true)

Rules:
- If writeback=false: read-only answer with source references.
- If writeback=true:
  - Require explicit target under `Synthesis/` directory
  - Validate target has `type: synthesis` frontmatter
  - Compute stable identity via `identity_key = hash(kind + query_hash + page_target)`
  - If page exists with matching identity_key and content_hash → noop
  - Else → create/update page with deterministic template
  - Append deterministic audit entry to `Run_Log.md`
- Generated wiki writeback content is always English, regardless of user language.
</execution>

<completion>
Report:
```text
✓ Query complete
  Mode: {read-only|writeback}
  Sources used: {count}
  Target updated: {target_or_none}
```
</completion>
