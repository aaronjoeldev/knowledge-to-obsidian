import { describe, it, expect } from 'vitest';
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
});
