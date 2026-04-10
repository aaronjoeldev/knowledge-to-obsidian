import { readFile } from 'node:fs/promises';
import { isAbsolute, join, normalize } from 'node:path';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KtoAgentsConfig {
  project_mapper: string;
  graph_builder: string;
  obsidian_sync: string;
  change_detector: string;
  wiki_lint: string;
  query_writer: string;
}

export type KtoProvider =
  | 'anthropic'
  | 'bedrock'
  | 'vertex'
  | 'foundry'
  | 'openrouter'
  | 'openai/codex'
  | 'glm';

export const KTO_PROVIDERS: readonly KtoProvider[] = [
  'anthropic',
  'bedrock',
  'vertex',
  'foundry',
  'openrouter',
  'openai/codex',
  'glm',
];

export interface KtoConfig {
  /** Absolute path to the Obsidian vault root. */
  vault_path: string;
  /** Preferred provider/runtime family for this repo. */
  provider: KtoProvider;
  /** Stable project ID used in all entity IDs, e.g. "MY-PROJECT". */
  project_id: string;
  /** Subfolder inside vault where this project's notes live. */
  obsidian_subfolder: string;
  /** Output directory for .kto/knowledge.json etc. Relative to project root. */
  output_dir: string;
  /** Model ID per agent. */
  agents: KtoAgentsConfig;
  /** Optional fallback model ID per agent when the primary model is unavailable. */
  model_fallbacks: Partial<KtoAgentsConfig>;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const CONFIG_DEFAULTS: KtoConfig = {
  vault_path: '',
  provider: 'anthropic',
  project_id: 'PROJECT',
  obsidian_subfolder: 'Projects/PROJECT',
  output_dir: '.kto',
  agents: {
    project_mapper: 'claude-haiku-4-5-20251001',
    graph_builder: 'claude-sonnet-4-6',
    obsidian_sync: 'claude-haiku-4-5-20251001',
    change_detector: 'claude-haiku-4-5-20251001',
    wiki_lint: 'claude-haiku-4-5-20251001',
    query_writer: 'claude-haiku-4-5-20251001',
  },
  model_fallbacks: {},
};

// ─── Loader ───────────────────────────────────────────────────────────────────

export interface LoadConfigOptions {
  /** If true, throws when vault_path is empty. */
  requireVault?: boolean;
}

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

  const parsedAgents = parsed['agents'];
  const parsedFallbacks = parsed['model_fallbacks'];
  if (
    parsedAgents !== undefined
    && (typeof parsedAgents !== 'object' || parsedAgents === null || Array.isArray(parsedAgents))
  ) {
    throw new Error(`Invalid config at ${configPath}: agents must be an object`);
  }

  if (
    parsedFallbacks !== undefined
    && (typeof parsedFallbacks !== 'object' || parsedFallbacks === null || Array.isArray(parsedFallbacks))
  ) {
    throw new Error(`Invalid config at ${configPath}: model_fallbacks must be an object`);
  }

  const merged: KtoConfig = {
    ...structuredClone(CONFIG_DEFAULTS),
    ...parsed,
    agents: {
      ...CONFIG_DEFAULTS.agents,
      ...(parsedAgents as Partial<KtoAgentsConfig> ?? {}),
    },
    model_fallbacks: {
      ...CONFIG_DEFAULTS.model_fallbacks,
      ...(parsedFallbacks as Partial<KtoAgentsConfig> ?? {}),
    },
  };

  return validateAndReturn(merged, options, configPath);
}

function validateAndReturn(
  config: KtoConfig,
  options: LoadConfigOptions,
  configPath: string,
): KtoConfig {
  if (typeof config.vault_path !== 'string') {
    throw new Error(`Invalid config at ${configPath}: vault_path must be a string`);
  }

  if (typeof config.provider !== 'string' || !KTO_PROVIDERS.includes(config.provider as KtoProvider)) {
    throw new Error(`Invalid config at ${configPath}: provider must be one of ${KTO_PROVIDERS.join(', ')}`);
  }

  const vaultPath = config.vault_path.trim();
  if (vaultPath !== '' && !isAbsolute(config.vault_path)) {
    throw new Error(`Invalid config at ${configPath}: vault_path must be an absolute path when set`);
  }

  if (typeof config.project_id !== 'string' || config.project_id.trim() === '') {
    throw new Error(`Invalid config at ${configPath}: project_id must be a non-empty string`);
  }

  if (
    typeof config.obsidian_subfolder !== 'string'
    || config.obsidian_subfolder.trim() === ''
  ) {
    throw new Error(`Invalid config at ${configPath}: obsidian_subfolder must be a non-empty string`);
  }

  if (typeof config.output_dir !== 'string' || config.output_dir.trim() === '') {
    throw new Error(`Invalid config at ${configPath}: output_dir must be a non-empty string`);
  }

  const outputDir = config.output_dir.trim();
  if (isAbsolute(outputDir)) {
    throw new Error(`Invalid config at ${configPath}: output_dir must be a relative path`);
  }

  const outputDirSegments = outputDir.split(/[\\/]+/);
  if (outputDirSegments.some((segment) => segment === '..')) {
    throw new Error(`Invalid config at ${configPath}: output_dir must not contain '..' path traversal`);
  }

  config.output_dir = normalize(outputDir).replace(/[\\/]+$/, '');

  if (typeof config.agents !== 'object' || config.agents === null || Array.isArray(config.agents)) {
    throw new Error(`Invalid config at ${configPath}: agents must be an object`);
  }

  if (
    typeof config.model_fallbacks !== 'object'
    || config.model_fallbacks === null
    || Array.isArray(config.model_fallbacks)
  ) {
    throw new Error(`Invalid config at ${configPath}: model_fallbacks must be an object`);
  }

  const agentFields: Array<keyof KtoAgentsConfig> = [
    'project_mapper',
    'graph_builder',
    'obsidian_sync',
    'change_detector',
    'wiki_lint',
    'query_writer',
  ];

  for (const field of agentFields) {
    const value = config.agents[field];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`Invalid config at ${configPath}: agents.${field} must be a non-empty string`);
    }
    config.agents[field] = value.trim();

    const fallbackValue = config.model_fallbacks[field];
    if (fallbackValue !== undefined && (typeof fallbackValue !== 'string' || fallbackValue.trim() === '')) {
      throw new Error(`Invalid config at ${configPath}: model_fallbacks.${field} must be a non-empty string when set`);
    }
    if (fallbackValue !== undefined) {
      config.model_fallbacks[field] = fallbackValue.trim();
    }
  }

  if (options.requireVault === true && vaultPath === '') {
    throw new Error(
      `vault_path is required but not set in ${configPath}. Run /kto:init to configure.`,
    );
  }
  return config;
}
