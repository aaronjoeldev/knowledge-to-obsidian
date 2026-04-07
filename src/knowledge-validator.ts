import type { KnowledgeGraph, RawKnowledge } from './types.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const ENTITY_ID_PATTERN = /^[A-Z][A-Z0-9]*-[A-Za-z0-9]+$/;

export function isValidEntityId(id: string): boolean {
  return ENTITY_ID_PATTERN.test(id);
}

export function validateKnowledgeGraph(graph: KnowledgeGraph): ValidationResult {
  const errors: string[] = [];

  if (!graph.project.id) {
    errors.push('project.id is required');
  }
  if (!graph.project.name) {
    errors.push('project.name is required');
  }

  const knownIds = new Set<string>();
  knownIds.add(graph.project.id);

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

  for (const tp of graph.third_parties) {
    knownIds.add(tp.id);
  }

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
