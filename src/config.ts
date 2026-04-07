import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KtoAgentsConfig {
  project_mapper: string;
  graph_builder: string;
  obsidian_sync: string;
  change_detector: string;
}

export interface KtoConfig {
  /** Absolute path to the Obsidian vault root. */
  vault_path: string;
  /** Stable project ID used in all entity IDs, e.g. "MY-PROJECT". */
  project_id: string;
  /** Subfolder inside vault where this project's notes live. */
  obsidian_subfolder: string;
  /** Output directory for .kto/knowledge.json etc. Relative to project root. */
  output_dir: string;
  /** Model ID per agent. */
  agents: KtoAgentsConfig;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const CONFIG_DEFAULTS: KtoConfig = {
  vault_path: '',
  project_id: 'PROJECT',
  obsidian_subfolder: 'Projects/PROJECT',
  output_dir: '.kto',
  agents: {
    project_mapper: 'claude-haiku-4-5-20251001',
    graph_builder: 'claude-sonnet-4-6',
    obsidian_sync: 'claude-haiku-4-5-20251001',
    change_detector: 'claude-haiku-4-5-20251001',
  },
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

  const merged: KtoConfig = {
    ...structuredClone(CONFIG_DEFAULTS),
    ...parsed,
    agents: {
      ...CONFIG_DEFAULTS.agents,
      ...(parsed['agents'] as Partial<KtoAgentsConfig> ?? {}),
    },
  };

  return validateAndReturn(merged, options, configPath);
}

function validateAndReturn(
  config: KtoConfig,
  options: LoadConfigOptions,
  configPath: string,
): KtoConfig {
  if (options.requireVault === true && !config.vault_path) {
    throw new Error(
      `vault_path is required but not set in ${configPath}. Run /kto:init to configure.`,
    );
  }
  return config;
}
