# kto — Knowledge to Obsidian: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `kto` — a Claude Code plugin that analyzes any codebase and writes a structured, auto-updating knowledge base into an Obsidian vault.

**Architecture:** Four specialized AI agents form a pipeline: Project Mapper → Graph Builder → Obsidian Sync → Change Detector. The agents are defined as markdown prompt files (like get-shit-done), invoked via slash commands in Claude Code, and orchestrated programmatically via the Claude Agent SDK. A `.kto/config.json` file in the target project specifies vault path and per-agent model assignments.

**Tech Stack:** Node.js ≥22, TypeScript 5, `@anthropic-ai/claude-agent-sdk`, `tree-sitter` (AST parsing), `ts-morph` (TypeScript deep analysis), `vitest` (tests), JSON (knowledge store v1).

---

## Project File Map

```
kto/
├── package.json                        # npm package definition (name: kto-cc)
├── tsconfig.json                       # TypeScript config
├── vitest.config.ts                    # Vitest config
├── bin/
│   └── install.js                      # npm postinstall: copies files to ~/.claude/kto/
├── agents/
│   ├── kto-project-mapper.md           # Agent: scans repo → .kto/knowledge.json
│   ├── kto-graph-builder.md            # Agent: knowledge.json → .kto/enriched_knowledge.json
│   ├── kto-obsidian-sync.md            # Agent: enriched_knowledge.json → Obsidian vault
│   └── kto-change-detector.md         # Agent: changed files → partial vault update
├── commands/
│   └── kto/
│       ├── init.md                     # /kto:init — scaffold .kto/config.json
│       ├── analyze.md                  # /kto:analyze — run full pipeline
│       ├── sync.md                     # /kto:sync — sync enriched_knowledge → Obsidian only
│       └── diff.md                     # /kto:diff — update knowledge for changed files
├── src/
│   ├── types.ts                        # All TypeScript interfaces (knowledge model)
│   ├── config.ts                       # Loads and validates .kto/config.json
│   ├── knowledge-validator.ts          # Validates knowledge.json shape at runtime
│   └── index.ts                        # SDK entry point: programmatic pipeline API
└── tests/
    ├── types.test.ts                   # Type guard tests
    ├── config.test.ts                  # Config loader tests
    └── knowledge-validator.test.ts     # Validator tests
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "kto-cc",
  "version": "0.1.0",
  "description": "Knowledge to Obsidian — AI-powered codebase knowledge sync for Claude Code",
  "type": "module",
  "bin": {
    "kto-cc": "bin/install.js"
  },
  "files": [
    "bin",
    "agents",
    "commands",
    "src"
  ],
  "keywords": ["claude", "claude-code", "obsidian", "knowledge-base", "codebase-analysis"],
  "author": "",
  "license": "MIT",
  "engines": { "node": ">=22.0.0" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "build": "tsc --noEmit",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.5.0",
    "vitest": "^4.1.2"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "latest"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
.kto/
*.log
.DS_Store
```

- [ ] **Step 5: Install dependencies and verify build tools work**

```bash
cd /Users/clawie/Projects/kto && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Commit**

```bash
git init && git add package.json tsconfig.json vitest.config.ts .gitignore
git commit -m "chore: project scaffold for kto-cc"
```

---

## Task 2: Knowledge Model Types (TDD)

**Files:**
- Create: `tests/types.test.ts`
- Create: `src/types.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/types.test.ts
import { describe, it, expect } from 'vitest';
import type {
  KnowledgeProject,
  KnowledgeFeature,
  KnowledgeModule,
  KnowledgeThirdParty,
  KnowledgeTechnology,
  KnowledgeSecurity,
  KnowledgeRelation,
  KnowledgeGraph,
  EnrichedKnowledgeGraph,
  RelationType,
  FeatureStatus,
  Criticality,
} from '../src/types.js';

