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
});
