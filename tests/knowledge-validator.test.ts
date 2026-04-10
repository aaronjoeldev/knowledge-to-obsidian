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
      wiki: {
        source_refs: [{ path: 'src/auth/index.ts' }],
        last_verified: '2026-04-10T10:00:00Z',
      },
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
      wiki: {
        page_target: 'Code_Map/MODULE-Auth.md',
      },
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
});