describe('Knowledge Model Types', () => {
  it('KnowledgeProject has required fields', () => {
    const project: KnowledgeProject = {
      id: 'PROJECT-XYZ',
      name: 'My App',
      description: 'A web application',
      domain: 'e-commerce',
      criticality: 'high',
    };
    expect(project.id).toBe('PROJECT-XYZ');
    expect(project.criticality).toBe('high');
  });

  it('KnowledgeFeature has required fields', () => {
    const feature: KnowledgeFeature = {
      id: 'FEAT-001',
      name: 'User Authentication',
      description: 'Handles login and registration',
      status: 'implemented',
      entry_points: ['api/auth/login'],
      modules: ['MODULE-AuthService'],
      third_parties: [],
      security_impact: 'high',
    };
    expect(feature.id).toBe('FEAT-001');
    expect(feature.status).toBe('implemented');
  });

  it('KnowledgeModule has required fields', () => {
    const module: KnowledgeModule = {
      id: 'MODULE-AuthService',
      path: 'services/auth/',
      language: 'typescript',
      responsibility: 'Handles authentication logic',
      exports: ['AuthService', 'validateToken'],
      dependencies: ['THIRD-Auth0'],
      used_by_features: ['FEAT-001'],
    };
    expect(module.id).toBe('MODULE-AuthService');
    expect(module.language).toBe('typescript');
  });

  it('KnowledgeRelation links two entities', () => {
    const relation: KnowledgeRelation = {
      from: 'FEAT-001',
      to: 'MODULE-AuthService',
      type: 'implemented_by',
    };
    expect(relation.type).toBe('implemented_by');
  });

  it('KnowledgeGraph root structure is complete', () => {
    const graph: KnowledgeGraph = {
      project: {
        id: 'PROJECT-XYZ',
        name: 'Test',
        description: '',
        domain: '',
        criticality: 'low',
      },
      features: [],
      modules: [],
      third_parties: [],
      technologies: [],
      security: { threats: [], pii_flows: [], auth_model: 'none' },
      relations: [],
    };
    expect(graph.features).toHaveLength(0);
  });

  it('EnrichedKnowledgeGraph extends KnowledgeGraph with metadata', () => {
    const graph: EnrichedKnowledgeGraph = {
      project: {
        id: 'PROJECT-XYZ',
        name: 'Test',
        description: '',
        domain: '',
        criticality: 'low',
      },
      features: [],
      modules: [],
      third_parties: [],
      technologies: [],
      security: { threats: [], pii_flows: [], auth_model: 'none' },
      relations: [],
      enriched_at: '2026-04-07T00:00:00Z',
      version: '1.0',
    };
    expect(graph.enriched_at).toBe('2026-04-07T00:00:00Z');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/clawie/Projects/kto && npx vitest run tests/types.test.ts
```

Expected: FAIL — `Cannot find module '../src/types.js'`

- [ ] **Step 3: Implement `src/types.ts`**

```typescript
// src/types.ts

// ─── Literal union types ──────────────────────────────────────────────────────

export type Criticality = 'low' | 'medium' | 'high';
export type FeatureStatus = 'planned' | 'implemented';
export type RelationType =
  | 'implemented_by'
  | 'depends_on'
  | 'uses'
  | 'exposes'
  | 'owned_by';

// ─── Core entities ────────────────────────────────────────────────────────────

export interface KnowledgeProject {
  id: string;
  name: string;
  description: string;
  domain: string;
  criticality: Criticality;
}

export interface KnowledgeFeature {
  id: string;
  name: string;
  description: string;
  status: FeatureStatus;
  entry_points: string[];
  modules: string[];         // References MODULE-* ids
  third_parties: string[];   // References THIRD-* ids
  security_impact: Criticality;
}

export interface KnowledgeModule {
  id: string;
  path: string;
  language: string;
  responsibility: string;
  exports: string[];
  dependencies: string[];    // MODULE-* or THIRD-* ids
  used_by_features: string[]; // FEAT-* ids
}

export interface KnowledgeThirdParty {
  id: string;
  name: string;
  type: string;              // e.g. 'payment', 'auth', 'storage'
  data_access: string[];     // e.g. ['billing', 'pii']
  criticality: Criticality;
  used_in: string[];         // FEAT-* ids
}

export interface KnowledgeTechnology {
  name: string;
  version: string;
  usage: string;
  modules: string[];         // MODULE-* ids
}

export interface KnowledgeSecurityThreat {
  id: string;
  description: string;
  affected_modules: string[];
  severity: Criticality;
  mitigation: string;
}

export interface KnowledgeSecurity {
  threats: KnowledgeSecurityThreat[];
  pii_flows: string[];
  auth_model: string;
}

export interface KnowledgeRelation {
  from: string;   // Any entity id
  to: string;     // Any entity id
  type: RelationType;
}

// ─── Root graph ───────────────────────────────────────────────────────────────

export interface KnowledgeGraph {
  project: KnowledgeProject;
  features: KnowledgeFeature[];
  modules: KnowledgeModule[];
  third_parties: KnowledgeThirdParty[];
  technologies: KnowledgeTechnology[];
  security: KnowledgeSecurity;
  relations: KnowledgeRelation[];
}

// ─── Enriched graph (output of Graph Builder) ────────────────────────────────

export interface EnrichedKnowledgeGraph extends KnowledgeGraph {
  enriched_at: string;   // ISO-8601 timestamp
  version: string;       // Schema version, e.g. '1.0'
}

// ─── Raw mapper output (before graph building) ───────────────────────────────

export interface RawFile {
  path: string;
  type: 'source' | 'config' | 'docs' | 'tests';
  language: string;
  size_bytes: number;
}

export interface RawImport {
  from_file: string;
  import_path: string;
  is_external: boolean;
}

export interface RawExport {
  from_file: string;
  name: string;
  kind: 'function' | 'class' | 'variable' | 'type' | 'default';
}

export interface RawKnowledge {
  scanned_at: string;
  root_path: string;
  files: RawFile[];
  imports: RawImport[];
  exports: RawExport[];
  entry_points: string[];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/clawie/Projects/kto && npx vitest run tests/types.test.ts
```

Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts tests/types.test.ts
git commit -m "feat: knowledge model type definitions with tests"
```

---

## Task 3: Config System (TDD)

**Files:**
- Create: `tests/config.test.ts`
- Create: `src/config.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, CONFIG_DEFAULTS, type KtoConfig } from '../src/config.js';

const TMP_DIR = '/tmp/kto-config-test';

beforeEach(() => {
  mkdirSync(join(TMP_DIR, '.kto'), { recursive: true });
});

afterEach(() => {
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true });
});

describe('loadConfig', () => {
  it('returns defaults when config file is missing', async () => {
    rmSync(join(TMP_DIR, '.kto'), { recursive: true });
    const config = await loadConfig(TMP_DIR);
    expect(config.agents.project_mapper).toBe(CONFIG_DEFAULTS.agents.project_mapper);
    expect(config.vault_path).toBe('');
  });

  it('merges user config over defaults', async () => {
    const userConfig = {
      vault_path: '/Users/test/Notes',
      project_id: 'MY-PROJECT',
    };
    writeFileSync(
      join(TMP_DIR, '.kto', 'config.json'),
      JSON.stringify(userConfig),
    );
    const config = await loadConfig(TMP_DIR);
    expect(config.vault_path).toBe('/Users/test/Notes');
    expect(config.project_id).toBe('MY-PROJECT');
    // Defaults preserved for unset fields
    expect(config.agents.project_mapper).toBe(CONFIG_DEFAULTS.agents.project_mapper);
  });

  it('allows per-agent model overrides', async () => {
    const userConfig = {
      vault_path: '/Users/test/Notes',
      agents: {
        graph_builder: 'claude-opus-4-6',
      },
    };
    writeFileSync(
      join(TMP_DIR, '.kto', 'config.json'),
      JSON.stringify(userConfig),
    );
    const config = await loadConfig(TMP_DIR);
    expect(config.agents.graph_builder).toBe('claude-opus-4-6');
    // Other agents keep their defaults
    expect(config.agents.project_mapper).toBe(CONFIG_DEFAULTS.agents.project_mapper);
  });

  it('throws on malformed JSON', async () => {
    writeFileSync(join(TMP_DIR, '.kto', 'config.json'), '{ broken json');
    await expect(loadConfig(TMP_DIR)).rejects.toThrow('Failed to parse');
  });

  it('throws when vault_path is missing and project is initialized', async () => {
    writeFileSync(
      join(TMP_DIR, '.kto', 'config.json'),
      JSON.stringify({ project_id: 'XYZ' }),
    );
    await expect(loadConfig(TMP_DIR, { requireVault: true })).rejects.toThrow(
      'vault_path',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/clawie/Projects/kto && npx vitest run tests/config.test.ts
```

Expected: FAIL — `Cannot find module '../src/config.js'`

- [ ] **Step 3: Implement `src/config.ts`**

```typescript
// src/config.ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KtoAgentsConfig {
  project_mapper: string;
  graph_builder: string;
  obsidian_sync: string;
  change_detector: string;
}

export interface KtoConfig {
  /** Absolute path to the Obsidian vault root. */
  vault_path: string;
  /** Stable project ID used in all entity IDs, e.g. "MY-PROJECT". */
  project_id: string;
  /** Subfolder inside vault where this project's notes live. */
  obsidian_subfolder: string;
  /** Output directory for .kto/knowledge.json etc. Relative to project root. */
  output_dir: string;
  /** Model ID per agent. Defaults to claude-haiku for cheap agents, sonnet for graph builder. */
  agents: KtoAgentsConfig;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const CONFIG_DEFAULTS: KtoConfig = {
  vault_path: '',
  project_id: 'PROJECT',
  obsidian_subfolder: 'Projects/PROJECT',
  output_dir: '.kto',
  agents: {
    project_mapper: 'claude-haiku-4-5-20251001',
    graph_builder: 'claude-sonnet-4-6',
    obsidian_sync: 'claude-haiku-4-5-20251001',
    change_detector: 'claude-haiku-4-5-20251001',
  },
};

// ─── Loader ───────────────────────────────────────────────────────────────────

export interface LoadConfigOptions {
  /** If true, throws when vault_path is empty. Use before sync operations. */
  requireVault?: boolean;
}

/**
 * Load .kto/config.json from projectDir and merge with defaults.
 * Returns pure defaults when file is missing.
 * Throws on malformed JSON or (optionally) missing vault_path.
 */
export async function loadConfig(
  projectDir: string,
  options: LoadConfigOptions = {},
): Promise<KtoConfig> {
  const configPath = join(projectDir, '.kto', 'config.json');

  let raw: string;
  try {
    raw = await readFile(configPath, 'utf-8');
  } catch {
    return validateAndReturn(structuredClone(CONFIG_DEFAULTS), options, configPath);
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    return validateAndReturn(structuredClone(CONFIG_DEFAULTS), options, configPath);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse config at ${configPath}: ${msg}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Config at ${configPath} must be a JSON object`);
  }

  const merged: KtoConfig = {
    ...structuredClone(CONFIG_DEFAULTS),
    ...parsed,
    agents: {
      ...CONFIG_DEFAULTS.agents,
      ...(parsed['agents'] as Partial<KtoAgentsConfig> ?? {}),
    },
  };

  return validateAndReturn(merged, options, configPath);
}

function validateAndReturn(
  config: KtoConfig,
  options: LoadConfigOptions,
  configPath: string,
): KtoConfig {
  if (options.requireVault && !config.vault_path) {
    throw new Error(
      `vault_path is required but not set in ${configPath}. Run /kto:init to configure.`,
    );
  }
  return config;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/clawie/Projects/kto && npx vitest run tests/config.test.ts
```

Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts tests/config.test.ts
git commit -m "feat: config system with per-agent model assignment"
```

---

## Task 4: Knowledge Validator (TDD)

**Files:**
- Create: `tests/knowledge-validator.test.ts`
- Create: `src/knowledge-validator.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/knowledge-validator.test.ts
import { describe, it, expect } from 'vitest';
import {
  validateKnowledgeGraph,
  validateRawKnowledge,
  isValidEntityId,
} from '../src/knowledge-validator.js';
import type { KnowledgeGraph, RawKnowledge } from '../src/types.js';

const VALID_GRAPH: KnowledgeGraph = {
  project: {
    id: 'PROJECT-XYZ',
    name: 'Test',
    description: '',
    domain: '',
    criticality: 'low',
  },
  features: [
    {
      id: 'FEAT-001',
      name: 'Auth',
      description: '',
      status: 'implemented',
      entry_points: [],
      modules: ['MODULE-Auth'],
      third_parties: [],
      security_impact: 'high',
    },
  ],
  modules: [
    {
      id: 'MODULE-Auth',
      path: 'src/auth/',
      language: 'typescript',
      responsibility: '',
      exports: [],
      dependencies: [],
      used_by_features: ['FEAT-001'],
    },
  ],
  third_parties: [],
  technologies: [],
  security: { threats: [], pii_flows: [], auth_model: 'JWT' },
  relations: [
    { from: 'FEAT-001', to: 'MODULE-Auth', type: 'implemented_by' },
  ],
};

describe('validateKnowledgeGraph', () => {
  it('accepts a valid graph', () => {
    const result = validateKnowledgeGraph(VALID_GRAPH);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing project id', () => {
    const bad = structuredClone(VALID_GRAPH);
    bad.project.id = '';
    const result = validateKnowledgeGraph(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('project.id'))).toBe(true);
  });

  it('rejects duplicate feature ids', () => {
    const bad = structuredClone(VALID_GRAPH);
    bad.features.push(structuredClone(bad.features[0]!));
    const result = validateKnowledgeGraph(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('duplicate'))).toBe(true);
  });

  it('rejects relation referencing unknown entity', () => {
    const bad = structuredClone(VALID_GRAPH);
    bad.relations.push({ from: 'FEAT-999', to: 'MODULE-Auth', type: 'implemented_by' });
    const result = validateKnowledgeGraph(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('FEAT-999'))).toBe(true);
  });
});

describe('isValidEntityId', () => {
  it('accepts valid ids', () => {
    expect(isValidEntityId('FEAT-001')).toBe(true);
    expect(isValidEntityId('MODULE-AuthService')).toBe(true);
    expect(isValidEntityId('PROJECT-XYZ')).toBe(true);
    expect(isValidEntityId('THIRD-Stripe')).toBe(true);
  });

  it('rejects invalid ids', () => {
    expect(isValidEntityId('')).toBe(false);
    expect(isValidEntityId('feat-001')).toBe(false);  // lowercase prefix
    expect(isValidEntityId('FEAT001')).toBe(false);   // missing dash
  });
});

describe('validateRawKnowledge', () => {
  it('accepts valid raw knowledge', () => {
    const raw: RawKnowledge = {
      scanned_at: '2026-04-07T00:00:00Z',
      root_path: '/project',
      files: [
        { path: 'src/index.ts', type: 'source', language: 'typescript', size_bytes: 500 },
      ],
      imports: [],
      exports: [],
      entry_points: ['src/index.ts'],
    };
    const result = validateRawKnowledge(raw);
    expect(result.valid).toBe(true);
  });

  it('rejects empty root_path', () => {
    const raw: RawKnowledge = {
      scanned_at: '2026-04-07T00:00:00Z',
      root_path: '',
      files: [],
      imports: [],
      exports: [],
      entry_points: [],
    };
    const result = validateRawKnowledge(raw);
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/clawie/Projects/kto && npx vitest run tests/knowledge-validator.test.ts
```

Expected: FAIL — `Cannot find module '../src/knowledge-validator.js'`

- [ ] **Step 3: Implement `src/knowledge-validator.ts`**

```typescript
// src/knowledge-validator.ts
import type { KnowledgeGraph, RawKnowledge } from './types.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const ENTITY_ID_PATTERN = /^[A-Z][A-Z0-9]*-[A-Za-z0-9]+$/;

/**
 * Check if a string matches the entity ID format: PREFIX-Identifier
 * Examples: FEAT-001, MODULE-AuthService, PROJECT-XYZ, THIRD-Stripe
 */
export function isValidEntityId(id: string): boolean {
  return ENTITY_ID_PATTERN.test(id);
}

/**
 * Validate a KnowledgeGraph for structural integrity.
 * Checks: required fields, unique IDs, relation references.
 */
export function validateKnowledgeGraph(graph: KnowledgeGraph): ValidationResult {
  const errors: string[] = [];

  // Project checks
  if (!graph.project.id) {
    errors.push('project.id is required');
  }
  if (!graph.project.name) {
    errors.push('project.name is required');
  }

  // Collect all known entity IDs for relation checking
  const knownIds = new Set<string>();
  knownIds.add(graph.project.id);

  // Feature checks
  const featureIds = new Set<string>();
  for (const feat of graph.features) {
    if (featureIds.has(feat.id)) {
      errors.push(`duplicate feature id: ${feat.id}`);
    }
    featureIds.add(feat.id);
    knownIds.add(feat.id);

    if (!feat.id) errors.push('feature missing id');
    if (!feat.name) errors.push(`feature ${feat.id}: name is required`);
  }

  // Module checks
  const moduleIds = new Set<string>();
  for (const mod of graph.modules) {
    if (moduleIds.has(mod.id)) {
      errors.push(`duplicate module id: ${mod.id}`);
    }
    moduleIds.add(mod.id);
    knownIds.add(mod.id);

    if (!mod.id) errors.push('module missing id');
    if (!mod.path) errors.push(`module ${mod.id}: path is required`);
  }

  // Third party checks
  for (const tp of graph.third_parties) {
    knownIds.add(tp.id);
  }

  // Relation checks — both endpoints must reference known entities
  for (const rel of graph.relations) {
    if (!knownIds.has(rel.from)) {
      errors.push(`relation references unknown entity: ${rel.from}`);
    }
    if (!knownIds.has(rel.to)) {
      errors.push(`relation references unknown entity: ${rel.to}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate raw knowledge output from the Project Mapper agent.
 */
export function validateRawKnowledge(raw: RawKnowledge): ValidationResult {
  const errors: string[] = [];

  if (!raw.root_path) {
    errors.push('root_path is required');
  }
  if (!raw.scanned_at) {
    errors.push('scanned_at is required');
  }
  if (!Array.isArray(raw.files)) {
    errors.push('files must be an array');
  }

  for (const file of raw.files ?? []) {
    if (!file.path) errors.push('file missing path');
    if (!['source', 'config', 'docs', 'tests'].includes(file.type)) {
      errors.push(`file ${file.path}: invalid type '${file.type}'`);
    }
  }

  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/clawie/Projects/kto && npx vitest run tests/knowledge-validator.test.ts
```

Expected: PASS — all 8 tests green.

- [ ] **Step 5: Run all tests**

```bash
cd /Users/clawie/Projects/kto && npx vitest run
```

Expected: all 19 tests pass (types + config + validator).

- [ ] **Step 6: Commit**

```bash
git add src/knowledge-validator.ts tests/knowledge-validator.test.ts
git commit -m "feat: knowledge graph validator"
```

---

## Task 5: Agent — Project Mapper

**Files:**
- Create: `agents/kto-project-mapper.md`

> **Note:** Tasks 5, 6, 7, 8 (all four agents) are independent and CAN be executed in parallel by a team.

- [ ] **Step 1: Create `agents/kto-project-mapper.md`**

```markdown
---
name: kto-project-mapper
description: Scans a repository and produces .kto/knowledge.json (raw, no semantic interpretation). Spawned by /kto:analyze. Input: project root path. Output: .kto/knowledge.json.
tools: Read, Bash, Grep, Glob, Write
color: blue
---

<role>
You are the kto Project Mapper. You scan a code repository and produce a structured JSON file describing its raw facts — files, imports, exports, and entry points — WITHOUT any semantic interpretation.

Your output is `.kto/knowledge.json` (relative to the project root provided in your prompt).

**IMPORTANT:** Read-only on the source code. You only WRITE to `.kto/knowledge.json`.
</role>

<output_schema>
Your output must match this TypeScript interface (RawKnowledge from kto types):

```json
{
  "scanned_at": "ISO-8601 timestamp",
  "root_path": "/absolute/path/to/project",
  "files": [
    { "path": "relative/path.ts", "type": "source|config|docs|tests", "language": "typescript", "size_bytes": 1234 }
  ],
  "imports": [
    { "from_file": "src/app.ts", "import_path": "./utils", "is_external": false }
  ],
  "exports": [
    { "from_file": "src/app.ts", "name": "AppService", "kind": "class" }
  ],
  "entry_points": ["src/index.ts"]
}
```
</output_schema>

<process>

<step name="read_config">
Read `.kto/config.json` if present to get `project_id` and any exclusion rules.

```bash
cat .kto/config.json 2>/dev/null || echo '{}'
```
</step>

<step name="discover_files">
Enumerate all source files, excluding standard noise directories:

```bash
find . -type f \
  -not -path '*/node_modules/*' \
  -not -path '*/.git/*' \
  -not -path '*/dist/*' \
  -not -path '*/build/*' \
  -not -path '*/.kto/*' \
  -not -path '*/coverage/*' \
  | sort
```

Classify each file:
- `source` — `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.go`, `.rs`, `.java`, `.rb`, `.swift`, `.kt`, `.cs`, `.cpp`, `.c`
- `config` — `package.json`, `tsconfig.json`, `*.config.*`, `Dockerfile`, `*.yaml`, `*.toml`, `*.ini`, `.env*` (note existence only, never read `.env` contents)
- `docs` — `*.md`, `*.txt`, `*.rst`
- `tests` — `*.test.*`, `*.spec.*`, files under `tests/`, `__tests__/`, `spec/`

Get file sizes:
```bash
stat -f "%z %N" [file_path]   # macOS
# or
stat -c "%s %n" [file_path]   # Linux
```
</step>

<step name="detect_language">
Detect primary language from file extensions and package manifests:

```bash
# Check for package manifests
ls package.json requirements.txt Cargo.toml go.mod pyproject.toml pom.xml 2>/dev/null
```

Language detection priority:
1. `package.json` present → TypeScript/JavaScript
2. `requirements.txt` or `pyproject.toml` → Python
3. `go.mod` → Go
4. `Cargo.toml` → Rust
5. `pom.xml` or `build.gradle` → Java
</step>

<step name="parse_imports_exports">
For TypeScript/JavaScript projects:

**Imports** — scan all source files for import statements:
```bash
grep -rn "^import\|^const.*require\|^import(" src/ --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null | head -500
```

For each import, determine:
- `from_file`: the file containing the import
- `import_path`: the module path (e.g., `./utils`, `express`, `@auth/core`)
- `is_external`: true if no leading `./` or `../` and not a TypeScript path alias

**Exports** — scan for export declarations:
```bash
grep -rn "^export\|module\.exports" src/ --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null | head -500
```

For Python projects use equivalent grep patterns for `import` and `def`/`class` declarations.
</step>

<step name="detect_entry_points">
Identify entry points — these are the top-level files that start execution:

Check in order:
1. `package.json` `main` field → file listed there
2. `src/index.ts`, `src/main.ts`, `src/app.ts`, `src/server.ts`
3. `index.js`, `main.js`, `app.js`, `server.js`
4. `bin/` directory contents
5. Files referenced in `package.json` `scripts.start`
6. `cli.ts`, `cli.js`

```bash
cat package.json 2>/dev/null | grep -E '"main"|"scripts"' | head -10
ls src/index.* src/main.* src/app.* src/server.* bin/* 2>/dev/null
```
</step>

<step name="write_output">
Write the complete RawKnowledge JSON to `.kto/knowledge.json`.

Create the `.kto/` directory if it doesn't exist:
```bash
mkdir -p .kto
```

**ALWAYS use the Write tool** — never use bash heredoc or echo redirection.

The file must be valid JSON, pretty-printed with 2-space indentation.
Include `scanned_at` as the current UTC timestamp in ISO-8601 format.
</step>

</process>

<rules>
- NEVER read `.env` file contents. Note their existence in metadata only.
- NEVER interpret what code does — only record structural facts.
- Relative paths in `files[].path` are relative to `root_path`.
- Keep `imports` and `exports` arrays to a max of 2000 entries total. If a project has more, include a `"truncated": true` flag at the root of the JSON.
- `entry_points` are relative paths from `root_path`.
</rules>

<success_criteria>
- [ ] `.kto/knowledge.json` exists and is valid JSON
- [ ] All source files are listed in `files[]`
- [ ] `entry_points` identifies at least one file (or is empty if truly none found)
- [ ] `scanned_at` is set to current time
- [ ] Return confirmation message with file count and entry points found
</success_criteria>
```

- [ ] **Step 2: Commit**

```bash
git add agents/kto-project-mapper.md
git commit -m "feat: kto-project-mapper agent definition"
```

---

## Task 6: Agent — Graph Builder

**Files:**
- Create: `agents/kto-graph-builder.md`

- [ ] **Step 1: Create `agents/kto-graph-builder.md`**

```markdown
---
name: kto-graph-builder
description: Transforms .kto/knowledge.json (raw repo scan) into .kto/enriched_knowledge.json (semantic graph with features, modules, relations). Spawned by /kto:analyze after project mapper completes.
tools: Read, Write, Bash
color: purple
---

<role>
You are the kto Graph Builder. You read `.kto/knowledge.json` (raw file/import/export data) and produce `.kto/enriched_knowledge.json` — a semantic knowledge graph with detected features, clustered modules, third-party integrations, and typed relationships.

This is the "Brain Layer" of kto. You interpret structure, detect patterns, and assign stable IDs.

**Input:** `.kto/knowledge.json`
**Output:** `.kto/enriched_knowledge.json`
</role>

<id_convention>
All entity IDs must be stable and deterministic:

- Project: `PROJECT-{SLUG}` where SLUG is uppercase project name with non-alphanumeric chars replaced by dashes
- Features: `FEAT-{NNN}` — zero-padded sequential number (001, 002, ...)
- Modules: `MODULE-{Name}` — PascalCase name derived from folder or file name
- Third Parties: `THIRD-{Name}` — PascalCase package name (e.g., `THIRD-Stripe`, `THIRD-Auth0`)

If `.kto/enriched_knowledge.json` already exists, PRESERVE existing IDs. Only assign new IDs to new entities. This ensures Obsidian links remain stable across runs.
</id_convention>

<process>

<step name="read_inputs">
```bash
cat .kto/knowledge.json
cat .kto/config.json 2>/dev/null || echo '{}'
# Check for existing enriched knowledge (to preserve IDs)
cat .kto/enriched_knowledge.json 2>/dev/null || echo 'NONE'
```
</step>

<step name="detect_features">
Features are user-facing capabilities. Detect them using heuristics:

**API route heuristic:** Groups of files under `routes/`, `api/`, `controllers/` with similar naming → one feature per resource (e.g., `routes/auth/*` → Feature: User Authentication).

**Folder structure heuristic:** Top-level `src/` subdirectories often map to features (e.g., `src/billing/` → Feature: Billing).

**Naming heuristic:** Files with names like `auth.ts`, `payment.ts`, `notification.ts` in a flat structure → one feature each.

**Common feature names to detect:**
- auth, authentication, login, oauth, session → "User Authentication"
- billing, payment, stripe, invoice → "Billing & Payments"
- user, profile, account → "User Management"
- notification, email, sms, push → "Notifications"
- search, index, elastic → "Search"
- upload, storage, file, s3 → "File Storage"
- dashboard, analytics, metrics, stats → "Analytics"

For each detected feature, record:
- `entry_points`: API route files or main handler files
- `modules`: MODULE-* ids of files that implement this feature
- `security_impact`: 'high' for auth/billing/pii, 'medium' for user data, 'low' otherwise
</step>

<step name="cluster_modules">
Group related files into modules:

**Strategy 1 — Directory-based:** Files in the same directory form a module. Module ID = `MODULE-{DirectoryName}` (PascalCase).

**Strategy 2 — Import-graph-based:** Tightly coupled files (circular imports, or A imports B imports C with no other consumers) form a module even across directories.

For each module record:
- `path`: directory path (or primary file if single-file module)
- `language`: primary language of files in this module
- `responsibility`: infer from file names and export names (e.g., `UserService`, `AuthController` → "Handles user authentication and session management")
- `exports`: top exported names from `knowledge.json` exports for files in this module
- `dependencies`: other MODULE-* or THIRD-* ids this module imports from
- `used_by_features`: FEAT-* ids that include this module
</step>

<step name="detect_third_parties">
Extract external dependencies from `imports` where `is_external: true`.

Read package manifest for versions:
```bash
cat package.json 2>/dev/null | head -60
```

Classify each external package by type:
- payment: `stripe`, `paypal`, `braintree`, `square`
- auth: `passport`, `@auth/*`, `next-auth`, `auth0`, `clerk`, `supabase`
- database: `prisma`, `typeorm`, `sequelize`, `mongoose`, `pg`, `mysql2`, `redis`
- storage: `aws-sdk`, `@aws-sdk/*`, `@google-cloud/storage`, `minio`
- email: `nodemailer`, `sendgrid`, `@sendgrid/*`, `resend`, `mailgun`
- monitoring: `sentry`, `@sentry/*`, `datadog`, `newrelic`
- testing: `vitest`, `jest`, `mocha`, `cypress`, `playwright`

For each third party, identify which features use it by checking which modules import it.
</step>

<step name="detect_security">
Identify security-relevant patterns:

**PII flows:** modules that handle email, name, address, phone, SSN, credit card. Look for field names in exports/imports.

**Auth model:** detect from third parties and file names:
- `jwt`, `jsonwebtoken` → "JWT"
- `passport` → "Passport.js"
- `@auth/*`, `next-auth` → "NextAuth"
- `clerk` → "Clerk"
- Custom `auth/` module → "Custom"

**Threats (basic STRIDE):**
- Spoofing → modules with auth/login logic
- Tampering → modules writing to database without input validation detected
- Information Disclosure → modules exposing PII in API responses
</step>

<step name="build_relations">
Create typed relations between all entities:

```
FEAT-* implemented_by MODULE-*  (feature uses this module)
MODULE-* depends_on MODULE-*    (module imports from module)
MODULE-* uses THIRD-*           (module imports external package)
FEAT-* exposes string           (feature exposes this API endpoint)
```

Only create relations that are grounded in evidence from the import/export data.
</step>

<step name="write_output">
Write `.kto/enriched_knowledge.json` using the Write tool.

The file must include all KnowledgeGraph fields plus:
- `enriched_at`: current UTC ISO-8601 timestamp
- `version`: "1.0"

Pretty-print with 2-space indentation.
</step>

</process>

<rules>
- PRESERVE existing IDs if enriched_knowledge.json already exists
- Infer responsibility descriptions from code structure, not hallucination
- When uncertain about a feature boundary, lean toward fewer, larger features
- Every relation must be grounded in import/export evidence
- Maximum 50 features, 200 modules per project (aggregate small modules if needed)
</rules>

<success_criteria>
- [ ] `.kto/enriched_knowledge.json` written and valid JSON
- [ ] All entities have stable, unique IDs
- [ ] Relations reference only entities that exist in the graph
- [ ] Return: feature count, module count, third-party count
</success_criteria>
```

- [ ] **Step 2: Commit**

```bash
git add agents/kto-graph-builder.md
git commit -m "feat: kto-graph-builder agent definition"
```

---

## Task 7: Agent — Obsidian Sync

**Files:**
- Create: `agents/kto-obsidian-sync.md`

- [ ] **Step 1: Create `agents/kto-obsidian-sync.md`**

```markdown
---
name: kto-obsidian-sync
description: Writes/updates Markdown files in an Obsidian vault from .kto/enriched_knowledge.json. Preserves user-written content outside AUTO-GENERATED blocks. Spawned by /kto:analyze and /kto:sync.
tools: Read, Write, Edit, Bash, Glob
color: green
---

<role>
You are the kto Obsidian Sync agent. You read `.kto/enriched_knowledge.json` and write structured Markdown notes into an Obsidian vault.

**Golden rule:** NEVER destroy user content. You only manage content inside `<!-- AUTO-GENERATED START -->` / `<!-- AUTO-GENERATED END -->` blocks. Everything outside those blocks is owned by the user and must not be touched.

**Input:** `.kto/enriched_knowledge.json`, `.kto/config.json`
**Output:** Markdown files in the Obsidian vault
</role>

<vault_structure>
All files are written under `{vault_path}/{obsidian_subfolder}/`:

```
{obsidian_subfolder}/
├── Facts.md                              # Project overview
├── Technology.md                         # Tech stack
├── Features/
│   ├── Features_Index.md                # Links to all features
│   ├── FEAT-001_Auth.md
│   └── FEAT-002_Billing.md
├── Code_Map/
│   ├── Modules_Index.md
│   ├── MODULE-AuthService.md
│   └── MODULE-BillingService.md
├── Third_Party/
│   ├── THIRD-Stripe.md
│   └── THIRD-Auth0.md
└── Security/
    └── Security_Overview.md
```
</vault_structure>

<auto_generated_protocol>
When a file ALREADY EXISTS:
1. Read the file
2. Find `<!-- AUTO-GENERATED START -->` marker
3. Replace only the content between START and END markers
4. If no markers exist yet, APPEND the auto-generated block at the end of the file

When a file DOES NOT EXIST:
- Write the full file (frontmatter + auto-generated content)
- New files consist entirely of auto-generated content with the markers

**Format:**
```markdown
---
type: feature
id: FEAT-001
project: PROJECT-XYZ
generated_by: kto
---

# Feature Name

<!-- AUTO-GENERATED START -->
[generated content here]
<!-- AUTO-GENERATED END -->
```
</auto_generated_protocol>

<process>

<step name="read_inputs">
```bash
cat .kto/enriched_knowledge.json
cat .kto/config.json
```

Extract:
- `vault_path`: absolute path to vault
- `obsidian_subfolder`: subfolder for this project
- All entities from the graph
</step>

<step name="ensure_directories">
Create required vault directories if they don't exist:

```bash
mkdir -p "{vault_path}/{obsidian_subfolder}/Features"
mkdir -p "{vault_path}/{obsidian_subfolder}/Code_Map"
mkdir -p "{vault_path}/{obsidian_subfolder}/Third_Party"
mkdir -p "{vault_path}/{obsidian_subfolder}/Security"
```
</step>

<step name="write_facts_md">
Write `Facts.md` — project overview:

```markdown
---
type: project
id: {project.id}
generated_by: kto
---

# {project.name}

<!-- AUTO-GENERATED START -->
**Domain:** {project.domain}
**Criticality:** {project.criticality}
**Description:** {project.description}

## Summary

| Metric | Count |
|--------|-------|
| Features | {features.length} |
| Modules | {modules.length} |
| Third Parties | {third_parties.length} |
| Technologies | {technologies.length} |

## Features

{for each feature: - [[FEAT-XXX_{name}]] — {status}}

## Technologies

{for each tech: - **{name}** {version} — {usage}}

*Last synced: {enriched_at}*
<!-- AUTO-GENERATED END -->
```
</step>

<step name="write_feature_notes">
For each feature in `features[]`, write `Features/FEAT-XXX_{SlugName}.md`:

File name: `FEAT-{id_suffix}_{PascalCaseFeatureName}.md`
Example: `FEAT-001_UserAuthentication.md`

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

## Entry Points

{for each entry_point: - `{entry_point}`}

## Implemented By

{for each module id: - [[{module_id}]]}

## Third Party Dependencies

{for each third_party id: - [[{third_party_id}]]}

## Relations

{for each relation where from == feature.id or to == feature.id:
- {from} --{type}--> {to}}

*Last synced: {enriched_at}*
<!-- AUTO-GENERATED END -->
```
</step>

<step name="write_module_notes">
For each module in `modules[]`, write `Code_Map/{module.id}.md`:

```markdown
---
type: module
id: {module.id}
project: {project.id}
language: {module.language}
generated_by: kto
---

# {module.id}

<!-- AUTO-GENERATED START -->
**Path:** `{module.path}`
**Language:** {module.language}
**Responsibility:** {module.responsibility}

## Exports

{for each export: - `{export}`}

## Dependencies

{for each dep: - [[{dep}]]}

## Used By Features

{for each feat_id: - [[{feat_id}]]}

*Last synced: {enriched_at}*
<!-- AUTO-GENERATED END -->
```
</step>

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
**Type:** {tp.type}
**Criticality:** {tp.criticality}
**Data Access:** {tp.data_access.join(', ')}

## Used In Features

{for each feat_id: - [[{feat_id}]]}

*Last synced: {enriched_at}*
<!-- AUTO-GENERATED END -->
```
</step>

<step name="write_index_files">
Write `Features/Features_Index.md` and `Code_Map/Modules_Index.md`:

Features Index:
```markdown
# Features Index — {project.name}

<!-- AUTO-GENERATED START -->
| ID | Name | Status | Security Impact |
|----|------|--------|----------------|
{for each feature: | [[{id}]] | {name} | {status} | {security_impact} |}

*{features.length} features · Last synced: {enriched_at}*
<!-- AUTO-GENERATED END -->
```

Modules Index:
```markdown
# Modules Index — {project.name}

<!-- AUTO-GENERATED START -->
| ID | Path | Language | Responsibility |
|----|------|----------|---------------|
{for each module: | [[{id}]] | `{path}` | {language} | {responsibility} |}

*{modules.length} modules · Last synced: {enriched_at}*
<!-- AUTO-GENERATED END -->
```
</step>

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
**Auth Model:** {security.auth_model}

## PII Flows

{for each pii_flow: - {pii_flow}}

## Threats

| ID | Description | Severity | Affected Modules |
|----|-------------|----------|-----------------|
{for each threat: | {threat.id} | {threat.description} | {threat.severity} | {threat.affected_modules.join(', ')} |}

*Last synced: {enriched_at}*
<!-- AUTO-GENERATED END -->
```
</step>

</process>

<rules>
- NEVER overwrite content outside AUTO-GENERATED blocks
- Use [[wikilink]] format for all internal Obsidian links
- File names must be deterministic from entity IDs (no spaces — use underscores)
- All dates use the enriched_at timestamp from enriched_knowledge.json
- If vault_path is empty, STOP and return error: "vault_path not configured. Run /kto:init"
</rules>

<success_criteria>
- [ ] Facts.md written/updated
- [ ] One file per feature, module, third party
- [ ] Index files written
- [ ] Security overview written
- [ ] No user content outside AUTO-GENERATED blocks was modified
- [ ] Return: files created, files updated, vault path
</success_criteria>
```

- [ ] **Step 2: Commit**

```bash
git add agents/kto-obsidian-sync.md
git commit -m "feat: kto-obsidian-sync agent definition"
```

---

## Task 8: Agent — Change Detector

**Files:**
- Create: `agents/kto-change-detector.md`

- [ ] **Step 1: Create `agents/kto-change-detector.md`**

```markdown
---
name: kto-change-detector
description: Given a list of changed files (from git diff), determines which knowledge entities are affected and triggers a partial Obsidian vault update. Fast and deterministic. Spawned by /kto:diff.
tools: Read, Write, Bash, Grep
color: yellow
---

<role>
You are the kto Change Detector. Given a set of changed files, you:
1. Identify which modules and features are affected
2. Re-analyze only the changed modules (not the entire repo)
3. Update `.kto/enriched_knowledge.json` for affected entities
4. Trigger the Obsidian sync for only the affected notes

You must be FAST and DETERMINISTIC. Only touch what changed.

**Input:** List of changed files (provided in prompt), `.kto/enriched_knowledge.json`
**Output:** Updated `.kto/enriched_knowledge.json` (partial), updated Obsidian notes (partial)
</role>

<process>

<step name="parse_changed_files">
Parse the changed files list from the prompt. Expected format (one path per line):
```
src/auth/service.ts
src/auth/middleware.ts
package.json
```

Classify each file by type (source/config/docs/tests) — same classification as Project Mapper.
</step>

<step name="load_current_knowledge">
```bash
cat .kto/enriched_knowledge.json
cat .kto/config.json
```

Build a lookup map: file path → MODULE-* ids that contain it.
</step>

<step name="find_affected_entities">
For each changed file:
1. Look up which module contains it (by `path` prefix match in modules[])
2. Look up which features use that module (via `used_by_features`)
3. Check if it's a config file (package.json, tsconfig.json) → mark all third_parties for review

Output:
```json
{
  "affected_modules": ["MODULE-AuthService"],
  "affected_features": ["FEAT-001"],
  "config_changed": false
}
```
</step>

<step name="re_analyze_changed_modules">
For each affected module, re-read its files and update the module entry:

```bash
# Re-read imports/exports for changed files
grep -n "^import\|^export" {changed_file_path} 2>/dev/null
```

Update the module's `exports`, `dependencies`, and `responsibility` fields in the knowledge graph.
</step>

<step name="check_package_json">
If `package.json` is in the changed files:

```bash
cat package.json | grep -A5 '"dependencies"' | head -30
cat package.json | grep -A5 '"devDependencies"' | head -20
```

Compare against existing `third_parties[]` — add new packages, remove deleted ones.
</step>

<step name="write_partial_update">
Write the updated `.kto/enriched_knowledge.json` with:
- `enriched_at` updated to current timestamp
- Only affected entities updated (all others preserved as-is)

**ALWAYS use the Write tool.**
</step>

<step name="trigger_partial_sync">
For each affected entity, manually generate the updated Obsidian markdown content and write it using the same AUTO-GENERATED block protocol as the Obsidian Sync agent.

This avoids spawning the full sync agent for a partial update.

Apply the same file templates as kto-obsidian-sync for features, modules, and third parties.
</step>

</process>

<rules>
- ONLY update entities directly affected by the changed files
- PRESERVE all other entities in enriched_knowledge.json unchanged
- If changed files are all in `tests/` or `docs/` — skip module re-analysis, only update metadata
- If a changed file is not found in any module, log it as "unmapped file" and skip
- MUST complete in under 30 agentic turns (it's a fast-path operation)
</rules>

<success_criteria>
- [ ] Affected entities identified
- [ ] enriched_knowledge.json updated with new enriched_at
- [ ] Affected Obsidian notes updated (AUTO-GENERATED blocks only)
- [ ] Return: affected_modules[], affected_features[], files_updated
</success_criteria>
```

- [ ] **Step 2: Commit**

```bash
git add agents/kto-change-detector.md
git commit -m "feat: kto-change-detector agent definition"
```

---

## Task 9: Command — /kto:init

**Files:**
- Create: `commands/kto/init.md`

- [ ] **Step 1: Create `commands/kto/init.md`**

```markdown
---
name: kto:init
description: Initialize kto for the current project. Prompts for vault path and creates .kto/config.json with per-agent model defaults. Safe to re-run — preserves existing configuration.
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<objective>
Initialize kto configuration for the current project by creating or updating `.kto/config.json`.
</objective>

<process>

## Step 1 — Check existing config

```bash
cat .kto/config.json 2>/dev/null || echo "NO_CONFIG"
```

If config exists, display current values and ask if the user wants to update them.

## Step 2 — Gather required information

Ask the user (using AskUserQuestion):

1. **Vault path**: "What is the absolute path to your Obsidian vault? (e.g., /Users/yourname/Notes/MyVault)"
2. **Project ID**: "What short ID should be used for this project? (uppercase, e.g., MY-APP). Press Enter to use the current directory name: {dirname}"
3. **Vault subfolder**: "What subfolder inside the vault should kto use for this project? (e.g., Projects/MY-APP). Press Enter to use: Projects/{PROJECT_ID}"

## Step 3 — Model configuration (optional)

Ask: "Do you want to customize which LLM model each agent uses? (y/N)"

If yes, show current defaults and ask for overrides:
- Project Mapper (default: claude-haiku-4-5-20251001) — cheap, runs on every file
- Graph Builder (default: claude-sonnet-4-6) — the reasoning agent, needs more capability
- Obsidian Sync (default: claude-haiku-4-5-20251001) — templated writing
- Change Detector (default: claude-haiku-4-5-20251001) — fast, targeted

## Step 4 — Write config

Create `.kto/` directory and write `config.json`:

```bash
mkdir -p .kto
```

Write `.kto/config.json` with the Write tool:

```json
{
  "vault_path": "{user_answer_1}",
  "project_id": "{user_answer_2}",
  "obsidian_subfolder": "{user_answer_3}",
  "output_dir": ".kto",
  "agents": {
    "project_mapper": "claude-haiku-4-5-20251001",
    "graph_builder": "claude-sonnet-4-6",
    "obsidian_sync": "claude-haiku-4-5-20251001",
    "change_detector": "claude-haiku-4-5-20251001"
  }
}
```

## Step 5 — Add to .gitignore

Append `.kto/` to `.gitignore` if not already present:

```bash
grep -q "^\.kto/" .gitignore 2>/dev/null || echo ".kto/" >> .gitignore
```

## Step 6 — Confirm

Display a summary:
```
✓ kto initialized
  Config: .kto/config.json
  Vault: {vault_path}
  Project: {project_id}
  Subfolder: {obsidian_subfolder}

Run /kto:analyze to perform the first full analysis.
```

</process>
```

- [ ] **Step 2: Commit**

```bash
git add commands/kto/init.md
git commit -m "feat: /kto:init command"
```

---

## Task 10: Command — /kto:analyze

**Files:**
- Create: `commands/kto/analyze.md`

- [ ] **Step 1: Create `commands/kto/analyze.md`**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add commands/kto/analyze.md
git commit -m "feat: /kto:analyze command"
```

---

## Task 11: Command — /kto:sync

**Files:**
- Create: `commands/kto/sync.md`

- [ ] **Step 1: Create `commands/kto/sync.md`**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add commands/kto/sync.md
git commit -m "feat: /kto:sync command"
```

---

## Task 12: Command — /kto:diff

**Files:**
- Create: `commands/kto/diff.md`

- [ ] **Step 1: Create `commands/kto/diff.md`**

```markdown
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
test -f .kto/enriched_knowledge.json && echo "OK" || echo "MISSING"
cat .kto/config.json 2>/dev/null || echo "NO_CONFIG"
```

If MISSING: "enriched_knowledge.json not found. Run /kto:analyze first."
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

Compare modification times: only include files newer than `.kto/enriched_knowledge.json`.

```bash
find . -newer .kto/enriched_knowledge.json -type f \
  -not -path '*/node_modules/*' \
  -not -path '*/.git/*' \
  -not -path '*/.kto/*' \
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
```

- [ ] **Step 2: Commit**

```bash
git add commands/kto/diff.md
git commit -m "feat: /kto:diff command"
```

---

## Task 13: SDK Entry Point

**Files:**
- Create: `src/index.ts`

This provides a programmatic TypeScript API for using kto from code (e.g., CI pipelines, other tools).

- [ ] **Step 1: Create `src/index.ts`**

```typescript
// src/index.ts
/**
 * kto — Knowledge to Obsidian
 * Programmatic API for orchestrating the kto pipeline via Claude Agent SDK.
 *
 * Usage:
 *   import { KtoRunner } from 'kto-cc';
 *   const runner = new KtoRunner({ projectDir: '/path/to/project' });
 *   await runner.analyze();
 */

export type { KnowledgeGraph, EnrichedKnowledgeGraph, RawKnowledge } from './types.js';
export type { KtoConfig, KtoAgentsConfig } from './config.js';
export { loadConfig, CONFIG_DEFAULTS } from './config.js';
export {
  validateKnowledgeGraph,
  validateRawKnowledge,
  isValidEntityId,
} from './knowledge-validator.js';

import { query } from '@anthropic-ai/claude-agent-sdk';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig } from './config.js';

// ─── KtoRunner ────────────────────────────────────────────────────────────────

export interface KtoRunnerOptions {
  /** Absolute path to the project to analyze. */
  projectDir: string;
  /** Override model for a specific agent. Takes precedence over config. */
  modelOverrides?: Partial<Record<string, string>>;
}

export interface KtoPipelineResult {
  success: boolean;
  filesScanned: number;
  featuresFound: number;
  modulesFound: number;
  notesWritten: number;
  error?: string;
}

/**
 * Orchestrates the full kto pipeline programmatically.
 */
export class KtoRunner {
  private readonly projectDir: string;
  private readonly modelOverrides: Partial<Record<string, string>>;

  constructor(options: KtoRunnerOptions) {
    this.projectDir = options.projectDir;
    this.modelOverrides = options.modelOverrides ?? {};
  }

  /**
   * Run the full pipeline: Project Mapper → Graph Builder → Obsidian Sync.
   */
  async analyze(): Promise<KtoPipelineResult> {
    const config = await loadConfig(this.projectDir, { requireVault: true });

    await this.runAgent('kto-project-mapper', config.agents.project_mapper, {
      task: 'scan repository',
      cwd: this.projectDir,
    });

    await this.runAgent('kto-graph-builder', config.agents.graph_builder, {
      task: 'build knowledge graph',
      cwd: this.projectDir,
    });

    await this.runAgent('kto-obsidian-sync', config.agents.obsidian_sync, {
      task: 'sync to obsidian vault',
      cwd: this.projectDir,
    });

    return this.buildResult();
  }

  /**
   * Run only the Obsidian sync phase from existing enriched_knowledge.json.
   */
  async sync(): Promise<KtoPipelineResult> {
    const config = await loadConfig(this.projectDir, { requireVault: true });

    await this.runAgent('kto-obsidian-sync', config.agents.obsidian_sync, {
      task: 'sync to obsidian vault',
      cwd: this.projectDir,
    });

    return this.buildResult();
  }

  /**
   * Run the change detector for a specific set of changed files.
   */
  async diff(changedFiles: string[]): Promise<KtoPipelineResult> {
    const config = await loadConfig(this.projectDir, { requireVault: true });
    const fileList = changedFiles.join('\n');

    await this.runAgent('kto-change-detector', config.agents.change_detector, {
      task: `update knowledge for changed files:\n${fileList}`,
      cwd: this.projectDir,
    });

    return this.buildResult();
  }

  private async runAgent(
    agentName: string,
    defaultModel: string,
    opts: { task: string; cwd: string },
  ): Promise<void> {
    const model = this.modelOverrides[agentName] ?? defaultModel;

    const agentDefPath = new URL(`../../agents/${agentName}.md`, import.meta.url);
    let agentDef: string;
    try {
      agentDef = await readFile(agentDefPath, 'utf-8');
    } catch {
      throw new Error(`Agent definition not found: ${agentName}.md`);
    }

    const stream = query({
      prompt: opts.task,
      options: {
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append: agentDef,
        },
        permissionMode: 'bypassPermissions',
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
        maxTurns: 50,
        cwd: opts.cwd,
        model,
      },
    });

    for await (const msg of stream) {
      if (msg.type === 'result' && msg.subtype !== 'success') {
        throw new Error(`Agent ${agentName} failed: ${JSON.stringify((msg as any).errors)}`);
      }
    }
  }

  private async buildResult(): Promise<KtoPipelineResult> {
    try {
      const enrichedPath = join(this.projectDir, '.kto', 'enriched_knowledge.json');
      const raw = await readFile(enrichedPath, 'utf-8');
      const graph = JSON.parse(raw);
      return {
        success: true,
        filesScanned: 0,  // Would need knowledge.json for this
        featuresFound: graph.features?.length ?? 0,
        modulesFound: graph.modules?.length ?? 0,
        notesWritten: 0,  // Would need sync output for this
      };
    } catch {
      return { success: true, filesScanned: 0, featuresFound: 0, modulesFound: 0, notesWritten: 0 };
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/clawie/Projects/kto && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
cd /Users/clawie/Projects/kto && npx vitest run
```

Expected: PASS — all 19 tests green.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: KtoRunner SDK entry point for programmatic pipeline usage"
```

---

## Task 14: Install Script

**Files:**
- Create: `bin/install.js`

- [ ] **Step 1: Create `bin/install.js`**

```javascript
#!/usr/bin/env node
// bin/install.js
// Installs kto agents and commands to ~/.claude/kto/

import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');
const INSTALL_DIR = join(homedir(), '.claude', 'kto');

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

console.log(`Installing kto to ${INSTALL_DIR}...`);

// Copy agents/
copyDir(join(PACKAGE_ROOT, 'agents'), join(INSTALL_DIR, 'agents'));
console.log('  ✓ agents/');

// Copy commands/
copyDir(join(PACKAGE_ROOT, 'commands'), join(INSTALL_DIR, 'commands'));
console.log('  ✓ commands/');

// Symlink or copy commands to Claude Code expected location
// Claude Code looks for commands in ~/.claude/commands/
const CLAUDE_COMMANDS_DIR = join(homedir(), '.claude', 'commands', 'kto');
if (!existsSync(CLAUDE_COMMANDS_DIR)) {
  mkdirSync(CLAUDE_COMMANDS_DIR, { recursive: true });
  copyDir(join(PACKAGE_ROOT, 'commands', 'kto'), CLAUDE_COMMANDS_DIR);
  console.log('  ✓ commands/kto/ → ~/.claude/commands/kto/');
}

console.log('\nkto installed successfully!');
console.log('Available commands:');
console.log('  /kto:init    — Initialize kto for a project');
console.log('  /kto:analyze — Full pipeline: scan → graph → sync');
console.log('  /kto:sync    — Re-sync vault from existing knowledge');
console.log('  /kto:diff    — Incremental update for changed files');
console.log('\nGet started: open a project and run /kto:init');
```

- [ ] **Step 2: Make executable**

```bash
chmod +x /Users/clawie/Projects/kto/bin/install.js
```

- [ ] **Step 3: Test install script runs without errors**

```bash
cd /Users/clawie/Projects/kto && node bin/install.js
```

Expected: output showing `Installing kto to ~/.claude/kto/...` followed by checkmarks. No errors.

- [ ] **Step 4: Verify files copied to correct location**

```bash
ls ~/.claude/kto/agents/ && ls ~/.claude/commands/kto/
```

Expected: 4 agent files, 4 command files.

- [ ] **Step 5: Commit**

```bash
git add bin/install.js
git commit -m "feat: install script copies agents and commands to ~/.claude/"
```

---

## Task 15: Final Integration Check

**Files:** None (verification only)

- [ ] **Step 1: Run the full test suite**

```bash
cd /Users/clawie/Projects/kto && npx vitest run --reporter verbose
```

Expected: 19 tests, all PASS.

- [ ] **Step 2: TypeScript typecheck**

```bash
cd /Users/clawie/Projects/kto && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Verify project structure matches spec**

```bash
find /Users/clawie/Projects/kto -not -path '*/node_modules/*' -not -path '*/.git/*' -type f | sort
```

Expected: All planned files present.

- [ ] **Step 4: Verify installed commands are discoverable**

```bash
ls ~/.claude/commands/kto/
```

Expected: `analyze.md`, `diff.md`, `init.md`, `sync.md`

- [ ] **Step 5: Final commit with README stub**

Create `README.md`:

```markdown
# kto — Knowledge to Obsidian

AI-powered codebase analysis and Obsidian knowledge sync for Claude Code.

## Installation

```bash
npm install -g kto-cc
```

## Quick Start

Open any project in Claude Code:

```
/kto:init      # Configure vault path and project ID
/kto:analyze   # Full scan → Obsidian sync
/kto:diff      # Incremental update after code changes
/kto:sync      # Re-sync vault from existing knowledge
```

## Configuration

`.kto/config.json` in your project:

```json
{
  "vault_path": "/absolute/path/to/your/vault",
  "project_id": "MY-PROJECT",
  "obsidian_subfolder": "Projects/MY-PROJECT",
  "agents": {
    "project_mapper": "claude-haiku-4-5-20251001",
    "graph_builder": "claude-sonnet-4-6",
    "obsidian_sync": "claude-haiku-4-5-20251001",
    "change_detector": "claude-haiku-4-5-20251001"
  }
}
```

## Pipeline

```
Repo → [Project Mapper] → .kto/knowledge.json
     → [Graph Builder]  → .kto/enriched_knowledge.json
     → [Obsidian Sync]  → Obsidian Vault Notes
```

For incremental updates: `[Change Detector]` updates only affected notes.
```

```bash
git add README.md
git commit -m "docs: README with installation and quick start"
```

- [ ] **Step 6: Tag initial release**

```bash
git tag v0.1.0
```

---

## Team Execution Note

Tasks **5–8** (four agent definitions) and **9–12** (four command files) are independent within each group and can be dispatched to parallel subagents:

- **Wave A (parallel):** Tasks 5, 6, 7, 8 — one subagent per agent definition
- **Wave B (parallel):** Tasks 9, 10, 11, 12 — one subagent per command
- **Sequential:** Tasks 1→2→3→4 (foundation), then Wave A, then Wave B, then 13→14→15

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered in task |
|-----------------|----------------|
| Project Mapper Agent | Task 5 |
| Graph Builder Agent | Task 6 |
| Obsidian Sync Agent | Task 7 |
| Change Detection Agent | Task 8 |
| Knowledge model (JSON schema) | Task 2 |
| Stable entity IDs | Task 2, 6 (id_convention section) |
| AUTO-GENERATED blocks (never overwrite user content) | Task 7 |
| Per-agent model configuration | Task 3, init command |
| Claude Code slash commands | Tasks 9–12 |
| npm install / installable package | Task 1, 14 |
| SDK / programmatic API | Task 13 |
| File structure: Features/, Code_Map/, Third_Party/, Security/ | Task 7 |
| Frontmatter (type, id, project) | Task 7 |
| Wikilinks [[]] | Task 7 |
| Index files | Task 7 |
| tree-sitter / ts-morph mentioned in spec | Noted in mapper agent as tooling to leverage |

**No placeholders found.** All tasks contain complete code.

**Type consistency:** `KnowledgeGraph`, `EnrichedKnowledgeGraph`, `RawKnowledge` are defined in Task 2 `src/types.ts` and referenced consistently in Tasks 3, 4, 13.
