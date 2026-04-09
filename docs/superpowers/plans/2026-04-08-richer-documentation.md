# Richer kto Documentation Implementation Plan


**Goal:** Make kto generate deep, useful documentation that gives AI agents immediate understanding of any codebase — not just file lists and naming-pattern guesses.

**Architecture:** (1) Graph builder reads actual source files to generate real prose (descriptions, how-it-works, auth flows, threat evidence). (2) Types extended with optional fields. (3) Obsidian sync writes rich templates with full German-language sections.

**Tech Stack:** TypeScript (vitest), markdown agent prompts

---

## Parallelism Map

```
Phase 1 (all parallel):
  Task A: src/types.ts — add 5 optional fields
  Task B: agents/kto-graph-builder.md — add read_and_enrich step
  Task E: agents/kto-obsidian-sync.md — upgrade all templates

Phase 2 (depends on Task A):
  Task D: tests/types.test.ts — add tests for new optional fields

Phase 3 (validation):
  Task F: npm test
```

Tasks A, B, and E touch different files — fully parallel. Task D depends on A (needs the new types to compile). No validator changes needed.

---

### Task A — `src/types.ts`: Add Optional Fields

**Files:**
- Modify: `/Users/clawie/Projects/kto/src/types.ts`

- [ ] **Step 1: Read the current file**

```bash
cat /Users/clawie/Projects/kto/src/types.ts
```

- [ ] **Step 2: Add `how_it_works` to KnowledgeFeature**

Find:
```typescript
  security_impact: Criticality;
}

export interface KnowledgeModule {
```

Replace with:
```typescript
  security_impact: Criticality;
  how_it_works?: string;
}

export interface KnowledgeModule {
```

- [ ] **Step 3: Add `description` and `usage_in_project` to KnowledgeThirdParty**

Find:
```typescript
  criticality: Criticality;
  used_in: string[]; // FEAT-* ids
}
```

Replace with:
```typescript
  criticality: Criticality;
  used_in: string[]; // FEAT-* ids
  description?: string;
  usage_in_project?: string;
}
```

- [ ] **Step 4: Add `evidence` to KnowledgeSecurityThreat**

Find:
```typescript
  severity: Criticality;
  mitigation: string;
}
```

Replace with:
```typescript
  severity: Criticality;
  mitigation: string;
  evidence?: string;
}
```

- [ ] **Step 5: Add `auth_flow` and `authorization_model` to KnowledgeSecurity**

Find:
```typescript
  auth_model: string;
}
```

Replace with:
```typescript
  auth_model: string;
  auth_flow?: string;
  authorization_model?: string;
}
```

- [ ] **Step 6: Verify typecheck passes**

```bash
cd /Users/clawie/Projects/kto && npm run typecheck
```

Expected: exits 0 with no errors.

- [ ] **Step 7: Commit**

```bash
git -C /Users/clawie/Projects/kto add src/types.ts
git -C /Users/clawie/Projects/kto commit -m "feat(types): add optional enrichment fields for richer documentation"
```

---

### Task B — `agents/kto-graph-builder.md`: Add `read_and_enrich` Step

**Files:**
- Modify: `/Users/clawie/Projects/kto/agents/kto-graph-builder.md`

- [ ] **Step 1: Read the current file**

Read `/Users/clawie/Projects/kto/agents/kto-graph-builder.md` in full.

- [ ] **Step 2: Insert `read_and_enrich` step**

Find the line `<step name="build_relations">` and insert the following block **immediately before** it:

