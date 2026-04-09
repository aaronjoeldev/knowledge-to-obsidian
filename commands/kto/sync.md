---
name: kto:sync
description: Re-sync the Obsidian vault from existing {output_dir}/enriched_knowledge.json without re-analyzing the codebase. Use when you've manually edited enriched_knowledge.json or when the vault was accidentally modified.
allowed-tools:
  - Read
  - Write
  - Bash
  - Agent
---

<objective>
Run only the Obsidian Sync phase of the kto pipeline using the already-existing `{output_dir}/enriched_knowledge.json`. Does NOT re-scan the codebase.
</objective>

<pre_check>
```bash
test -f .kto/config.json && echo "CONFIG_OK" || echo "NO_CONFIG"
OUTPUT_DIR=$(node -e "const fs=require('fs');const raw=fs.readFileSync('.kto/config.json','utf8');let c;try{c=JSON.parse(raw)}catch(err){console.error('CONFIG_PARSE_ERROR: '+(err&&err.message?err.message:String(err)));process.exit(2)}const out=(typeof c.output_dir==='string'&&c.output_dir.trim()!=='')?c.output_dir.trim():'.kto';process.stdout.write(out)")
test -f "$OUTPUT_DIR/enriched_knowledge.json" && echo "OK" || echo "MISSING"
```

If MISSING: "enriched_knowledge.json not found. Run /kto:analyze first."
If NO_CONFIG: "kto is not initialized. Run /kto:init first."
If config parsing fails: ".kto/config.json is invalid JSON. Fix it or run /kto:init to rewrite it."

Treat `.kto/config.json` as authoritative and use `output_dir` for generated file locations.
</pre_check>

<execution>
Spawn the `kto-obsidian-sync` agent.

The agent reads `{output_dir}/enriched_knowledge.json` and `.kto/config.json` and writes/updates all notes.
</execution>

<completion>
Report:
```
✓ Vault sync complete
  Notes written/updated: {count}
  Vault: {vault_path}/{obsidian_subfolder}
```
</completion>
