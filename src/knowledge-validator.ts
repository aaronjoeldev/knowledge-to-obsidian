import {
  CRITICALITY_VALUES,
  FEATURE_STATUS_VALUES,
  INDEX_REFERENCE_TYPE_VALUES,
  KNOWLEDGE_STALENESS_STATUS_VALUES,
  RELATION_TYPE_VALUES,
  SYNTHESIS_PAGE_KIND_VALUES,
  type EnrichedKnowledgeGraph,
  type KnowledgeGraph,
  type RawKnowledge,
  type KnowledgeSynthesisPage,
} from './types.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const ENTITY_ID_PATTERN = /^[A-Z][A-Z0-9]*-[A-Za-z0-9]+$/;
const PLACEHOLDER_VALUE_PATTERN = /^(unknown|n\/a|tbd|todo|—|-|_no description available\._|_not analyzed yet(?:\s+.*)?_?)$/i;
const GERMAN_DEFAULT_TOKEN_PATTERN = /(\bkeine\b|\bnoch nicht\b|nicht verfügbar)/i;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const CORE_PAGE_TARGETS = ['Overview.md', 'Architecture.md', 'Index.md', 'Run_Log.md'] as const;
const FEATURE_THIRD_PARTY_HINTS = ['supabase'];
const GENERIC_MODULE_RESPONSIBILITY_PATTERN = /(application logic|business logic|various utilities|misc(?:ellaneous)?|general logic|grouped under|shared functionality|common utilities)/i;
const HIGH_SIGNAL_API_PATTERN = /(\/api\/|\bapi route\b|\broute handler\b|\bendpoint\b|\bcontroller\b)/i;
const HIGH_SIGNAL_SERVICE_PATTERN = /(\bservice\b|\borchestrator\b|\buse case\b)/i;
const HIGH_SIGNAL_INTEGRATION_PATTERN = /(\bintegration\b|\badapter\b|\bgateway\b|\bclient\b|\bprovider\b|\bwebhook\b|\bexternal\b|\bsdk\b)/i;
const HIGH_SIGNAL_SECURITY_PATTERN = /(\bauth\b|\bauthoriz|\bsecurity\b|\bsession\b|\btoken\b|\bencrypt|\bpermission\b|\baccess control\b)/i;
const SHARED_MODULE_PATH_PATTERN = /(\/shared\/|\/common\/|\/lib\/|\/utils?\/)/i;
const GENERIC_MODULE_FOLDER_PATTERN = /^(?:src\/)?(?:modules?|utils?|shared|common|lib)\/?$/i;
const MAX_LAST_VERIFIED_AGE_DAYS = 30;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isPlaceholderValue(value: string): boolean {
  return PLACEHOLDER_VALUE_PATTERN.test(value.trim());
}

function hasGermanDefaultToken(value: string): boolean {
  return GERMAN_DEFAULT_TOKEN_PATTERN.test(value.trim());
}

function validateRequiredText(
  errors: string[],
  fieldPath: string,
  value: unknown,
  options: { rejectPlaceholders?: boolean } = {},
): void {
  if (!isNonEmptyString(value)) {
    errors.push(`${fieldPath} must be a non-empty string`);
    return;
  }
  if (options.rejectPlaceholders && isPlaceholderValue(value)) {
    errors.push(`${fieldPath} must not use placeholder values like "unknown" or "—"`);
  }
}

function isValidIsoTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function isValidWikiPageTarget(value: string): boolean {
  if (!isNonEmptyString(value)) return false;
  const trimmed = value.trim();
  if (trimmed.startsWith('/') || trimmed.startsWith('\\') || WINDOWS_ABSOLUTE_PATH_PATTERN.test(trimmed)) {
    return false;
  }
  if (trimmed.split(/[\\/]/).includes('..')) {
    return false;
  }
  return trimmed.endsWith('.md');
}

function isValidRelativeRepoPath(value: string): boolean {
  if (!isNonEmptyString(value)) return false;
  const trimmed = value.trim();
  if (trimmed.startsWith('/') || trimmed.startsWith('\\') || WINDOWS_ABSOLUTE_PATH_PATTERN.test(trimmed)) {
    return false;
  }
  if (trimmed.split(/[\\/]/).includes('..')) {
    return false;
  }
  return true;
}

function ensureArray(errors: string[], fieldPath: string, value: unknown): value is unknown[] {
  if (!Array.isArray(value)) {
    errors.push(`${fieldPath} must be an array`);
    return false;
  }
  return true;
}

function validateWikiMeta(
  errors: string[],
  warnings: string[],
  fieldPath: string,
  wiki: unknown,
  options: { requireSourceRefs?: boolean; requireLastVerified?: boolean } = {},
): void {
  if (wiki === undefined || wiki === null) {
    errors.push(`${fieldPath}.page_target is required`);
    return;
  }

  const wikiObj = wiki as {
    page_target?: unknown;
    source_refs?: unknown;
    last_verified?: unknown;
  };

  validateRequiredText(errors, `${fieldPath}.page_target`, wikiObj.page_target, { rejectPlaceholders: true });
  if (isNonEmptyString(wikiObj.page_target) && !isValidWikiPageTarget(wikiObj.page_target)) {
    errors.push(`${fieldPath}.page_target must be a relative markdown path without traversal`);
  }

  if (wikiObj.source_refs === undefined && options.requireSourceRefs) {
    errors.push(`${fieldPath}.source_refs is required`);
  }

  if (wikiObj.source_refs !== undefined && ensureArray(errors, `${fieldPath}.source_refs`, wikiObj.source_refs)) {
    if (wikiObj.source_refs.length === 0 && options.requireSourceRefs) {
      errors.push(`${fieldPath}.source_refs must contain at least one source reference`);
    }
    wikiObj.source_refs.forEach((sourceRef, sourceRefIndex) => {
      const refObj = sourceRef as { path?: unknown };
      validateRequiredText(
        errors,
        `${fieldPath}.source_refs[${sourceRefIndex}].path`,
        refObj.path,
        { rejectPlaceholders: true },
      );
    });
  }

  if (wikiObj.last_verified === undefined && options.requireLastVerified) {
    errors.push(`${fieldPath}.last_verified is required`);
  }

  if (wikiObj.last_verified !== undefined) {
    validateRequiredText(errors, `${fieldPath}.last_verified`, wikiObj.last_verified);
    if (isNonEmptyString(wikiObj.last_verified) && !isValidIsoTimestamp(wikiObj.last_verified)) {
      errors.push(`${fieldPath}.last_verified must be a valid ISO-8601 timestamp`);
    }
    if (isNonEmptyString(wikiObj.last_verified) && isValidIsoTimestamp(wikiObj.last_verified)) {
      const ageMs = Date.now() - Date.parse(wikiObj.last_verified);
      const maxAgeMs = MAX_LAST_VERIFIED_AGE_DAYS * 24 * 60 * 60 * 1000;
      if (ageMs > maxAgeMs) {
        warnings.push(`${fieldPath}.last_verified is older than ${MAX_LAST_VERIFIED_AGE_DAYS} days`);
      }
    }
  }
}