```xml
<step name="read_and_enrich">
This step reads actual source file content to replace name-pattern guesses with real understanding.
Run AFTER detect_security and BEFORE build_relations.

**A — Enrich each feature**

For each feature in the detected features list:
1. Identify 1–2 entry_point files. If entry_points is empty, pick the most central file from the feature's module list.
2. Read those files with the Read tool.
3. From the file content, write:
   - `description`: One precise sentence (≤25 words) naming what user-facing capability this feature provides. No "unknown". No generic phrases like "handles logic".
   - `how_it_works`: 2–4 sentences explaining the technical mechanism: what triggers the feature, what the code path does step by step, and what it returns/produces. Cite real function names, middleware, or data transformations visible in the file.

Quality bar:
- BAD description: "Handles user authentication logic."
- GOOD description: "Allows users to sign in with email/password or OAuth via Supabase, issuing a session cookie on success."
- BAD how_it_works: "The auth module handles login."
- GOOD how_it_works: "The login route renders a form that calls `supabase.auth.signInWithPassword()` on submit. The auth callback at `app/api/auth/callback/route.ts` exchanges the authorization code for a session via `supabase.auth.exchangeCodeForSession()`, sets a `Set-Cookie` header, and redirects to the dashboard. Session refresh is handled server-side via `@supabase/ssr` middleware on every request."

**B — Enrich each third party**

For each third party:
1. Find 1–2 files that import this package (from the imports data).
2. Read those files with the Read tool.
3. Write:
   - `description`: One sentence explaining what the npm package does in general (draw on your training knowledge of the package). E.g. for `@supabase/ssr`: "Supabase SSR adapter that provides cookie-based session management for server-rendered Next.js routes."
   - `usage_in_project`: 1–3 sentences describing how this specific project uses the package. Cite actual function names, config keys, or patterns visible in the files.
   - `data_access`: Replace any `['unknown']` value with a concrete list of data categories the package touches (e.g. `['session_cookies', 'user_auth_tokens', 'email']`).

**C — Enrich security**

1. Find auth-related files: `middleware.ts`, files under `auth/` or `api/auth/`, files importing supabase.auth, jwt, passport, or next-auth.
2. Read up to 3 of those files with the Read tool.
3. Write on the `security` object:
   - `auth_flow`: 3–5 sentences describing the actual authentication sequence from the code. Describe how a request arrives, what middleware intercepts it, how the token/session is verified, success/failure paths, and which cookie/header carries the session. Cite real function names.
   - `authorization_model`: 1–2 sentences describing how access control decisions are made (role checks, ownership checks, RLS, middleware guards). If Supabase Row Level Security is enabled, say so.
4. For each existing threat, upgrade:
   - `description`: Replace generic pattern-match text with a specific sentence citing code evidence. E.g.: "The `signInWithPassword` endpoint has no rate limiting, enabling credential stuffing."
   - `evidence`: Quote the file path and specific code construct. E.g.: "`app/api/auth/callback/route.ts` — `code` parameter read from URL without PKCE state validation."
   - `mitigation`: Concrete, actionable recommendation. E.g.: "Add `upstash/ratelimit` middleware on the login route. Validate OAuth state parameter against a server-side nonce before calling `exchangeCodeForSession`."

**Limits:**
- Read at most 3 files per feature, 2 files per third party, 3 files for security.
- Skip binary files and files over 50 KB.
- If a file cannot be read: write "Source file unavailable." and continue.
- Do NOT hallucinate. If you cannot determine a value from code, write "Not determined from source." — never invent content.
</step>

```

- [ ] **Step 3: Update `<rules>` block**

Find the closing `</rules>` tag and insert these three lines before it:

```
- read_and_enrich MUST read actual file content before writing description or how_it_works — never generate these fields from file names alone
- New optional fields (how_it_works, description/usage_in_project on third parties, auth_flow, authorization_model, evidence on threats) MUST be populated when source code is readable
- Never write "unknown" or leave description empty when source files are available to read
```

- [ ] **Step 4: Update `<success_criteria>` block**

Replace the entire `<success_criteria>` block with:

```xml
<success_criteria>
- [ ] `.kto/enriched_knowledge.json` written and valid JSON
- [ ] All entities have stable, unique IDs
- [ ] Relations reference only entities that exist in the graph
- [ ] Every feature has a non-empty `description` and `how_it_works` (when entry_point files are readable)
- [ ] Every third party has a non-empty `description` and `usage_in_project`
- [ ] `security.auth_flow` and `security.authorization_model` are populated (when auth files are readable)
- [ ] All threats have non-generic `description`, populated `evidence`, and actionable `mitigation`
- [ ] Return: feature count, module count, third-party count
</success_criteria>
```

- [ ] **Step 5: Verify the file is valid (no broken XML tags)**

```bash
grep -c "<step name=" /Users/clawie/Projects/kto/agents/kto-graph-builder.md
```

Expected: 7 (was 6, now +1 for read_and_enrich).

- [ ] **Step 6: Commit**

```bash
git -C /Users/clawie/Projects/kto add agents/kto-graph-builder.md
git -C /Users/clawie/Projects/kto commit -m "feat(agent): graph-builder reads source files for real descriptions and security analysis"
```

---

### Task E — `agents/kto-obsidian-sync.md`: Upgrade All Templates

**Files:**
- Modify: `/Users/clawie/Projects/kto/agents/kto-obsidian-sync.md`

- [ ] **Step 1: Read the current file**

Read `/Users/clawie/Projects/kto/agents/kto-obsidian-sync.md` in full.

- [ ] **Step 2: Replace `write_feature_notes` step body**

Find the opening `<step name="write_feature_notes">` and its closing `</step>`. Replace the entire block with:

