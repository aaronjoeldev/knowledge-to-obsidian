import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateKnowledgeGraph } from '../src/knowledge-validator.js';
import type { KnowledgeGraph } from '../src/types.js';

const ROOT = process.cwd();

function baseGraph(): KnowledgeGraph {
  return {
    project: {
      id: 'PROJECT-XYZ',
      name: 'Core Pages Test Project',
      description: 'Fixture for core page validation.',
      domain: 'tooling',
      criticality: 'low',
    },
    features: [
      {
        id: 'FEAT-001',
        name: 'Overview',
        description: 'Overview feature mapping.',
        status: 'implemented',
        entry_points: ['src/overview.ts'],
        modules: ['MODULE-Architecture'],
        third_parties: ['THIRD-Index'],
        security_impact: 'low',
        wiki: {
          source_refs: [{ path: 'src/overview.ts' }],
          last_verified: '2026-04-10T10:00:00Z',
          page_target: 'Overview.md',
        },
      },
    ],
    modules: [
      {
        id: 'MODULE-Architecture',
        path: 'src/api/architecture/route.ts',
        language: 'typescript',
        responsibility: 'Exposes an API route for architecture overview data.',
        exports: [],
        dependencies: [],
        used_by_features: ['FEAT-001'],
        wiki: {
          source_refs: [{ path: 'src/api/architecture/route.ts' }],
          last_verified: '2026-04-10T10:00:00Z',
          page_target: 'Architecture.md',
        },
      },
      {
        id: 'MODULE-RunLog',
        path: 'src/api/run-log/route.ts',
        language: 'typescript',
        responsibility: 'Exposes an API route for sync run logs.',
        exports: [],
        dependencies: [],
        used_by_features: [],
        wiki: {
          source_refs: [{ path: 'src/api/run-log/route.ts' }],
          last_verified: '2026-04-10T10:00:00Z',
          page_target: 'Run_Log.md',
        },
      },
    ],
    third_parties: [
      {
        id: 'THIRD-Index',
        name: 'Indexer',
        type: 'search',
        data_access: [],
        criticality: 'low',
        used_in: ['FEAT-001'],
        wiki: {
          source_refs: [{ path: 'src/overview.ts' }],
          last_verified: '2026-04-10T10:00:00Z',
          page_target: 'Index.md',
        },
      },
    ],
    technologies: [],
    security: { threats: [], pii_flows: [], auth_model: 'JWT' },
    relations: [{ from: 'FEAT-001', to: 'MODULE-Architecture', type: 'implemented_by' }],
  };
}

describe('core pages and navigation contract', () => {
  it('sync instructions require mandatory generation/update for all core pages', () => {
    const content = readFileSync(join(ROOT, 'agents/kto-obsidian-sync.md'), 'utf8');
    expect(content).toContain('MANDATORY: create or update all four core pages on every sync run');
    for (const page of ['Overview.md', 'Architecture.md', 'Index.md', 'Run_Log.md']) {
      expect(content).toContain(page);
    }
  });

  it('wiki lint treats missing core pages and missing index root-note links as blocking', () => {
    const content = readFileSync(join(ROOT, 'agents/kto-wiki-lint.md'), 'utf8');
    expect(content).toMatch(/blocking error/i);
    for (const link of ['[[Overview]]', '[[Architecture]]', '[[Index]]', '[[Run_Log]]', '[[Facts]]', '[[Technology]]']) {
      expect(content).toContain(link);
    }
  });

  it('validator accepts graphs that reference all core page targets', () => {
    const result = validateKnowledgeGraph(baseGraph());
    expect(result.valid).toBe(true);
  });

  it('validator fails when one core page target reference is missing', () => {
    const graph = baseGraph();
    graph.third_parties[0]!.wiki.page_target = 'Third_Party/THIRD-Index.md';
    const result = validateKnowledgeGraph(graph);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('missing core page_target reference in graph: Index.md'))).toBe(true);
  });
});