function isHighSignalModule(mod: KnowledgeGraph['modules'][number]): boolean {
  const searchableText = `${mod.path ?? ''} ${mod.responsibility ?? ''}`.toLowerCase();
  const usedByFeaturesCount = Array.isArray(mod.used_by_features) ? mod.used_by_features.length : 0;

  return (
    HIGH_SIGNAL_API_PATTERN.test(searchableText)
    || HIGH_SIGNAL_SERVICE_PATTERN.test(searchableText)
    || HIGH_SIGNAL_INTEGRATION_PATTERN.test(searchableText)
    || HIGH_SIGNAL_SECURITY_PATTERN.test(searchableText)
    || (SHARED_MODULE_PATH_PATTERN.test(searchableText) && usedByFeaturesCount >= 2)
  );
}

export function isValidEntityId(id: string): boolean {
  return ENTITY_ID_PATTERN.test(id);
}

export function validateKnowledgeGraph(graph: KnowledgeGraph): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const referencedPageTargets = new Set<string>();

  ensureArray(errors, 'features', graph.features);
  ensureArray(errors, 'modules', graph.modules);
  ensureArray(errors, 'third_parties', graph.third_parties);
  ensureArray(errors, 'technologies', graph.technologies);
  ensureArray(errors, 'relations', graph.relations);
  if (typeof graph.security !== 'object' || graph.security === null) {
    errors.push('security must be an object');
  }

  const features = Array.isArray(graph.features) ? graph.features : [];
  const modules = Array.isArray(graph.modules) ? graph.modules : [];
  const thirdParties = Array.isArray(graph.third_parties) ? graph.third_parties : [];
  const technologies = Array.isArray(graph.technologies) ? graph.technologies : [];
  const relations = Array.isArray(graph.relations) ? graph.relations : [];
  const security = (typeof graph.security === 'object' && graph.security !== null
    ? graph.security
    : { threats: [], pii_flows: [], auth_model: '' }) as KnowledgeGraph['security'];

  const project = (typeof graph.project === 'object' && graph.project !== null
    ? graph.project
    : { id: '', name: '', description: '', domain: '', criticality: '' }) as KnowledgeGraph['project'];
  if (typeof graph.project !== 'object' || graph.project === null) {
    errors.push('project must be an object');
  }

  validateRequiredText(errors, 'project.id', project.id);
  validateRequiredText(errors, 'project.name', project.name, { rejectPlaceholders: true });
  validateRequiredText(errors, 'project.description', project.description, { rejectPlaceholders: true });
  validateRequiredText(errors, 'project.domain', project.domain, { rejectPlaceholders: true });
  if (!CRITICALITY_VALUES.includes(project.criticality)) {
    errors.push(`project.criticality must be one of: ${CRITICALITY_VALUES.join(', ')}`);
  }
  if (isNonEmptyString(project.id) && !isValidEntityId(project.id)) {
    errors.push(`project.id has invalid format: ${project.id}`);
  }

  const knownIds = new Set<string>();
  const globalIds = new Set<string>();
  if (isNonEmptyString(project.id)) {
    knownIds.add(project.id);
    globalIds.add(project.id);
  }

  const featureIds = new Set<string>();
  for (const [featureIndex, feat] of features.entries()) {
    const featurePath = `features[${featureIndex}]`;
    validateRequiredText(errors, `${featurePath}.id`, feat.id);
    if (isNonEmptyString(feat.id) && !isValidEntityId(feat.id)) {
      errors.push(`${featurePath}.id has invalid format: ${feat.id}`);
    }
    if (featureIds.has(feat.id)) {
      errors.push(`duplicate feature id: ${feat.id}`);
    }
    if (globalIds.has(feat.id)) {
      errors.push(`duplicate entity id across graph: ${feat.id}`);
    }
    featureIds.add(feat.id);
    globalIds.add(feat.id);
    knownIds.add(feat.id);

    validateRequiredText(errors, `${featurePath}.name`, feat.name, { rejectPlaceholders: true });
    validateRequiredText(errors, `${featurePath}.description`, feat.description, { rejectPlaceholders: true });
    if (isNonEmptyString(feat.description) && hasGermanDefaultToken(feat.description)) {
      errors.push(`${featurePath}.description must be English-only and must not use German default tokens`);
    }
    if (!FEATURE_STATUS_VALUES.includes(feat.status)) {
      errors.push(`${featurePath}.status must be one of: ${FEATURE_STATUS_VALUES.join(', ')}`);
    }
    if (!CRITICALITY_VALUES.includes(feat.security_impact)) {
      errors.push(`${featurePath}.security_impact must be one of: ${CRITICALITY_VALUES.join(', ')}`);
    }

    if (ensureArray(errors, `${featurePath}.entry_points`, feat.entry_points)) {
      feat.entry_points.forEach((entryPoint, entryPointIndex) => {
        validateRequiredText(errors, `${featurePath}.entry_points[${entryPointIndex}]`, entryPoint, {
          rejectPlaceholders: true,
        });
      });
    }
    ensureArray(errors, `${featurePath}.modules`, feat.modules);
    ensureArray(errors, `${featurePath}.third_parties`, feat.third_parties);
    validateWikiMeta(errors, warnings, `${featurePath}.wiki`, feat.wiki, {
      requireSourceRefs: true,
      requireLastVerified: true,
    });
    if (isNonEmptyString(feat.wiki?.page_target)) {
      referencedPageTargets.add(feat.wiki.page_target.trim());
    }
  }

  const moduleIds = new Set<string>();
  for (const [moduleIndex, mod] of modules.entries()) {
    const modulePath = `modules[${moduleIndex}]`;
    validateRequiredText(errors, `${modulePath}.id`, mod.id);
    if (isNonEmptyString(mod.id) && !isValidEntityId(mod.id)) {
      errors.push(`${modulePath}.id has invalid format: ${mod.id}`);
    }
    if (moduleIds.has(mod.id)) {
      errors.push(`duplicate module id: ${mod.id}`);
    }
    if (globalIds.has(mod.id)) {
      errors.push(`duplicate entity id across graph: ${mod.id}`);
    }
    moduleIds.add(mod.id);
    globalIds.add(mod.id);
    knownIds.add(mod.id);

    validateRequiredText(errors, `${modulePath}.path`, mod.path, { rejectPlaceholders: true });
    validateRequiredText(errors, `${modulePath}.language`, mod.language, { rejectPlaceholders: true });
    validateRequiredText(errors, `${modulePath}.responsibility`, mod.responsibility, { rejectPlaceholders: true });
    if (isNonEmptyString(mod.responsibility) && hasGermanDefaultToken(mod.responsibility)) {
      errors.push(`${modulePath}.responsibility must be English-only and must not use German default tokens`);
    }
    if (isNonEmptyString(mod.responsibility) && GENERIC_MODULE_RESPONSIBILITY_PATTERN.test(mod.responsibility)) {
      errors.push(`${modulePath}.responsibility is too generic; describe a concrete, high-signal responsibility`);
    }
    if (isNonEmptyString(mod.path) && GENERIC_MODULE_FOLDER_PATTERN.test(mod.path.trim())) {
      errors.push(`${modulePath}.path points to a generic catch-all folder; use a concrete module path`);
    }
    if (!isHighSignalModule(mod)) {
      errors.push(`${modulePath} must be high-signal (API route, service, integration, security module, or widely used shared module)`);
    }
    ensureArray(errors, `${modulePath}.exports`, mod.exports);
    ensureArray(errors, `${modulePath}.dependencies`, mod.dependencies);
    ensureArray(errors, `${modulePath}.used_by_features`, mod.used_by_features);
    validateWikiMeta(errors, warnings, `${modulePath}.wiki`, mod.wiki);
    if (isNonEmptyString(mod.wiki?.page_target)) {
      referencedPageTargets.add(mod.wiki.page_target.trim());
    }

    if (Array.isArray(mod.exports)) {
      mod.exports.forEach((exportName, exportIndex) => {
        validateRequiredText(errors, `${modulePath}.exports[${exportIndex}]`, exportName, {
          rejectPlaceholders: true,
        });
      });
    }
  }

  const thirdPartyIds = new Set<string>();
  for (const [thirdPartyIndex, tp] of thirdParties.entries()) {
    const thirdPartyPath = `third_parties[${thirdPartyIndex}]`;
    validateRequiredText(errors, `${thirdPartyPath}.id`, tp.id);
    if (isNonEmptyString(tp.id) && !isValidEntityId(tp.id)) {
      errors.push(`${thirdPartyPath}.id has invalid format: ${tp.id}`);
    }
    if (thirdPartyIds.has(tp.id)) {
      errors.push(`duplicate third party id: ${tp.id}`);
    }
    if (globalIds.has(tp.id)) {
      errors.push(`duplicate entity id across graph: ${tp.id}`);
    }
    thirdPartyIds.add(tp.id);
    globalIds.add(tp.id);
    knownIds.add(tp.id);

    validateRequiredText(errors, `${thirdPartyPath}.name`, tp.name, { rejectPlaceholders: true });
    validateRequiredText(errors, `${thirdPartyPath}.type`, tp.type, { rejectPlaceholders: true });
    if (!CRITICALITY_VALUES.includes(tp.criticality)) {
      errors.push(`${thirdPartyPath}.criticality must be one of: ${CRITICALITY_VALUES.join(', ')}`);
    }
    if (tp.description !== undefined) {
      validateRequiredText(errors, `${thirdPartyPath}.description`, tp.description, { rejectPlaceholders: true });
      if (isNonEmptyString(tp.description) && hasGermanDefaultToken(tp.description)) {
        errors.push(`${thirdPartyPath}.description must be English-only and must not use German default tokens`);
      }
    }
    if (tp.usage_in_project !== undefined) {
      validateRequiredText(errors, `${thirdPartyPath}.usage_in_project`, tp.usage_in_project, { rejectPlaceholders: true });
    }
    if (ensureArray(errors, `${thirdPartyPath}.data_access`, tp.data_access)) {
      tp.data_access.forEach((dataAccess, dataAccessIndex) => {
        validateRequiredText(errors, `${thirdPartyPath}.data_access[${dataAccessIndex}]`, dataAccess, {
          rejectPlaceholders: true,
        });
      });
    }
    ensureArray(errors, `${thirdPartyPath}.used_in`, tp.used_in);
    validateWikiMeta(errors, warnings, `${thirdPartyPath}.wiki`, tp.wiki, {
      requireSourceRefs: true,
      requireLastVerified: true,
    });
    if (isNonEmptyString(tp.wiki?.page_target)) {
      referencedPageTargets.add(tp.wiki.page_target.trim());
    }
  }

  for (const corePageTarget of CORE_PAGE_TARGETS) {
    if (!referencedPageTargets.has(corePageTarget)) {
      errors.push(`missing core page_target reference in graph: ${corePageTarget}`);
    }
  }

  for (const [featureIndex, feat] of features.entries()) {
    const featurePath = `features[${featureIndex}]`;
    if (Array.isArray(feat.modules)) {
      for (const moduleId of feat.modules) {
        if (!moduleIds.has(moduleId)) {
          errors.push(`${featurePath}.modules references unknown module id: ${moduleId}`);
        }
      }
    }
    if (Array.isArray(feat.third_parties)) {
      for (const thirdPartyId of feat.third_parties) {
        if (!thirdPartyIds.has(thirdPartyId)) {
          errors.push(`${featurePath}.third_parties references unknown third party id: ${thirdPartyId}`);
        }
      }

      const featureText = `${feat.name ?? ''} ${feat.description ?? ''} ${feat.how_it_works ?? ''}`.toLowerCase();
      const hasThirdPartyHint = FEATURE_THIRD_PARTY_HINTS.some(hint => featureText.includes(hint));
      if (hasThirdPartyHint && feat.third_parties.length === 0) {
        errors.push(`${featurePath}.third_parties should not be empty when feature text mentions known third parties (e.g. Supabase)`);
      }
    }
  }

  for (const [moduleIndex, mod] of modules.entries()) {
    const modulePath = `modules[${moduleIndex}]`;
    if (Array.isArray(mod.used_by_features)) {
      for (const featureId of mod.used_by_features) {
        if (!featureIds.has(featureId)) {
          errors.push(`${modulePath}.used_by_features references unknown feature id: ${featureId}`);
        }
      }
    }
    if (Array.isArray(mod.dependencies)) {
      for (const dependencyId of mod.dependencies) {
        if (!moduleIds.has(dependencyId) && !thirdPartyIds.has(dependencyId)) {
          errors.push(`${modulePath}.dependencies references unknown id: ${dependencyId}`);
        }
      }
    }
  }

  for (const [thirdPartyIndex, tp] of thirdParties.entries()) {
    const thirdPartyPath = `third_parties[${thirdPartyIndex}]`;
    if (Array.isArray(tp.used_in)) {
      for (const featureId of tp.used_in) {
        if (!featureIds.has(featureId)) {
          errors.push(`${thirdPartyPath}.used_in references unknown feature id: ${featureId}`);
          continue;
        }

        const feature = features.find(feat => feat.id === featureId);
        if (feature && Array.isArray(feature.third_parties) && !feature.third_parties.includes(tp.id)) {
          errors.push(`${thirdPartyPath}.used_in references feature ${featureId}, but ${featureId}.third_parties does not include ${tp.id}`);
        }
      }
    }
  }

  for (const [techIndex, tech] of technologies.entries()) {
    const techPath = `technologies[${techIndex}]`;
    validateRequiredText(errors, `${techPath}.name`, tech.name, { rejectPlaceholders: true });
    validateRequiredText(errors, `${techPath}.version`, tech.version, { rejectPlaceholders: true });
    validateRequiredText(errors, `${techPath}.usage`, tech.usage, { rejectPlaceholders: true });
    if (ensureArray(errors, `${techPath}.modules`, tech.modules)) {
      tech.modules.forEach((moduleId) => {
        if (!moduleIds.has(moduleId)) {
          errors.push(`${techPath}.modules references unknown module id: ${moduleId}`);
        }
      });
    }
  }

  validateRequiredText(errors, 'security.auth_model', security.auth_model, { rejectPlaceholders: true });
  ensureArray(errors, 'security.pii_flows', security.pii_flows);
  ensureArray(errors, 'security.threats', security.threats);

  if (Array.isArray(security.pii_flows)) {
    security.pii_flows.forEach((piiFlow, piiFlowIndex) => {
      validateRequiredText(errors, `security.pii_flows[${piiFlowIndex}]`, piiFlow, {
        rejectPlaceholders: true,
      });
    });
  }

  const threatIds = new Set<string>();
  for (const [threatIndex, threat] of (Array.isArray(security.threats) ? security.threats : []).entries()) {
    const threatPath = `security.threats[${threatIndex}]`;
    validateRequiredText(errors, `${threatPath}.id`, threat.id);
    if (isNonEmptyString(threat.id) && !isValidEntityId(threat.id)) {
      errors.push(`${threatPath}.id has invalid format: ${threat.id}`);
    }
    if (threatIds.has(threat.id)) {
      errors.push(`duplicate security threat id: ${threat.id}`);
    }
    threatIds.add(threat.id);

    validateRequiredText(errors, `${threatPath}.description`, threat.description, { rejectPlaceholders: true });
    validateRequiredText(errors, `${threatPath}.mitigation`, threat.mitigation, { rejectPlaceholders: true });
    if (!CRITICALITY_VALUES.includes(threat.severity)) {
      errors.push(`${threatPath}.severity must be one of: ${CRITICALITY_VALUES.join(', ')}`);
    }
    if (ensureArray(errors, `${threatPath}.affected_modules`, threat.affected_modules)) {
      threat.affected_modules.forEach((moduleId) => {
        if (!moduleIds.has(moduleId)) {
          errors.push(`${threatPath}.affected_modules references unknown module id: ${moduleId}`);
        }
      });
    }
    validateRequiredText(errors, `${threatPath}.evidence`, threat.evidence, { rejectPlaceholders: true });
    if (ensureArray(errors, `${threatPath}.source_refs`, threat.source_refs)) {
      if (threat.source_refs.length === 0) {
        errors.push(`${threatPath}.source_refs must contain at least one source reference`);
      }
      threat.source_refs.forEach((sourceRef, sourceRefIndex) => {
        const refObj = sourceRef as { path?: unknown };
        validateRequiredText(
          errors,
          `${threatPath}.source_refs[${sourceRefIndex}].path`,
          refObj.path,
          { rejectPlaceholders: true },
        );
      });
    }
    validateRequiredText(errors, `${threatPath}.last_verified`, threat.last_verified);
    if (isNonEmptyString(threat.last_verified) && !isValidIsoTimestamp(threat.last_verified)) {
      errors.push(`${threatPath}.last_verified must be a valid ISO-8601 timestamp`);
    }
    if (isNonEmptyString(threat.last_verified) && isValidIsoTimestamp(threat.last_verified)) {
      const ageMs = Date.now() - Date.parse(threat.last_verified);
      const maxAgeMs = MAX_LAST_VERIFIED_AGE_DAYS * 24 * 60 * 60 * 1000;
      if (ageMs > maxAgeMs) {
        warnings.push(`${threatPath}.last_verified is older than ${MAX_LAST_VERIFIED_AGE_DAYS} days`);
      }
    }
  }

  const relationKeys = new Set<string>();
  for (const [relationIndex, rel] of relations.entries()) {
    const relationPath = `relations[${relationIndex}]`;
    if (!knownIds.has(rel.from)) {
      errors.push(`${relationPath}.from references unknown entity id: ${rel.from}`);
    }
    if (!knownIds.has(rel.to)) {
      errors.push(`${relationPath}.to references unknown entity id: ${rel.to}`);
    }
    if (!RELATION_TYPE_VALUES.includes(rel.type)) {
      errors.push(`${relationPath}.type must be one of: ${RELATION_TYPE_VALUES.join(', ')}`);
    }

    const relationKey = `${rel.from}|${rel.type}|${rel.to}`;
    if (relationKeys.has(relationKey)) {
      errors.push(`duplicate relation detected: ${rel.from} --${rel.type}--> ${rel.to}`);
    }
    relationKeys.add(relationKey);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateEnrichedKnowledgeGraph(graph: EnrichedKnowledgeGraph): ValidationResult {
  const baseValidation = validateKnowledgeGraph(graph);
  const errors = [...baseValidation.errors];
  const warnings = [...baseValidation.warnings];

  validateRequiredText(errors, 'enriched_at', graph.enriched_at);
  if (isNonEmptyString(graph.enriched_at) && !isValidIsoTimestamp(graph.enriched_at)) {
    errors.push('enriched_at must be a valid ISO-8601 timestamp');
  }

  validateRequiredText(errors, 'version', graph.version, { rejectPlaceholders: true });

  validateEnrichedMeta(errors, warnings, graph);
  validateIndexV2(errors, graph);
  validateSynthesisPages(errors, warnings, graph);

  return { valid: errors.length === 0, errors, warnings };
}

function validateEnrichedMeta(errors: string[], warnings: string[], graph: EnrichedKnowledgeGraph): void {
  if (graph.meta === undefined) return;
  if (typeof graph.meta !== 'object' || graph.meta === null || Array.isArray(graph.meta)) {
    errors.push('meta must be an object when provided');
    return;
  }

  if (graph.meta.knowledge_scanned_at !== undefined) {
    validateRequiredText(errors, 'meta.knowledge_scanned_at', graph.meta.knowledge_scanned_at);
    if (isNonEmptyString(graph.meta.knowledge_scanned_at) && !isValidIsoTimestamp(graph.meta.knowledge_scanned_at)) {
      errors.push('meta.knowledge_scanned_at must be a valid ISO-8601 timestamp');
    }
  }

  if (graph.meta.last_sync_at !== undefined) {
    validateRequiredText(errors, 'meta.last_sync_at', graph.meta.last_sync_at);
    if (isNonEmptyString(graph.meta.last_sync_at) && !isValidIsoTimestamp(graph.meta.last_sync_at)) {
      errors.push('meta.last_sync_at must be a valid ISO-8601 timestamp');
    }
  }

  if (
    isNonEmptyString(graph.meta.knowledge_scanned_at)
    && isNonEmptyString(graph.enriched_at)
    && isValidIsoTimestamp(graph.meta.knowledge_scanned_at)
    && isValidIsoTimestamp(graph.enriched_at)
    && Date.parse(graph.meta.knowledge_scanned_at) > Date.parse(graph.enriched_at)
  ) {
    errors.push('meta.knowledge_scanned_at must be less than or equal to enriched_at');
  }

  if (graph.meta.staleness !== undefined) {
    if (typeof graph.meta.staleness !== 'object' || graph.meta.staleness === null || Array.isArray(graph.meta.staleness)) {
      errors.push('meta.staleness must be an object when provided');
      return;
    }

    validateStalenessInfo(errors, warnings, 'meta.staleness.enriched_from_knowledge', graph.meta.staleness.enriched_from_knowledge);
    validateStalenessInfo(errors, warnings, 'meta.staleness.wiki_from_enriched', graph.meta.staleness.wiki_from_enriched);
  }
}

function validateStalenessInfo(
  errors: string[],
  warnings: string[],
  fieldPath: string,
  value: { status: unknown; checked_at?: unknown; reason?: unknown } | undefined,
): void {
  if (value === undefined) return;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    errors.push(`${fieldPath} must be an object when provided`);
    return;
  }

  validateRequiredText(errors, `${fieldPath}.status`, value.status);
  if (!KNOWLEDGE_STALENESS_STATUS_VALUES.includes(value.status as (typeof KNOWLEDGE_STALENESS_STATUS_VALUES)[number])) {
    errors.push(`${fieldPath}.status must be one of: ${KNOWLEDGE_STALENESS_STATUS_VALUES.join(', ')}`);
  }

  if (value.checked_at !== undefined) {
    validateRequiredText(errors, `${fieldPath}.checked_at`, value.checked_at);
    if (isNonEmptyString(value.checked_at) && !isValidIsoTimestamp(value.checked_at)) {
      errors.push(`${fieldPath}.checked_at must be a valid ISO-8601 timestamp`);
    }
  }

  if (value.reason !== undefined) {
    validateRequiredText(errors, `${fieldPath}.reason`, value.reason, { rejectPlaceholders: true });
    if (isNonEmptyString(value.reason) && hasGermanDefaultToken(value.reason)) {
      warnings.push(`${fieldPath}.reason should remain English-only for generated metadata`);
    }
  }
}