````xml
<step name="write_feature_notes">
For each feature in `features[]`, write `Features/FEAT-XXX_{SlugName}.md`:

File name: `FEAT-{id_suffix}_{PascalCaseFeatureName}.md`

```markdown
---
type: feature
id: {feature.id}
project: {project.id}
status: {feature.status}
security_impact: {feature.security_impact}
generated_by: kto
---

# {feature.name}

<!-- AUTO-GENERATED START -->
**Status:** {feature.status}
**Security Impact:** {feature.security_impact}

## Was es macht

{feature.description}

## Wie es funktioniert

{feature.how_it_works if present, else: "_Noch nicht analysiert — führe `/kto:analyze` erneut aus, um Quelldateien einzulesen._"}

## Wie es eingesetzt wird

**Entry Points:**
{for each entry_point: - `{entry_point}`}

**Implementiert durch:**
{for each module id: - [[{module_id}]]}

**Drittanbieter:**
{for each third_party id: - [[{third_party_id}]]}

## Sicherheitsaspekte

**Security Impact:** {feature.security_impact}

{Collect all threats from security.threats whose affected_modules overlap with feature.modules. For each:
- **{threat.id}** — {threat.description}
  - *Mitigation:* {threat.mitigation if present, else "Keine dokumentiert."}
If none: "_Keine bekannten Bedrohungen für dieses Feature._"
}

## Relations

{for each relation where from == feature.id or to == feature.id:
- {from} --{type}--> {to}}

*Last synced: {enriched_at}*
<!-- AUTO-GENERATED END -->
```
</step>
````

- [ ] **Step 3: Replace `write_third_party_notes` step body**

Find `<step name="write_third_party_notes">` and replace the entire block with:

````xml
<step name="write_third_party_notes">
For each third party in `third_parties[]`, write `Third_Party/{tp.id}.md`:

```markdown
---
type: third_party
id: {tp.id}
project: {project.id}
criticality: {tp.criticality}
generated_by: kto
---

# {tp.name}

<!-- AUTO-GENERATED START -->
**Typ:** {tp.type}
**Kritikalität:** {tp.criticality}

## Zweck

{tp.description if present, else: "_Keine Beschreibung verfügbar._"}

## Verwendung im Projekt

{tp.usage_in_project if present, else: "_Noch nicht analysiert — führe `/kto:analyze` erneut aus._"}

## Datenzugriff

{if tp.data_access is non-empty and not ['unknown']:
  {for each item: - {item}}
else:
  "_Kein spezifischer Datenzugriff dokumentiert._"
}

## Sicherheitshinweise

{Collect threats from security.threats where any of tp.used_in features have modules overlapping with threat.affected_modules. For each:
- **{threat.id}** ({threat.severity}) — {threat.description}
  - *Mitigation:* {threat.mitigation if present, else "Keine dokumentiert."}
If none: "_Keine bekannten Sicherheitsbedrohungen für diese Bibliothek._"
}

## Verwendet in Features

{for each feat_id in tp.used_in: - [[{feat_id}]]}

*Last synced: {enriched_at}*
<!-- AUTO-GENERATED END -->
```
</step>
````

- [ ] **Step 4: Replace `write_security_overview` step body**

Find `<step name="write_security_overview">` and replace the entire block with:

````xml
<step name="write_security_overview">
Write `Security/Security_Overview.md`:

```markdown
---
type: security
project: {project.id}
generated_by: kto
---

# Security Overview — {project.name}

<!-- AUTO-GENERATED START -->
**Auth-Modell:** {security.auth_model}

## Authentifizierungs-Flow

{security.auth_flow if present, else: "_Noch nicht analysiert — führe `/kto:analyze` erneut aus, um Auth-Dateien einzulesen._"}

## Autorisierungsmodell

{security.authorization_model if present, else: "_Noch nicht analysiert._"}

## Bedrohungsübersicht

| ID | Beschreibung | Schweregrad | Mitigation |
|----|-------------|-------------|------------|
{for each threat: | {threat.id} | {threat.description} | {threat.severity} | {threat.mitigation or "—"} |}

## Bedrohungsdetails

{for each threat:
### {threat.id} — {threat.description}

**Schweregrad:** {threat.severity}
**Betroffene Module:** {threat.affected_modules.map(m => `[[${m}]]`).join(', ')}

**Evidenz:**
{threat.evidence if present, else: "_Keine spezifische Codeevidenz dokumentiert._"}

**Mitigation:**
{threat.mitigation if non-empty, else: "_Keine Mitigation dokumentiert._"}

---
}

## PII-Inventar

{Group pii_flows by likely category. Suggested categories:
- Authentifizierung: modules with auth/session/login/password in name
- Benutzerprofil: modules with profile/user/account in name
- Zahlungsdaten: modules with billing/payment/invoice in name
- Verifizierung: modules with verification/tax/document in name
- Kommunikation: modules with email/notification/message in name
- Sonstiges: everything else

For each non-empty category:
### {category}
{for each pii_flow: - [[{pii_flow}]]}

If pii_flows is empty: "_Keine PII-Flows identifiziert._"
}

*Last synced: {enriched_at}*
<!-- AUTO-GENERATED END -->
```
</step>
````

