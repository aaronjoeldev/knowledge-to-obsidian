---
name: kto:context
description: Answer "what is this and where is it used?" for features, modules, or symbols using existing `.kto/` artifacts.
allowed-tools:
  - Read
  - Bash
---

<objective>
Given a single locator (feature ID, module path, or symbol), answer:
1. What is this entity?
2. Where does it live (repo path, wiki page)?
3. What features, modules, symbols, or processes attach to it?
</objective>

<arguments>
- Required: single locator
  - Feature: `FEAT-001` or exact feature name
  - Module: `MODULE-AuthService` or repo path like `src/auth`
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

Resolution order:
1. Exact ID match (e.g. `FEAT-001`, `MODULE-Auth`, `symbol-auth-login`)
2. Exact path match (e.g. `src/auth/login.ts`)
3. Exact name match (case-insensitive)
4. If multiple candidates → return candidates, do NOT guess

For **Feature**:
- Report: description, status, entry_points, modules, third_parties, wiki.page_target
- Report: attached symbols (from `index_v2.symbols` where `feature_ids` includes this feature)
- Report: processes (from `index_v2.processes` where `feature_ids` includes this feature)

For **Module**:
- Report: responsibility, path, language, exports, dependencies, used_by_features, wiki.page_target
- Report: symbols (from `index_v2.symbols` where `module_id` matches)
- Report: features using this module

For **Symbol** (requires `index_v2.symbols`):
- Report: kind, path, owning module (if any), attached features (if any)
- Report: references to this symbol (from `index_v2.references` where `to_symbol_id` matches)
- Report: processes referencing this symbol

Do NOT spawn an agent. This is read-only lookup.
</execution>

<completion>
Report:
```text
✓ Context Query: {input}

Resolved as: {feature|module|symbol} {id}
What: {1-2 sentences from description/responsibility/kind}
Where:
  - path: {repo path or paths}
  - wiki: {page_target or -}
Attached:
  - features: {FEAT ids/names or none}
  - modules: {MODULE ids or none}
  - symbols: {top related symbols or unavailable}
  - processes/entry points: {process ids / paths or none}
Sources:
  - enriched_knowledge.json:{section}
```

If symbol-level data requested but `index_v2` missing:
"Symbol-level context unavailable. Run `/kto:analyze` to generate index_v2 metadata."
</completion>
