---
name: kto:diff
description: Fast incremental update — detects which files changed since the last kto analysis and updates only the affected knowledge entities and Obsidian notes. Pass file paths as arguments or let kto detect changes via git diff.
allowed-tools:
  - Read
  - Write
  - Bash
  - Agent
---

<objective>
Run the kto Change Detector for files that have changed since the last analysis.
Uses `git diff` to detect changes automatically, or accepts explicit file paths as arguments.
</objective>

<arguments>
Optional: space-separated file paths to treat as changed.
Example: `/kto:diff src/auth/service.ts src/billing/handler.ts`
If no arguments provided, auto-detect via git.
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

Treat `.kto/config.json` as the authoritative config source and derive file paths from `output_dir`.
</pre_check>

<detect_changes>
If no file arguments were provided:

```bash
# Files changed since last kto run
git diff --name-only HEAD 2>/dev/null
git diff --name-only --cached 2>/dev/null
# Also check untracked files
git ls-files --others --exclude-standard 2>/dev/null
```

Compare modification times: only include files newer than `{output_dir}/enriched_knowledge.json`.

```bash
find . -newer "$OUTPUT_DIR/enriched_knowledge.json" -type f \
  -not -path '*/node_modules/*' \
  -not -path '*/.git/*' \
  -not -path "*/$OUTPUT_DIR/*" \
  2>/dev/null
```
</detect_changes>

<execution>
Spawn the `kto-change-detector` agent with the list of changed files as input.

Format the prompt:
```
Changed files:
{file_path_1}
{file_path_2}
...
```
</execution>

<completion>
Report:
```
✓ Incremental update complete
  Changed files analyzed: {count}
  Affected modules: {module_ids}
  Affected features: {feature_ids}
  Notes updated: {count}
```
</completion>