- [ ] **Step 5: Add new `write_technology_md` step**

Find `<step name="write_feature_notes">` (the opening tag only). Insert the following new step block **immediately before** it:

````xml
<step name="write_technology_md">
Write `Technology.md` — complete technology stack overview:

```markdown
---
type: technology
project: {project.id}
generated_by: kto
---

# Technologie-Stack — {project.name}

<!-- AUTO-GENERATED START -->
## Architekturüberblick

{Synthesize 3–5 sentences about the overall architecture from the technologies and third_parties lists. Describe: the runtime (Node/browser/edge), the primary framework and rendering strategy (SSR/SPA/API routes), the data persistence approach, and the authentication approach. Only use information present in the data — do not hallucinate.}

## Technologie-Tabelle

| Name | Version | Typ | Beschreibung |
|------|---------|-----|-------------|
{for each tp in third_parties[]:
| **[[{tp.id}|{tp.name}]]** | `{tp.version or "—"}` | {tp.type} | {tp.description if present, else infer a short one-line description from the package name and type} |}

*{third_parties.length} Bibliotheken · Last synced: {enriched_at}*
<!-- AUTO-GENERATED END -->
```
</step>

````

- [ ] **Step 6: Update `<success_criteria>` block**

Replace the existing `<success_criteria>` block with:

```xml
<success_criteria>
- [ ] Facts.md written/updated
- [ ] Technology.md written/updated with Architekturüberblick section
- [ ] One file per feature — each with Was es macht, Wie es funktioniert, Wie es eingesetzt wird, Sicherheitsaspekte sections
- [ ] One file per third party — each with Zweck, Verwendung im Projekt, Datenzugriff, Sicherheitshinweise sections
- [ ] One file per module
- [ ] Index files written
- [ ] Security_Overview.md written with Authentifizierungs-Flow, Autorisierungsmodell, Bedrohungsdetails, PII-Inventar sections
- [ ] No user content outside AUTO-GENERATED blocks was modified
- [ ] Return: files created, files updated, vault path
</success_criteria>
```

- [ ] **Step 7: Verify step count**

```bash
grep -c "<step name=" /Users/clawie/Projects/kto/agents/kto-obsidian-sync.md
```

Expected: 8 (was 7, now +1 for write_technology_md).

- [ ] **Step 8: Commit**

```bash
git -C /Users/clawie/Projects/kto add agents/kto-obsidian-sync.md
git -C /Users/clawie/Projects/kto commit -m "feat(agent): obsidian-sync writes rich templates with descriptions, security details, PII inventory"
```

---

### Task D — `tests/types.test.ts`: Add Tests for New Optional Fields

**Files:**
- Modify: `/Users/clawie/Projects/kto/tests/types.test.ts`

Depends on: Task A (types.ts must be updated first).

- [ ] **Step 1: Read the current test file**

Read `/Users/clawie/Projects/kto/tests/types.test.ts` in full.

- [ ] **Step 2: Update the import line**

Find the existing import statement (starts with `import type {`). Add `KnowledgeSecurityThreat` to it if not already there. The full import should be:

```typescript
import type {
  KnowledgeProject,
  KnowledgeFeature,
  KnowledgeModule,
  KnowledgeThirdParty,
  KnowledgeTechnology,
  KnowledgeSecurity,
  KnowledgeSecurityThreat,
  KnowledgeRelation,
  KnowledgeGraph,
  EnrichedKnowledgeGraph,
  RelationType,
  FeatureStatus,
  Criticality,
} from '../src/types.js';
```

- [ ] **Step 3: Add new test cases**

Find the last `it(...)` block before the closing `});` of the outer `describe`. Insert after it:

