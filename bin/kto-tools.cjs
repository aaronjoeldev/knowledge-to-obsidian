#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const PROVIDERS = [
  {
    id: 'anthropic',
    label: 'Anthropic API',
    description: 'Use explicit Claude model IDs',
    detect(env) {
      return !!(env.ANTHROPIC_API_KEY || env.ANTHROPIC_BASE_URL);
    },
  },
  {
    id: 'bedrock',
    label: 'Amazon Bedrock',
    description: 'Use runtime-managed model selection',
    detect(env) {
      return !!(env.CLAUDE_CODE_USE_BEDROCK || env.ANTHROPIC_BEDROCK_BASE_URL || env.AWS_BEARER_TOKEN_BEDROCK);
    },
  },
  {
    id: 'vertex',
    label: 'Google Vertex AI',
    description: 'Use runtime-managed model selection',
    detect(env) {
      return !!(env.CLAUDE_CODE_USE_VERTEX || env.ANTHROPIC_VERTEX_PROJECT_ID || env.ANTHROPIC_VERTEX_BASE_URL);
    },
  },
  {
    id: 'foundry',
    label: 'Microsoft Foundry',
    description: 'Use runtime-managed model selection',
    detect(env) {
      return !!(env.ANTHROPIC_FOUNDRY_API_KEY || env.ANTHROPIC_FOUNDRY_API_ENDPOINT || env.ANTHROPIC_FOUNDRY_MODEL);
    },
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    description: 'Use runtime-managed model selection',
    detect(env) {
      return !!env.OPENROUTER_API_KEY;
    },
  },
  {
    id: 'openai/codex',
    label: 'OpenAI / Codex',
    description: 'Use runtime-managed model selection',
    detect(env) {
      return !!(env.OPENAI_API_KEY || env.OPENAI_BASE_URL || env.CODEX_PROVIDER || env.CODEX_MODEL || env.CODEX_HOME);
    },
  },
  {
    id: 'glm',
    label: 'GLM / Z.AI',
    description: 'Use runtime-managed model selection',
    detect(env) {
      return !!(env.Z_AI_API_KEY || env.GLM_API_KEY || env.GLM_BASE_URL || env.GLM_MODEL || env.GLM_DELEGATOR_CONFIG);
    },
  },
];

const ANTHROPIC_DEFAULT_AGENTS = {
  project_mapper: 'claude-haiku-4-5-20251001',
  graph_builder: 'claude-sonnet-4-6',
  obsidian_sync: 'claude-haiku-4-5-20251001',
  change_detector: 'claude-haiku-4-5-20251001',
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function detectProviders(env = process.env) {
  return PROVIDERS
    .filter((provider) => provider.detect(env))
    .map((provider) => provider.id);
}

function parseConfig(configPath) {
  try {
    const raw = fs.readFileSync(configPath, 'utf-8').trim();
    if (raw === '') return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getOrderedProviderOptions(detectedIds, selectedProvider) {
  const detectedSet = new Set(detectedIds);
  const ordered = [...PROVIDERS].sort((a, b) => {
    const aScore = (a.id === selectedProvider ? 4 : 0) + (detectedSet.has(a.id) ? 2 : 0) + (a.id === 'anthropic' ? 1 : 0);
    const bScore = (b.id === selectedProvider ? 4 : 0) + (detectedSet.has(b.id) ? 2 : 0) + (b.id === 'anthropic' ? 1 : 0);
    return bScore - aScore;
  });

  return ordered.map((provider) => ({
    id: provider.id,
    label: provider.label,
    description: provider.description,
    detected: detectedSet.has(provider.id),
    recommended: provider.id === selectedProvider,
  }));
}

function buildProviderDefaults(selectedProvider, existingConfig) {
  const existingAgents = existingConfig.agents || {};
  const existingFallbacks = existingConfig.model_fallbacks || {};

  if (selectedProvider === 'anthropic') {
    return {
      agents: {
        ...ANTHROPIC_DEFAULT_AGENTS,
        ...existingAgents,
      },
      model_fallbacks: clone(existingFallbacks),
    };
  }

  return {
    agents: {
      project_mapper: existingAgents.project_mapper || 'inherit',
      graph_builder: existingAgents.graph_builder || 'inherit',
      obsidian_sync: existingAgents.obsidian_sync || 'inherit',
      change_detector: existingAgents.change_detector || 'inherit',
    },
    model_fallbacks: clone(existingFallbacks),
  };
}

function buildInitContext(projectDir, env = process.env) {
  const currentDirName = path.basename(projectDir);
  const configPath = path.join(projectDir, '.kto', 'config.json');
  const existingConfig = parseConfig(configPath);
  const detectedProviders = detectProviders(env);
  const selectedProvider = existingConfig.provider || detectedProviders[0] || 'anthropic';
  const providerOptions = getOrderedProviderOptions(detectedProviders, selectedProvider);
  const providerDefaults = buildProviderDefaults(selectedProvider, existingConfig);

  return {
    configPath,
    currentDirName,
    existingConfig,
    detectedProviders,
    selectedProvider,
    providerOptions,
    defaults: {
      vault_path: existingConfig.vault_path || '',
      provider: selectedProvider,
      project_id: existingConfig.project_id || currentDirName.toUpperCase(),
      obsidian_subfolder: existingConfig.obsidian_subfolder || `Projects/${existingConfig.project_id || currentDirName.toUpperCase()}`,
      output_dir: existingConfig.output_dir || '.kto',
      agents: providerDefaults.agents,
      model_fallbacks: providerDefaults.model_fallbacks,
    },
  };
}

function main() {
  const command = process.argv[2];

  if (command === 'detect-providers') {
    process.stdout.write(JSON.stringify(detectProviders()));
    return;
  }

  if (command === 'init-context') {
    const projectDir = path.resolve(process.argv[3] || process.cwd());
    process.stdout.write(JSON.stringify(buildInitContext(projectDir), null, 2));
    return;
  }

  process.stderr.write('Usage: kto-tools.cjs <detect-providers|init-context> [projectDir]\n');
  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  PROVIDERS,
  detectProviders,
  buildInitContext,
  buildProviderDefaults,
};