function validateIndexV2(errors: string[], graph: EnrichedKnowledgeGraph): void {
  const indexV2 = graph.index_v2;
  if (indexV2 === undefined) return;
  if (typeof indexV2 !== 'object' || indexV2 === null || Array.isArray(indexV2)) {
    errors.push('index_v2 must be an object when provided');
    return;
  }

  validateRequiredText(errors, 'index_v2.version', indexV2.version);
  if (indexV2.version !== '2') {
    errors.push('index_v2.version must be exactly "2"');
  }

  validateRequiredText(errors, 'index_v2.generated_at', indexV2.generated_at);
  if (isNonEmptyString(indexV2.generated_at) && !isValidIsoTimestamp(indexV2.generated_at)) {
    errors.push('index_v2.generated_at must be a valid ISO-8601 timestamp');
  }

  if (
    isNonEmptyString(indexV2.generated_at)
    && isNonEmptyString(graph.enriched_at)
    && isValidIsoTimestamp(indexV2.generated_at)
    && isValidIsoTimestamp(graph.enriched_at)
    && Date.parse(indexV2.generated_at) < Date.parse(graph.enriched_at)
  ) {
    errors.push('index_v2.generated_at must be greater than or equal to enriched_at');
  }

  const featureIds = new Set(graph.features.map(feature => feature.id));
  const moduleIds = new Set(graph.modules.map(mod => mod.id));
  const symbolIds = new Set<string>();
  const processIds = new Set<string>();
  const clusterIds = new Set<string>();
  const referenceKeys = new Set<string>();

  if (indexV2.symbols !== undefined && ensureArray(errors, 'index_v2.symbols', indexV2.symbols)) {
    indexV2.symbols.forEach((symbol, symbolIndex) => {
      const symbolPath = `index_v2.symbols[${symbolIndex}]`;
      validateRequiredText(errors, `${symbolPath}.id`, symbol.id, { rejectPlaceholders: true });
      validateRequiredText(errors, `${symbolPath}.name`, symbol.name, { rejectPlaceholders: true });
      validateRequiredText(errors, `${symbolPath}.kind`, symbol.kind, { rejectPlaceholders: true });
      validateRequiredText(errors, `${symbolPath}.path`, symbol.path, { rejectPlaceholders: true });

      if (isNonEmptyString(symbol.id)) {
        if (symbolIds.has(symbol.id)) {
          errors.push(`duplicate index_v2 symbol id: ${symbol.id}`);
        }
        symbolIds.add(symbol.id);
      }

      if (isNonEmptyString(symbol.path) && !isValidRelativeRepoPath(symbol.path)) {
        errors.push(`${symbolPath}.path must be a relative repo path without traversal`);
      }

      if (symbol.module_id !== undefined) {
        validateRequiredText(errors, `${symbolPath}.module_id`, symbol.module_id, { rejectPlaceholders: true });
        if (isNonEmptyString(symbol.module_id) && !moduleIds.has(symbol.module_id)) {
          errors.push(`${symbolPath}.module_id references unknown module id: ${symbol.module_id}`);
        }
      }

      if (symbol.feature_ids !== undefined && ensureArray(errors, `${symbolPath}.feature_ids`, symbol.feature_ids)) {
        symbol.feature_ids.forEach((featureId, featureIdIndex) => {
          validateRequiredText(errors, `${symbolPath}.feature_ids[${featureIdIndex}]`, featureId, { rejectPlaceholders: true });
          if (isNonEmptyString(featureId) && !featureIds.has(featureId)) {
            errors.push(`${symbolPath}.feature_ids[${featureIdIndex}] references unknown feature id: ${featureId}`);
          }
        });
      }
    });
  }

  if (indexV2.references !== undefined && ensureArray(errors, 'index_v2.references', indexV2.references)) {
    indexV2.references.forEach((reference, referenceIndex) => {
      const referencePath = `index_v2.references[${referenceIndex}]`;
      validateRequiredText(errors, `${referencePath}.from_symbol_id`, reference.from_symbol_id, { rejectPlaceholders: true });
      validateRequiredText(errors, `${referencePath}.to_symbol_id`, reference.to_symbol_id, { rejectPlaceholders: true });
      validateRequiredText(errors, `${referencePath}.type`, reference.type, { rejectPlaceholders: true });

      if (isNonEmptyString(reference.from_symbol_id) && !symbolIds.has(reference.from_symbol_id)) {
        errors.push(`${referencePath}.from_symbol_id references unknown symbol id: ${reference.from_symbol_id}`);
      }
      if (isNonEmptyString(reference.to_symbol_id) && !symbolIds.has(reference.to_symbol_id)) {
        errors.push(`${referencePath}.to_symbol_id references unknown symbol id: ${reference.to_symbol_id}`);
      }
      if (!INDEX_REFERENCE_TYPE_VALUES.includes(reference.type)) {
        errors.push(`${referencePath}.type must be one of: ${INDEX_REFERENCE_TYPE_VALUES.join(', ')}`);
      }

      const referenceKey = `${reference.from_symbol_id}|${reference.type}|${reference.to_symbol_id}`;
      if (referenceKeys.has(referenceKey)) {
        errors.push(`duplicate index_v2 reference detected: ${referenceKey}`);
      }
      referenceKeys.add(referenceKey);
    });
  }

  if (indexV2.processes !== undefined && ensureArray(errors, 'index_v2.processes', indexV2.processes)) {
    indexV2.processes.forEach((process, processIndex) => {
      const processPath = `index_v2.processes[${processIndex}]`;
      validateRequiredText(errors, `${processPath}.id`, process.id, { rejectPlaceholders: true });
      validateRequiredText(errors, `${processPath}.name`, process.name, { rejectPlaceholders: true });

      if (isNonEmptyString(process.id)) {
        if (processIds.has(process.id)) {
          errors.push(`duplicate index_v2 process id: ${process.id}`);
        }
        processIds.add(process.id);
      }

      if (ensureArray(errors, `${processPath}.entry_points`, process.entry_points)) {
        process.entry_points.forEach((entryPoint, entryPointIndex) => {
          validateRequiredText(errors, `${processPath}.entry_points[${entryPointIndex}]`, entryPoint, { rejectPlaceholders: true });
          if (isNonEmptyString(entryPoint) && !isValidRelativeRepoPath(entryPoint)) {
            errors.push(`${processPath}.entry_points[${entryPointIndex}] must be a relative repo path without traversal`);
          }
        });
      }

      if (process.symbol_ids !== undefined && ensureArray(errors, `${processPath}.symbol_ids`, process.symbol_ids)) {
        process.symbol_ids.forEach((symbolId, symbolIdIndex) => {
          validateRequiredText(errors, `${processPath}.symbol_ids[${symbolIdIndex}]`, symbolId, { rejectPlaceholders: true });
          if (isNonEmptyString(symbolId) && !symbolIds.has(symbolId)) {
            errors.push(`${processPath}.symbol_ids[${symbolIdIndex}] references unknown symbol id: ${symbolId}`);
          }
        });
      }

      if (process.feature_ids !== undefined && ensureArray(errors, `${processPath}.feature_ids`, process.feature_ids)) {
        process.feature_ids.forEach((featureId, featureIdIndex) => {
          validateRequiredText(errors, `${processPath}.feature_ids[${featureIdIndex}]`, featureId, { rejectPlaceholders: true });
          if (isNonEmptyString(featureId) && !featureIds.has(featureId)) {
            errors.push(`${processPath}.feature_ids[${featureIdIndex}] references unknown feature id: ${featureId}`);
          }
        });
      }
    });
  }

  if (indexV2.clusters !== undefined && ensureArray(errors, 'index_v2.clusters', indexV2.clusters)) {
    indexV2.clusters.forEach((cluster, clusterIndex) => {
      const clusterPath = `index_v2.clusters[${clusterIndex}]`;
      validateRequiredText(errors, `${clusterPath}.id`, cluster.id, { rejectPlaceholders: true });
      validateRequiredText(errors, `${clusterPath}.name`, cluster.name, { rejectPlaceholders: true });

      if (isNonEmptyString(cluster.id)) {
        if (clusterIds.has(cluster.id)) {
          errors.push(`duplicate index_v2 cluster id: ${cluster.id}`);
        }
        clusterIds.add(cluster.id);
      }

      if (cluster.module_ids !== undefined && ensureArray(errors, `${clusterPath}.module_ids`, cluster.module_ids)) {
        cluster.module_ids.forEach((moduleId, moduleIdIndex) => {
          validateRequiredText(errors, `${clusterPath}.module_ids[${moduleIdIndex}]`, moduleId, { rejectPlaceholders: true });
          if (isNonEmptyString(moduleId) && !moduleIds.has(moduleId)) {
            errors.push(`${clusterPath}.module_ids[${moduleIdIndex}] references unknown module id: ${moduleId}`);
          }
        });
      }

      if (cluster.feature_ids !== undefined && ensureArray(errors, `${clusterPath}.feature_ids`, cluster.feature_ids)) {
        cluster.feature_ids.forEach((featureId, featureIdIndex) => {
          validateRequiredText(errors, `${clusterPath}.feature_ids[${featureIdIndex}]`, featureId, { rejectPlaceholders: true });
          if (isNonEmptyString(featureId) && !featureIds.has(featureId)) {
            errors.push(`${clusterPath}.feature_ids[${featureIdIndex}] references unknown feature id: ${featureId}`);
          }
        });
      }
    });
  }
}