```typescript
  it('KnowledgeFeature accepts optional how_it_works field', () => {
    const feature: KnowledgeFeature = {
      id: 'FEAT-002',
      name: 'Billing',
      description: 'Handles subscription payments via Stripe.',
      status: 'implemented',
      entry_points: ['api/billing/checkout'],
      modules: ['MODULE-Billing'],
      third_parties: ['THIRD-Stripe'],
      security_impact: 'high',
      how_it_works: 'The checkout route creates a Stripe session and redirects the user.',
    };
    expect(feature.how_it_works).toBe('The checkout route creates a Stripe session and redirects the user.');
  });

  it('KnowledgeFeature is valid without how_it_works field', () => {
    const feature: KnowledgeFeature = {
      id: 'FEAT-003',
      name: 'Search',
      description: 'Full-text search across content.',
      status: 'planned',
      entry_points: [],
      modules: [],
      third_parties: [],
      security_impact: 'low',
    };
    expect(feature.how_it_works).toBeUndefined();
  });

  it('KnowledgeThirdParty accepts optional description and usage_in_project', () => {
    const tp: KnowledgeThirdParty = {
      id: 'THIRD-Supabase',
      name: 'Supabase',
      type: 'auth',
      data_access: ['session_cookies', 'user_auth_tokens'],
      criticality: 'high',
      used_in: ['FEAT-001'],
      description: 'Open-source Firebase alternative with auth, database, and storage.',
      usage_in_project: 'Used for email/password auth and session management via SSR cookies.',
    };
    expect(tp.description).toContain('Firebase');
    expect(tp.usage_in_project).toContain('session');
  });

  it('KnowledgeSecurity accepts optional auth_flow and authorization_model', () => {
    const security: KnowledgeSecurity = {
      threats: [],
      pii_flows: [],
      auth_model: 'Custom',
      auth_flow: 'Login route calls signInWithPassword, callback exchanges code for session.',
      authorization_model: 'Row Level Security enforced at the Supabase database layer.',
    };
    expect(security.auth_flow).toContain('signInWithPassword');
    expect(security.authorization_model).toContain('Row Level Security');
  });

  it('KnowledgeSecurityThreat accepts optional evidence field', () => {
    const threat: KnowledgeSecurityThreat = {
      id: 'THREAT-001',
      description: 'Login endpoint has no rate limiting, enabling credential stuffing.',
      affected_modules: ['MODULE-Auth'],
      severity: 'high',
      mitigation: 'Add upstash/ratelimit middleware on the login route.',
      evidence: 'app/(auth)/login/page.tsx — no rate-limit call before supabase.auth.signInWithPassword()',
    };
    expect(threat.evidence).toContain('signInWithPassword');
  });
```

- [ ] **Step 4: Run the tests (must all pass)**

```bash
cd /Users/clawie/Projects/kto && npm test
```

Expected: all tests pass, including the 5 new ones.

- [ ] **Step 5: Commit**

```bash
git -C /Users/clawie/Projects/kto add tests/types.test.ts
git -C /Users/clawie/Projects/kto commit -m "test: add type tests for optional enrichment fields"
```

---

### Task F — Final Validation

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/clawie/Projects/kto && npm run typecheck && npm test
```

Expected: typecheck exits 0, all tests pass.

- [ ] **Step 2: Verify step counts in agent files**

```bash
grep -c "<step name=" /Users/clawie/Projects/kto/agents/kto-graph-builder.md
grep -c "<step name=" /Users/clawie/Projects/kto/agents/kto-obsidian-sync.md
```

Expected: graph-builder=7, obsidian-sync=8.

- [ ] **Step 3: Push to GitHub**

```bash
git -C /Users/clawie/Projects/kto push origin main
```

---

## Summary of All File Changes

| File | Change | New fields / sections |
|------|--------|----------------------|
| `src/types.ts` | Edit | `KnowledgeFeature.how_it_works?`, `KnowledgeThirdParty.description?`, `KnowledgeThirdParty.usage_in_project?`, `KnowledgeSecurityThreat.evidence?`, `KnowledgeSecurity.auth_flow?`, `KnowledgeSecurity.authorization_model?` |
| `agents/kto-graph-builder.md` | Edit | New `read_and_enrich` step: reads source files for real descriptions, third-party context, and security analysis |
| `agents/kto-obsidian-sync.md` | Edit | Feature template: Was es macht / Wie es funktioniert / Wie es eingesetzt wird / Sicherheitsaspekte. Third-party: Zweck / Verwendung / Datenzugriff / Sicherheitshinweise. Security: Auth-Flow / Autorisierungsmodell / Bedrohungsdetails / PII-Inventar. New Technology.md step. |
| `tests/types.test.ts` | Edit | 5 new `it()` blocks for optional fields |
| `src/knowledge-validator.ts` | No change | Optional fields need no new validation logic |
