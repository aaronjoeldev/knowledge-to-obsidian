// ─── Literal union types ──────────────────────────────────────────────────────

export type Criticality = 'low' | 'medium' | 'high';
export type FeatureStatus = 'planned' | 'implemented';
export type KnowledgeStalenessStatus = 'fresh' | 'stale' | 'unknown';
export type RelationType =
  | 'implemented_by'
  | 'depends_on'
  | 'uses'
  | 'exposes'
  | 'owned_by';
export type IndexReferenceType = 'calls' | 'imports';
export type SynthesisPageKind =
  | 'comparison'
  | 'architecture_summary'
  | 'security_review'
  | 'open_questions'
  | 'decision_note';

export const CRITICALITY_VALUES = ['low', 'medium', 'high'] as const;
export const FEATURE_STATUS_VALUES = ['planned', 'implemented'] as const;
export const KNOWLEDGE_STALENESS_STATUS_VALUES = ['fresh', 'stale', 'unknown'] as const;
export const RELATION_TYPE_VALUES = [
  'implemented_by',
  'depends_on',
  'uses',
  'exposes',
  'owned_by',
] as const;
export const INDEX_REFERENCE_TYPE_VALUES = ['calls', 'imports'] as const;
export const SYNTHESIS_PAGE_KIND_VALUES = [
  'comparison',
  'architecture_summary',
  'security_review',
  'open_questions',
  'decision_note',
] as const;

export interface KnowledgeSourceRef {
  path: string;
  symbol?: string;
}

export interface KnowledgeWikiMeta {
  source_refs: KnowledgeSourceRef[];
  last_verified: string; // ISO-8601 timestamp
  page_target: string; // Relative Obsidian target (e.g. "Features/FEAT-001_Auth.md")
}

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
  wiki: KnowledgeWikiMeta;
}

export interface KnowledgeModule {
  id: string;
  path: string;
  language: string;
  responsibility: string;
  exports: string[];
  dependencies: string[]; // MODULE-* or THIRD-* ids
  used_by_features: string[]; // FEAT-* ids
  wiki: KnowledgeWikiMeta;
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
  wiki: KnowledgeWikiMeta;
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
  evidence: string;
  source_refs: KnowledgeSourceRef[];
  last_verified: string; // ISO-8601 timestamp
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

export interface KnowledgeIndexSymbol {
  id: string;
  name: string;
  kind: string;
  path: string;
  module_id?: string;
  feature_ids?: string[];
}

export interface KnowledgeIndexReference {
  from_symbol_id: string;
  to_symbol_id: string;
  type: IndexReferenceType;
}

export interface KnowledgeIndexProcess {
  id: string;
  name: string;
  entry_points: string[];
  symbol_ids?: string[];
  feature_ids?: string[];
}

export interface KnowledgeIndexCluster {
  id: string;
  name: string;
  module_ids?: string[];
  feature_ids?: string[];
}

export interface KnowledgeIndexV2 {
  version: '2';
  generated_at: string; // ISO-8601 timestamp
  symbols?: KnowledgeIndexSymbol[];
  references?: KnowledgeIndexReference[];
  processes?: KnowledgeIndexProcess[];
  clusters?: KnowledgeIndexCluster[];
}

export interface KnowledgeSourceSnapshot {
  enriched_at: string; // ISO-8601 timestamp
  version: string; // Schema version
  index_generated_at?: string; // ISO-8601 timestamp from index_v2.generated_at
}

export interface KnowledgeSynthesisPage {
  id: string; // SYN-<stable>
  kind: SynthesisPageKind;
  title: string;
  question: string; // original trimmed query
  query_hash: string; // hash(normalized question)
  identity_key: string; // hash(kind + query_hash + page_target)
  content_hash: string; // hash(content_markdown)
  content_markdown: string; // canonical AUTO-GENERATED body
  source_entity_ids: string[]; // sorted, unique
  source_page_targets: string[]; // sorted, unique
  source_snapshot: KnowledgeSourceSnapshot;
  wiki: KnowledgeWikiMeta; // page_target must be under Synthesis/
}

export interface KnowledgeStalenessInfo {
  status: KnowledgeStalenessStatus;
  checked_at?: string; // ISO-8601 timestamp
  reason?: string;
}

export interface EnrichedKnowledgeMeta {
  knowledge_scanned_at?: string; // ISO-8601 timestamp
  last_sync_at?: string; // ISO-8601 timestamp
  staleness?: {
    enriched_from_knowledge?: KnowledgeStalenessInfo;
    wiki_from_enriched?: KnowledgeStalenessInfo;
  };
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
  index_v2?: KnowledgeIndexV2;
  meta?: EnrichedKnowledgeMeta;
  synthesis_pages?: KnowledgeSynthesisPage[];
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
