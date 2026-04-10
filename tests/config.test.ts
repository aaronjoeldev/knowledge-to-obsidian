import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, CONFIG_DEFAULTS, type KtoConfig } from '../src/config.js';

const TMP_DIR = '/tmp/kto-config-test';

beforeEach(() => {
  mkdirSync(join(TMP_DIR, '.kto'), { recursive: true });
});

afterEach(() => {
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true });
});

describe('loadConfig', () => {
  it('returns defaults when config file is missing', async () => {
    rmSync(join(TMP_DIR, '.kto'), { recursive: true });
    const config = await loadConfig(TMP_DIR);
    expect(config.agents.project_mapper).toBe(CONFIG_DEFAULTS.agents.project_mapper);
    expect(config.vault_path).toBe('');
  });

  it('merges user config over defaults', async () => {
    const userConfig = {
      vault_path: '/Users/test/Notes',
      project_id: 'MY-PROJECT',
    };
    writeFileSync(
      join(TMP_DIR, '.kto', 'config.json'),
      JSON.stringify(userConfig),
    );
    const config = await loadConfig(TMP_DIR);
    expect(config.vault_path).toBe('/Users/test/Notes');
    expect(config.project_id).toBe('MY-PROJECT');
    // Defaults preserved for unset fields
    expect(config.agents.project_mapper).toBe(CONFIG_DEFAULTS.agents.project_mapper);
  });

  it('allows per-agent model overrides', async () => {
    const userConfig = {
      vault_path: '/Users/test/Notes',
      agents: {
        graph_builder: 'claude-opus-4-6',
      },
    };
    writeFileSync(
      join(TMP_DIR, '.kto', 'config.json'),
      JSON.stringify(userConfig),
    );
    const config = await loadConfig(TMP_DIR);
    expect(config.agents.graph_builder).toBe('claude-opus-4-6');
    // Other agents keep their defaults
    expect(config.agents.project_mapper).toBe(CONFIG_DEFAULTS.agents.project_mapper);
  });

  it('allows optional per-agent model fallbacks', async () => {
    const userConfig = {
      vault_path: '/Users/test/Notes',
      model_fallbacks: {
        graph_builder: 'claude-sonnet-4-6',
      },
    };
    writeFileSync(
      join(TMP_DIR, '.kto', 'config.json'),
      JSON.stringify(userConfig),
    );
    const config = await loadConfig(TMP_DIR);
    expect(config.model_fallbacks.graph_builder).toBe('claude-sonnet-4-6');
  });

  it('throws on malformed JSON', async () => {
    writeFileSync(join(TMP_DIR, '.kto', 'config.json'), '{ broken json');
    await expect(loadConfig(TMP_DIR)).rejects.toThrow('Failed to parse');
  });

  it('throws when vault_path is missing and project is initialized', async () => {
    writeFileSync(
      join(TMP_DIR, '.kto', 'config.json'),
      JSON.stringify({ project_id: 'XYZ' }),
    );
    await expect(loadConfig(TMP_DIR, { requireVault: true })).rejects.toThrow(
      'vault_path',
    );
  });

  it('throws when vault_path is relative', async () => {
    writeFileSync(
      join(TMP_DIR, '.kto', 'config.json'),
      JSON.stringify({ vault_path: 'relative/path' }),
    );

    await expect(loadConfig(TMP_DIR)).rejects.toThrow('vault_path must be an absolute path');
  });

  it('throws when top-level config fields have invalid types', async () => {
    const invalidConfig = {
      project_id: 123,
      obsidian_subfolder: true,
      output_dir: ['.kto'],
    };

    writeFileSync(join(TMP_DIR, '.kto', 'config.json'), JSON.stringify(invalidConfig));

    await expect(loadConfig(TMP_DIR)).rejects.toThrow('project_id must be a non-empty string');
  });

  it('throws when agents is not an object', async () => {
    writeFileSync(
      join(TMP_DIR, '.kto', 'config.json'),
      JSON.stringify({ agents: 'claude-sonnet-4-6' }),
    );

    await expect(loadConfig(TMP_DIR)).rejects.toThrow('agents must be an object');
  });

  it('throws when model_fallbacks is not an object', async () => {
    writeFileSync(
      join(TMP_DIR, '.kto', 'config.json'),
      JSON.stringify({ model_fallbacks: 'claude-sonnet-4-6' }),
    );

    await expect(loadConfig(TMP_DIR)).rejects.toThrow('model_fallbacks must be an object');
  });

  it('throws when strings are empty after trimming', async () => {
    const invalidConfig: Partial<KtoConfig> = {
      project_id: '   ',
      obsidian_subfolder: 'Projects/ABC',
      output_dir: '.kto',
      agents: {
        ...CONFIG_DEFAULTS.agents,
        graph_builder: '   ',
      },
    };

    writeFileSync(join(TMP_DIR, '.kto', 'config.json'), JSON.stringify(invalidConfig));

    await expect(loadConfig(TMP_DIR)).rejects.toThrow('project_id must be a non-empty string');
  });

  it('normalizes output_dir and trims whitespace', async () => {
    writeFileSync(
      join(TMP_DIR, '.kto', 'config.json'),
      JSON.stringify({ output_dir: '  kto-out//nested/./  ' }),
    );

    const config = await loadConfig(TMP_DIR);
    expect(config.output_dir).toBe('kto-out/nested');
  });

  it('rejects empty model fallback values', async () => {
    writeFileSync(
      join(TMP_DIR, '.kto', 'config.json'),
      JSON.stringify({ model_fallbacks: { graph_builder: '   ' } }),
    );

    await expect(loadConfig(TMP_DIR)).rejects.toThrow('model_fallbacks.graph_builder must be a non-empty string when set');
  });

  it('rejects absolute output_dir paths', async () => {
    writeFileSync(
      join(TMP_DIR, '.kto', 'config.json'),
      JSON.stringify({ output_dir: '/tmp/kto' }),
    );

    await expect(loadConfig(TMP_DIR)).rejects.toThrow('output_dir must be a relative path');
  });

  it('rejects output_dir traversal segments', async () => {
    writeFileSync(
      join(TMP_DIR, '.kto', 'config.json'),
      JSON.stringify({ output_dir: '../tmp/kto' }),
    );

    await expect(loadConfig(TMP_DIR)).rejects.toThrow("output_dir must not contain '..' path traversal");
  });
});
