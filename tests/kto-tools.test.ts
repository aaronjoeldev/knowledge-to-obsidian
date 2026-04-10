import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  detectProviders,
  buildInitContext,
  buildProviderDefaults,
} = require('../bin/kto-tools.cjs');

describe('kto-tools provider helpers', () => {
  it('detects configured providers from environment signals', () => {
    const detected = detectProviders({
      ANTHROPIC_API_KEY: 'x',
      OPENAI_API_KEY: 'y',
      Z_AI_API_KEY: 'z',
    });

    expect(detected).toEqual(['anthropic', 'openai/codex', 'glm']);
  });

  it('builds provider defaults with inherit for non-anthropic providers', () => {
    const defaults = buildProviderDefaults('openrouter', {});

    expect(defaults.agents).toEqual({
      project_mapper: 'inherit',
      graph_builder: 'inherit',
      obsidian_sync: 'inherit',
      change_detector: 'inherit',
    });
  });

  it('includes all known providers in the init context picker', () => {
    const ctx = buildInitContext('/tmp/example-repo', { OPENROUTER_API_KEY: 'x' });

    expect(ctx.providerOptions.map((option: { id: string }) => option.id)).toEqual([
      'openrouter',
      'anthropic',
      'bedrock',
      'vertex',
      'foundry',
      'openai/codex',
      'glm',
    ]);
    expect(ctx.providerOptions.find((option: { id: string }) => option.id === 'openrouter')?.detected).toBe(true);
  });
});
