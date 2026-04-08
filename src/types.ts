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
  modules: string[]; // References MODULE-* ids
  third_parties: string[]; // References THIRD-* ids
  security_impact: Criticality;
  how_it_works?: string;
}

export interface KnowledgeModule {
  id: string;
  path: string;
  language: string;
  responsibility: string;
  exports: string[];
  dependencies: string[]; // MODULE-* or THIRD-* ids
  used_by_features: string[]; // FEAT-* ids
}

export interface KnowledgeThirdParty {
  id: string;
  name: string;
  type: string; // e.g. 'payment', 'auth', 'storage'
  data_access: string[]; // e.g. ['billing', 'pii']
  criticality: Criticality;
  used_in: string[]; // FEAT-* ids
  description?: string;
  usage_in_project?: string;
}

export interface KnowledgeTechnology {
  name: string;
  version: string;
  usage: string;
  modules: string[]; // MODULE-* ids
}

export interface KnowledgeSecurityThreat {
  id: string;
  description: string;
  affected_modules: string[];
  severity: Criticality;
  mitigation: string;
  evidence?: string;
}

export interface KnowledgeSecurity {
  threats: KnowledgeSecurityThreat[];
  pii_flows: string[];
  auth_model: string;
  auth_flow?: string;
  authorization_model?: string;
}

export interface KnowledgeRelation {
  from: string;
  to: string;
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
  enriched_at: string; // ISO-8601 timestamp
  version: string; // Schema version, e.g. '1.0'
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
