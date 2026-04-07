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
1. kto-project-mapper → `.kto/knowledge.json`
2. kto-graph-builder → `.kto/enriched_knowledge.json`
3. kto-obsidian-sync → Obsidian vault notes
</objective>

<pre_check>
Before starting, verify:

```bash
cat .kto/config.json 2>/dev/null || echo "NO_CONFIG"
```

If NO_CONFIG: Stop and tell the user: "kto is not initialized. Run /kto:init first."

If `vault_path` is empty in config: Stop and tell the user: "vault_path is not set. Run /kto:init to configure."
</pre_check>

<execution>

## Phase 1 — Project Mapper

Spawn the `kto-project-mapper` agent with the current working directory as input.

The agent writes `.kto/knowledge.json`.

Verify:
```bash
test -f .kto/knowledge.json && echo "OK" || echo "FAILED"
```

If FAILED: Report error and stop. Do not proceed to Phase 2.

## Phase 2 — Graph Builder

Spawn the `kto-graph-builder` agent.

The agent reads `.kto/knowledge.json` and writes `.kto/enriched_knowledge.json`.

Verify:
```bash
test -f .kto/enriched_knowledge.json && echo "OK" || echo "FAILED"
```

## Phase 3 — Obsidian Sync

Spawn the `kto-obsidian-sync` agent.

The agent reads `.kto/enriched_knowledge.json` and writes notes to the vault.

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
