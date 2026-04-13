---
name: kto:impact
description: Answer "what breaks if I change this?" for a path or symbol using existing `.kto/` artifacts.
allowed-tools:
  - Read
  - Bash
  - Glob
---

<objective>
Given a single target (repo path or symbol), answer:
1. What entities depend on this?
2. Which features/processes are affected?
3. What tests should run before committing?
</objective>

<arguments>
- Required: single target locator
  - Path: repo-relative, e.g. `src/auth/login.ts`
  - Symbol: `symbol-auth-login-handler`, `loginHandler`, or `src/auth/login.ts#loginHandler`
</arguments>

<pre_check>
```bash
test -f .kto/config.json && echo "CONFIG_OK" || echo "NO_CONFIG"
OUTPUT_DIR=$(node -e "const fs=require('fs');const p='.kto/config.json';try{const c=JSON.parse(fs.readFileSync(p,'utf8'));process.stdout.write((typeof c.output_dir==='string'&&c.output_dir.trim()!=='')?c.output_dir.trim():'.kto')}catch{process.stdout.write('.kto')}")
test -f "$OUTPUT_DIR/enriched_knowledge.json" && echo "ENRICHED_OK" || echo "ENRICHED_MISSING"
```
</pre_check>

If `ENRICHED_MISSING`: "enriched_knowledge.json not found. Run `/kto:analyze` first."
If `NO_CONFIG`: "kto is not initialized. Run `/kto:init` first."

<execution>
Read:
- `.kto/config.json`
- `{output_dir}/enriched_knowledge.json`

Optional test scan (Bash):
```bash
# Find test files matching the target path
find . -type f \( -name "*.test.ts" -o -name "*.spec.ts" -o -name "*.test.tsx" \) 2>/dev/null | head -20
```

Resolution order:
1. Exact symbol ID or `path#symbol` match
2. Exact path match
3. Exact name match (case-insensitive)
4. If multiple candidates → return candidates, do NOT guess

For **Symbol** (requires `index_v2.symbols` and `index_v2.references`):
- Find all `references` where `to_symbol_id == target` → these depend on target
- Collect `from_symbol_id` values → reverse dependencies
- Map symbols to modules via `index_v2.symbols[].module_id`
- Map modules to features via `modules[].used_by_features`

For **Path**:
- Find all symbols with `path == target`
- Use same reverse-reference logic as above
- Also check `modules[].path` prefix matches for module-level impact

Risk assessment:
- `low`: no reverse references, standalone module
- `medium`: 1-3 reverse references, limited feature impact
- `high`: 4+ reverse references OR core module OR multiple features affected

Test recommendations (priority order):
1. Tests in same directory / matching basename
2. Tests for affected features (from `features[].entry_points`)
3. Tests for affected modules
4. If confidence low → recommend full suite

Do NOT spawn an agent unless fuzzy impact analysis beyond artifacts is explicitly needed.
</execution>

<completion>
Report:
```text
✓ Impact Target: {input}

Resolved as: {path|symbol} {id_or_path}
Likely affected:
  - symbols depending on it: {list or unavailable}
  - modules: {MODULE ids}
  - features: {FEAT ids/names}
  - processes/entry points: {list}
  - third parties: {list if relevant}
Breakage risk: {low|medium|high}
Why:
  - {reverse references / module dependencies / feature links}
Suggested tests:
  - {directly matching tests}
  - {feature/process-related tests}
  - {fallback: run full suite if confidence low}
Sources:
  - enriched_knowledge.json:{section}
  - repo test scan:{patterns used}
```

If symbol-level impact requested but `index_v2.references` missing:
"Symbol-level impact unavailable. Run `/kto:analyze` to generate index_v2 metadata."
</completion>
