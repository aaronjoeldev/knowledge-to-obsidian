---
name: kto:status
description: Inspect kto artifact presence, validity, and freshness without running the analysis pipeline.
allowed-tools:
  - Read
  - Bash
---

<objective>
Report whether kto is initialized, whether `knowledge.json` and `enriched_knowledge.json` exist and validate, and which next step is recommended.
</objective>

<pre_check>
```bash
test -f .kto/config.json && echo "CONFIG_OK" || echo "NO_CONFIG"
OUTPUT_DIR=$(node -e "const fs=require('fs');const p='.kto/config.json';try{const raw=fs.readFileSync(p,'utf8');const c=JSON.parse(raw);process.stdout.write((typeof c.output_dir==='string'&&c.output_dir.trim()!=='')?c.output_dir.trim():'.kto')}catch{process.stdout.write('.kto')}")
test -f "$OUTPUT_DIR/knowledge.json" && echo "KNOWLEDGE_OK" || echo "KNOWLEDGE_MISSING"
test -f "$OUTPUT_DIR/enriched_knowledge.json" && echo "ENRICHED_OK" || echo "ENRICHED_MISSING"
```
</pre_check>

<execution>
Read:
- `.kto/config.json` when present
- `{output_dir}/knowledge.json` when present
- `{output_dir}/enriched_knowledge.json` when present

Then report:
- config status
- artifact status
- timestamps when available
- counts from `enriched_knowledge.json` when available
- freshness summary
- recommended next step

Do not spawn agents. Do not modify files.
</execution>

<completion>
Report:
```text
✓ kto status

  Config: {ok|missing|invalid}
  knowledge.json: {missing|invalid|ok} {scanned_at_or_dash}
  enriched_knowledge.json: {missing|invalid|ok} {enriched_at_or_dash}
  Counts: {features} features, {modules} modules, {third_parties} third parties
  Freshness: enriched-from-knowledge={fresh|stale|unknown}, wiki-from-enriched={fresh|stale|unknown}
  Recommended next step: {/kto:init|/kto:analyze|/kto:sync|/kto:lint|none}
```
</completion>
