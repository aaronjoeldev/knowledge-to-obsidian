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
    name: 'Test Project',
    description: 'Knowledge graph validation fixture.',
    domain: 'developer-tooling',
    criticality: 'low',
  },
  features: [
    {
      id: 'FEAT-001',
      name: 'Auth',
      description: 'Handles user authentication.',
      status: 'implemented',
      entry_points: ['src/auth/index.ts'],
      modules: ['MODULE-Auth'],
      third_parties: ['THIRD-Indexer'],
      security_impact: 'high',
      wiki: {
        source_refs: [{ path: 'src/auth/index.ts' }],
        last_verified: '2026-04-10T10:00:00Z',
        page_target: 'Overview.md',
      },
    },
  ],
  modules: [
    {
      id: 'MODULE-Auth',
      path: 'src/auth/',
      language: 'typescript',
      responsibility: 'Implements authentication logic.',
      exports: [],
      dependencies: [],
      used_by_features: ['FEAT-001'],
      wiki: {
        source_refs: [{ path: 'src/auth/index.ts' }],
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
      id: 'THIRD-Indexer',
      name: 'Indexer',
      type: 'search',
      data_access: [],
      criticality: 'low',
      used_in: ['FEAT-001'],
      wiki: {
        source_refs: [{ path: 'src/auth/index.ts' }],
        last_verified: '2026-04-10T10:00:00Z',
        page_target: 'Index.md',
      },
    },
  ],
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
    expect(result.warnings).toHaveLength(0);
  });

  it('rejects feature without source_refs', () => {
    const bad = structuredClone(VALID_GRAPH);
    bad.features[0]!.wiki.source_refs = [];

    const result = validateKnowledgeGraph(bad);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('features[0].wiki.source_refs'))).toBe(true);
  });

  it('rejects third party without source_refs', () => {
    const bad = structuredClone(VALID_GRAPH);
    bad.third_parties[0]!.wiki.source_refs = [];

    const result = validateKnowledgeGraph(bad);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('third_parties[0].wiki.source_refs'))).toBe(true);
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

  it('rejects invalid enum values', () => {
    const bad = structuredClone(VALID_GRAPH);
    bad.project.criticality = 'critical' as any;
    const result = validateKnowledgeGraph(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('project.criticality'))).toBe(true);
  });

  it('rejects placeholder values', () => {
    const bad = structuredClone(VALID_GRAPH);
    bad.features[0]!.description = 'unknown';
    const result = validateKnowledgeGraph(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('placeholder'))).toBe(true);
  });

  it('rejects modules with generic or unclear responsibility text', () => {
    const bad = structuredClone(VALID_GRAPH);
    bad.modules[0]!.responsibility = 'Application logic grouped under auth.';
    bad.modules[1]!.responsibility = 'Various utilities.';

    const result = validateKnowledgeGraph(bad);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('responsibility is too generic'))).toBe(true);
  });

  it('rejects German default tokens in feature/module/third-party descriptions', () => {
    const bad = structuredClone(VALID_GRAPH);
    bad.features[0]!.description = 'Noch nicht implementiert.';
    bad.modules[0]!.responsibility = 'Keine klare Verantwortung.';
    bad.third_parties[0]!.description = 'Schnittstelle nicht verfügbar.';

    const result = validateKnowledgeGraph(bad);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('features[0].description') && e.includes('English-only'))).toBe(true);
    expect(result.errors.some(e => e.includes('modules[0].responsibility') && e.includes('English-only'))).toBe(true);
    expect(result.errors.some(e => e.includes('third_parties[0].description') && e.includes('English-only'))).toBe(true);
  });

  it('rejects missing required wiki page_target', () => {
    const bad = structuredClone(VALID_GRAPH);
    delete bad.features[0]!.wiki?.page_target;
    const result = validateKnowledgeGraph(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('page_target'))).toBe(true);
  });

  it('rejects invalid wiki last_verified timestamp', () => {
    const bad = structuredClone(VALID_GRAPH);
    bad.features[0]!.wiki!.last_verified = 'yesterday';
    const result = validateKnowledgeGraph(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('last_verified'))).toBe(true);
  });

  it('rejects absolute or traversing wiki page targets', () => {
    const absolutePathGraph = structuredClone(VALID_GRAPH);
    absolutePathGraph.features[0]!.wiki.page_target = '/tmp/FEAT-001_Auth.md';

    const traversalPathGraph = structuredClone(VALID_GRAPH);
    traversalPathGraph.modules[0]!.wiki.page_target = '../Code_Map/MODULE-Auth.md';

    const absoluteResult = validateKnowledgeGraph(absolutePathGraph);
    const traversalResult = validateKnowledgeGraph(traversalPathGraph);

    expect(absoluteResult.valid).toBe(false);
    expect(absoluteResult.errors.some(e => e.includes('relative markdown path'))).toBe(true);
    expect(traversalResult.valid).toBe(false);
    expect(traversalResult.errors.some(e => e.includes('relative markdown path'))).toBe(true);
  });

  it('rejects duplicate relations', () => {
    const bad = structuredClone(VALID_GRAPH);
    bad.relations.push({ from: 'FEAT-001', to: 'MODULE-Auth', type: 'implemented_by' });
    const result = validateKnowledgeGraph(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('duplicate relation'))).toBe(true);
  });

  it('rejects graphs that do not reference all core page targets', () => {
    const bad = structuredClone(VALID_GRAPH);
    bad.third_parties[0]!.wiki.page_target = 'Third_Party/THIRD-Indexer.md';

    const result = validateKnowledgeGraph(bad);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('missing core page_target reference in graph: Index.md'))).toBe(true);
  });

  it('rejects broken cross references across modules, technologies, and threats', () => {
    const bad = structuredClone(VALID_GRAPH);
    bad.modules[0]!.used_by_features = ['FEAT-404'];
    bad.modules[0]!.dependencies = ['THIRD-Missing'];
    bad.technologies = [{ name: 'Node.js', version: '20', usage: 'Runtime', modules: ['MODULE-Missing'] }];
    bad.security.threats = [{
      id: 'THREAT-001',
      description: 'Broken reference test.',
      affected_modules: ['MODULE-Missing'],
      severity: 'high',
      mitigation: 'Fix the references.',
      evidence: 'src/security/threat.ts',
      source_refs: [{ path: 'src/security/threat.ts' }],
      last_verified: '2026-04-10T10:00:00Z',
    }];

    const result = validateKnowledgeGraph(bad);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('used_by_features references unknown feature id'))).toBe(true);
    expect(result.errors.some(e => e.includes('dependencies references unknown id'))).toBe(true);
    expect(result.errors.some(e => e.includes('technologies[0].modules references unknown module id'))).toBe(true);
    expect(result.errors.some(e => e.includes('affected_modules references unknown module id'))).toBe(true);
  });

  it('rejects empty feature.third_parties when feature text mentions Supabase', () => {
    const bad = structuredClone(VALID_GRAPH);
    bad.features[0]!.description = 'Uses Supabase for auth and data access.';
    bad.features[0]!.third_parties = [];

    const result = validateKnowledgeGraph(bad);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('mentions known third parties'))).toBe(true);
  });

  it('rejects bidirectional mismatch between third_party.used_in and feature.third_parties', () => {
    const bad = structuredClone(VALID_GRAPH);
    bad.features[0]!.third_parties = [];

    const result = validateKnowledgeGraph(bad);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('does not include THIRD-Indexer'))).toBe(true);
  });

  it('rejects security threats that reference non-existing modules', () => {
    const bad = structuredClone(VALID_GRAPH);
    bad.security.threats = [{
      id: 'THREAT-001',
      description: 'Missing target module',
      affected_modules: ['MODULE-DoesNotExist'],
      severity: 'high',
      mitigation: 'Fix ids',
      evidence: 'src/security/threat.ts',
      source_refs: [{ path: 'src/security/threat.ts' }],
      last_verified: '2026-04-10T10:00:00Z',
    }];

    const result = validateKnowledgeGraph(bad);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('affected_modules references unknown module id'))).toBe(true);
  });

  it('rejects security threats without evidence', () => {
    const bad = structuredClone(VALID_GRAPH);
    bad.security.threats = [{
      id: 'THREAT-001',
      description: 'Threat without evidence.',
      affected_modules: ['MODULE-Auth'],
      severity: 'high',
      mitigation: 'Add protection.',
      evidence: '',
      source_refs: [{ path: 'src/auth/index.ts' }],
      last_verified: '2026-04-10T10:00:00Z',
    }];

    const result = validateKnowledgeGraph(bad);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('security.threats[0].evidence'))).toBe(true);
  });

  it('flags stale last_verified as warning but keeps graph valid', () => {
    const stale = structuredClone(VALID_GRAPH);
    stale.features[0]!.wiki.last_verified = '2020-01-01T00:00:00Z';

    const result = validateKnowledgeGraph(stale);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.some(w => w.includes('features[0].wiki.last_verified is older than 30 days'))).toBe(true);
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
    expect(isValidEntityId('feat-001')).toBe(false);
    expect(isValidEntityId('FEAT001')).toBe(false);
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

  it('rejects invalid raw file and import/export fields', () => {
    const raw: RawKnowledge = {
      scanned_at: '2026-04-07T00:00:00Z',
      root_path: '/project',
      files: [
        { path: '', type: 'invalid' as any, language: '', size_bytes: -1 },
      ],
      imports: [{ from_file: '', import_path: '', is_external: 'yes' as any }],
      exports: [{ from_file: '', name: '', kind: 'invalid' as any }],
      entry_points: [''],
    };
    const result = validateRawKnowledge(raw);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
