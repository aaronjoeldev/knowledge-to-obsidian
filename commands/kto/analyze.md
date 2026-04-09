---
name: kto:analyze
description: Run the full kto pipeline — Project Mapper → Graph Builder → Obsidian Sync. Analyzes the entire codebase and writes all knowledge to the Obsidian vault. Use /kto:diff for incremental updates after code changes.
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Agent
---

<objective>
Execute the full kto three-agent pipeline for the current project:
1. kto-project-mapper → `{output_dir}/knowledge.json`
2. kto-graph-builder → `{output_dir}/enriched_knowledge.json`
3. kto-obsidian-sync → Obsidian vault notes
</objective>

<pre_check>
Before starting, verify:

```bash
test -f .kto/config.json && echo "CONFIG_OK" || echo "NO_CONFIG"
OUTPUT_DIR=$(node -e "const fs=require('fs');const raw=fs.readFileSync('.kto/config.json','utf8');let c;try{c=JSON.parse(raw)}catch(err){console.error('CONFIG_PARSE_ERROR: '+(err&&err.message?err.message:String(err)));process.exit(2)}const out=(typeof c.output_dir==='string'&&c.output_dir.trim()!=='')?c.output_dir.trim():'.kto';process.stdout.write(out)")
```

If NO_CONFIG: Stop and tell the user: "kto is not initialized. Run /kto:init first."

If config parsing fails: Stop and tell the user: ".kto/config.json is invalid JSON. Fix it or run /kto:init to rewrite it."

If `vault_path` is empty in config: Stop and tell the user: "vault_path is not set. Run /kto:init to configure."

Use `.kto/config.json` as the authoritative project config. Use `output_dir` from config (fallback `.kto`) for all generated JSON paths.
</pre_check>

<execution>

## Phase 1 — Project Mapper

Spawn the `kto-project-mapper` agent with the current working directory as input.

The agent writes `{output_dir}/knowledge.json`.

Verify:
```bash
test -f "$OUTPUT_DIR/knowledge.json" && echo "OK" || echo "FAILED"
```

If FAILED: Report error and stop. Do not proceed to Phase 2.

## Phase 2 — Graph Builder

Spawn the `kto-graph-builder` agent.

The agent reads `{output_dir}/knowledge.json` and writes `{output_dir}/enriched_knowledge.json`.

Verify:
```bash
test -f "$OUTPUT_DIR/enriched_knowledge.json" && echo "OK" || echo "FAILED"
```

## Phase 3 — Obsidian Sync

Spawn the `kto-obsidian-sync` agent.

The agent reads `{output_dir}/enriched_knowledge.json` and writes notes to the vault.

</execution>

<completion>
Report to the user:

```
✓ kto analysis complete

  knowledge.json: {file_count} files scanned
  enriched_knowledge.json: {feature_count} features, {module_count} modules, {third_party_count} third parties
  Obsidian vault: {notes_written} notes written/updated at {vault_path}/{obsidian_subfolder}

Run /kto:diff after future code changes for fast incremental updates.
```
</completion>
