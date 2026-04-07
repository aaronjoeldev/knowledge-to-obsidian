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
