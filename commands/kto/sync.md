---
name: kto:sync
description: Re-sync the Obsidian vault from existing .kto/enriched_knowledge.json without re-analyzing the codebase. Use when you've manually edited enriched_knowledge.json or when the vault was accidentally modified.
allowed-tools:
  - Read
  - Write
  - Bash
  - Agent
---

<objective>
Run only the Obsidian Sync phase of the kto pipeline using the already-existing `.kto/enriched_knowledge.json`. Does NOT re-scan the codebase.
</objective>

<pre_check>
```bash
test -f .kto/enriched_knowledge.json && echo "OK" || echo "MISSING"
cat .kto/config.json 2>/dev/null || echo "NO_CONFIG"
```

If MISSING: "enriched_knowledge.json not found. Run /kto:analyze first."
If NO_CONFIG: "kto is not initialized. Run /kto:init first."
</pre_check>

<execution>
Spawn the `kto-obsidian-sync` agent.

The agent reads `.kto/enriched_knowledge.json` and `.kto/config.json` and writes/updates all notes.
</execution>

<completion>
Report:
```
✓ Vault sync complete
  Notes written/updated: {count}
  Vault: {vault_path}/{obsidian_subfolder}
```
</completion>