export function validateRawKnowledge(raw: RawKnowledge): ValidationResult {
  const errors: string[] = [];

  validateRequiredText(errors, 'root_path', raw.root_path);
  validateRequiredText(errors, 'scanned_at', raw.scanned_at);
  ensureArray(errors, 'files', raw.files);
  ensureArray(errors, 'imports', raw.imports);
  ensureArray(errors, 'exports', raw.exports);
  ensureArray(errors, 'entry_points', raw.entry_points);

  for (const [fileIndex, file] of (raw.files ?? []).entries()) {
    const filePath = `files[${fileIndex}]`;
    validateRequiredText(errors, `${filePath}.path`, file.path);
    validateRequiredText(errors, `${filePath}.language`, file.language);
    if (!['source', 'config', 'docs', 'tests'].includes(file.type)) {
      errors.push(`${filePath}.type has invalid value: ${file.type}`);
    }
    if (typeof file.size_bytes !== 'number' || !Number.isFinite(file.size_bytes) || file.size_bytes < 0) {
      errors.push(`${filePath}.size_bytes must be a non-negative number`);
    }
  }

  for (const [importIndex, imp] of (raw.imports ?? []).entries()) {
    const importPath = `imports[${importIndex}]`;
    validateRequiredText(errors, `${importPath}.from_file`, imp.from_file);
    validateRequiredText(errors, `${importPath}.import_path`, imp.import_path);
    if (typeof imp.is_external !== 'boolean') {
      errors.push(`${importPath}.is_external must be a boolean`);
    }
  }

  for (const [exportIndex, exp] of (raw.exports ?? []).entries()) {
    const exportPath = `exports[${exportIndex}]`;
    validateRequiredText(errors, `${exportPath}.from_file`, exp.from_file);
    validateRequiredText(errors, `${exportPath}.name`, exp.name);
    if (!['function', 'class', 'variable', 'type', 'default'].includes(exp.kind)) {
      errors.push(`${exportPath}.kind has invalid value: ${exp.kind}`);
    }
  }

  for (const [entryPointIndex, entryPoint] of (raw.entry_points ?? []).entries()) {
    validateRequiredText(errors, `entry_points[${entryPointIndex}]`, entryPoint);
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

function validateSynthesisPages(
  errors: string[],
  warnings: string[],
  graph: EnrichedKnowledgeGraph,
): void {
  if (graph.synthesis_pages === undefined) return;
  if (!Array.isArray(graph.synthesis_pages)) {
    errors.push('synthesis_pages must be an array when provided');
    return;
  }

  const featureIds = new Set(graph.features.map(f => f.id));
  const moduleIds = new Set(graph.modules.map(m => m.id));
  const thirdPartyIds = new Set(graph.third_parties.map(t => t.id));
  const knownPageTargets = new Set<string>();
  graph.features.forEach(f => knownPageTargets.add(f.wiki?.page_target || ''));
  graph.modules.forEach(m => knownPageTargets.add(m.wiki?.page_target || ''));
  graph.third_parties.forEach(t => knownPageTargets.add(t.wiki?.page_target || ''));

  const seenIdentityKeys = new Set<string>();

  graph.synthesis_pages.forEach((page, pageIndex) => {
    const pagePath = `synthesis_pages[${pageIndex}]`;
    validateRequiredText(errors, `${pagePath}.id`, page.id, { rejectPlaceholders: true });
    validateRequiredText(errors, `${pagePath}.kind`, page.kind, { rejectPlaceholders: true });
    if (!SYNTHESIS_PAGE_KIND_VALUES.includes(page.kind as (typeof SYNTHESIS_PAGE_KIND_VALUES)[number])) {
      errors.push(`${pagePath}.kind must be one of: ${SYNTHESIS_PAGE_KIND_VALUES.join(', ')}`);
    }
    validateRequiredText(errors, `${pagePath}.title`, page.title, { rejectPlaceholders: true });
    validateRequiredText(errors, `${pagePath}.question`, page.question, { rejectPlaceholders: true });
    validateRequiredText(errors, `${pagePath}.query_hash`, page.query_hash, { rejectPlaceholders: true });
    validateRequiredText(errors, `${pagePath}.identity_key`, page.identity_key, { rejectPlaceholders: true });
    validateRequiredText(errors, `${pagePath}.content_hash`, page.content_hash, { rejectPlaceholders: true });
    validateRequiredText(errors, `${pagePath}.content_markdown`, page.content_markdown, { rejectPlaceholders: true });

    if (page.source_entity_ids === undefined || !Array.isArray(page.source_entity_ids)) {
      errors.push(`${pagePath}.source_entity_ids must be an array`);
    } else {
      page.source_entity_ids.forEach((id, idIndex) => {
        if (!featureIds.has(id) && !moduleIds.has(id) && !thirdPartyIds.has(id)) {
          errors.push(`${pagePath}.source_entity_ids[${idIndex}] references unknown entity id: ${id}`);
        }
      });
    }

    if (page.source_page_targets === undefined || !Array.isArray(page.source_page_targets)) {
      errors.push(`${pagePath}.source_page_targets must be an array`);
    } else {
      page.source_page_targets.forEach((target, targetIndex) => {
        if (!knownPageTargets.has(target)) {
          errors.push(`${pagePath}.source_page_targets[${targetIndex}] references unknown page target: ${target}`);
        }
      });
    }

    if (page.source_snapshot === undefined) {
      errors.push(`${pagePath}.source_snapshot is required`);
    } else {
      validateRequiredText(errors, `${pagePath}.source_snapshot.enriched_at`, page.source_snapshot.enriched_at);
      validateRequiredText(errors, `${pagePath}.source_snapshot.version`, page.source_snapshot.version, { rejectPlaceholders: true });
      if (page.source_snapshot.index_generated_at !== undefined) {
        validateRequiredText(errors, `${pagePath}.source_snapshot.index_generated_at`, page.source_snapshot.index_generated_at);
      }
    }

    if (page.wiki === undefined) {
      errors.push(`${pagePath}.wiki is required`);
    } else {
      validateRequiredText(errors, `${pagePath}.wiki.page_target`, page.wiki.page_target, { rejectPlaceholders: true });
      if (!page.wiki.page_target.startsWith('Synthesis/')) {
        errors.push(`${pagePath}.wiki.page_target must be under Synthesis/ directory`);
      }
      if (page.wiki.source_refs === undefined || !Array.isArray(page.wiki.source_refs)) {
        errors.push(`${pagePath}.wiki.source_refs must be an array`);
      }
      validateRequiredText(errors, `${pagePath}.wiki.last_verified`, page.wiki.last_verified);
    }

    if (isNonEmptyString(page.identity_key)) {
      if (seenIdentityKeys.has(page.identity_key)) {
        errors.push(`duplicate synthesis page identity_key: ${page.identity_key}`);
      }
      seenIdentityKeys.add(page.identity_key);
    }
  });
}
