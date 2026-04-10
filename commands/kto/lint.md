---
name: kto:lint
description: Validate wiki coherence for the persistent codebase wiki (links, index integrity, run-log freshness, and page-target consistency) using existing graph artifacts.
allowed-tools:
  - Read
  - Write
  - Bash
  - Agent
---

<objective>
Run wiki-quality checks without re-analyzing source code. This validates whether the Obsidian wiki is coherent with `{output_dir}/enriched_knowledge.json`.
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
</pre_check>

<execution>
Spawn `kto-wiki-lint`.

The agent must validate:
- core pages exist and are coherent (`Overview.md`, `Architecture.md`, `Index.md`, `Run_Log.md`)
- index links point to existing generated pages
- entity `wiki.page_target` values align with actual vault paths
- run-log has deterministic, append-only entries
- synthesis pages are not being rewritten without input change signals
</execution>

<completion>
Report:
```text
✓ Wiki lint complete
  Status: {pass_or_fail}
  Errors: {error_count}
  Warnings: {warning_count}
  Checked pages: {checked_count}
```
</completion>
