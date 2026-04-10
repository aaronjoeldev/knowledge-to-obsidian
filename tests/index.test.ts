import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: queryMock,
}));

import { KtoRunner } from '../src/index.js';

const TMP_DIR = '/tmp/kto-runner-test';

function validEnrichedGraph() {
  return {
    project: {
      id: 'PROJECT-XYZ',
      name: 'KTO Test Project',
      description: 'Fixture graph for runner tests.',
      domain: 'tooling',
      criticality: 'medium',
    },
    features: [
      {
        id: 'FEAT-001',
        name: 'Auth',
        description: 'Handles authentication.',
        status: 'implemented',
        entry_points: ['src/auth/index.ts'],
        modules: ['MODULE-Auth'],
        third_parties: ['THIRD-Indexer'],
        security_impact: 'high',
        wiki: {
          source_refs: [{ path: 'src/auth/index.ts' }],
          last_verified: '2026-04-10T10:00:00Z',
          page_target: 'Overview.md',
        },
      },
    ],
    modules: [
      {
        id: 'MODULE-Auth',
        path: 'src/auth/index.ts',
        language: 'typescript',
        responsibility: 'Auth logic.',
        exports: ['login'],
        dependencies: [],
        used_by_features: ['FEAT-001'],
        wiki: {
          source_refs: [{ path: 'src/auth/index.ts' }],
          last_verified: '2026-04-10T10:00:00Z',
          page_target: 'Architecture.md',
        },
      },
      {
        id: 'MODULE-RunLog',
        path: 'src/api/run-log/route.ts',
        language: 'typescript',
        responsibility: 'Exposes an API route for sync run logs.',
        exports: [],
        dependencies: [],
        used_by_features: [],
        wiki: {
          source_refs: [{ path: 'src/api/run-log/route.ts' }],
          last_verified: '2026-04-10T10:00:00Z',
          page_target: 'Run_Log.md',
        },
      },
    ],
    third_parties: [
      {
        id: 'THIRD-Indexer',
        name: 'Indexer',
        type: 'search',
        data_access: [],
        criticality: 'low',
        used_in: ['FEAT-001'],
        wiki: {
          source_refs: [{ path: 'src/auth/index.ts' }],
          last_verified: '2026-04-10T10:00:00Z',
          page_target: 'Index.md',
        },
      },
    ],
    technologies: [],
    security: { threats: [], pii_flows: [], auth_model: 'JWT' },
    relations: [{ from: 'FEAT-001', to: 'MODULE-Auth', type: 'implemented_by' }],
  };
}

function successStream() {
  return {
    async *[Symbol.asyncIterator]() {
      yield { type: 'result', subtype: 'success' };
    },
  };
}

function failureStream(errors: unknown) {
  return {
    async *[Symbol.asyncIterator]() {
      yield { type: 'result', subtype: 'error', errors };
    },
  };
}

beforeEach(() => {
  mkdirSync(join(TMP_DIR, '.kto'), { recursive: true });
  queryMock.mockReset();
});

afterEach(() => {
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true });
});

describe('KtoRunner model validation', () => {
  it('omits the model option when an agent is configured to inherit the current provider model', async () => {
    writeFileSync(
      join(TMP_DIR, '.kto', 'config.json'),
      JSON.stringify({
        vault_path: '/Users/test/Vault',
        output_dir: '.kto',
        agents: { obsidian_sync: 'inherit' },
      }),
    );
    writeFileSync(
      join(TMP_DIR, '.kto', 'enriched_knowledge.json'),
      JSON.stringify(validEnrichedGraph()),
    );

    queryMock.mockImplementation(() => successStream());

    const runner = new KtoRunner({ projectDir: TMP_DIR });
    const result = await runner.sync();

    expect(result.success).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0].options.model).toBeUndefined();
  });

  it('uses a configured fallback model when the primary model is unavailable', async () => {
    writeFileSync(
      join(TMP_DIR, '.kto', 'config.json'),
      JSON.stringify({
        vault_path: '/Users/test/Vault',
        output_dir: '.kto',
        agents: { obsidian_sync: 'invalid-model-name' },
        model_fallbacks: { obsidian_sync: 'claude-haiku-4-5-20251001' },
      }),
    );
    writeFileSync(
      join(TMP_DIR, '.kto', 'enriched_knowledge.json'),
      JSON.stringify(validEnrichedGraph()),
    );

    queryMock.mockImplementation(({ options }: { options: { model: string } }) => {
      if (options.model === 'invalid-model-name') {
        return failureStream([{ message: '404 model: invalid-model-name' }]);
      }
      return successStream();
    });

    const runner = new KtoRunner({ projectDir: TMP_DIR });
    const result = await runner.sync();

    expect(result.success).toBe(true);
    const modelsUsed = queryMock.mock.calls.map(([call]) => call.options.model);
    expect(modelsUsed).toEqual([
      'invalid-model-name',
      'claude-haiku-4-5-20251001',
      'claude-haiku-4-5-20251001',
    ]);
  });

  it('throws a clear error when the configured model cannot authenticate and no fallback exists', async () => {
    writeFileSync(
      join(TMP_DIR, '.kto', 'config.json'),
      JSON.stringify({
        vault_path: '/Users/test/Vault',
        output_dir: '.kto',
        agents: { obsidian_sync: 'claude-sonnet-4-6' },
      }),
    );

    queryMock.mockImplementation(() => {
      return failureStream([{ message: 'Invalid API key' }]);
    });

    const runner = new KtoRunner({ projectDir: TMP_DIR });

    await expect(runner.sync()).rejects.toThrow(
      /authentication failed|model_fallbacks\.obsidian_sync/i,
    );
  });

  it('uses inherit as a fallback for provider-managed sessions', async () => {
    writeFileSync(
      join(TMP_DIR, '.kto', 'config.json'),
      JSON.stringify({
        vault_path: '/Users/test/Vault',
        output_dir: '.kto',
        agents: { obsidian_sync: 'claude-sonnet-4-6' },
        model_fallbacks: { obsidian_sync: 'inherit' },
      }),
    );
    writeFileSync(
      join(TMP_DIR, '.kto', 'enriched_knowledge.json'),
      JSON.stringify(validEnrichedGraph()),
    );

    queryMock.mockImplementation(({ options }: { options: { model?: string } }) => {
      if (options.model === 'claude-sonnet-4-6') {
        return failureStream([{ message: '403 provider access unavailable' }]);
      }
      return successStream();
    });

    const runner = new KtoRunner({ projectDir: TMP_DIR });
    const result = await runner.sync();

    expect(result.success).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1][0].options.model).toBeUndefined();
  });

  it('calls the wiki lint agent model for lint()', async () => {
    writeFileSync(
      join(TMP_DIR, '.kto', 'config.json'),
      JSON.stringify({
        vault_path: '/Users/test/Vault',
        output_dir: '.kto',
        agents: { wiki_lint: 'wiki-lint-model' },
      }),
    );
    writeFileSync(
      join(TMP_DIR, '.kto', 'enriched_knowledge.json'),
      JSON.stringify(validEnrichedGraph()),
    );

    queryMock.mockImplementation(() => successStream());

    const runner = new KtoRunner({ projectDir: TMP_DIR, skipModelValidation: true });
    vi.spyOn(runner as any, 'readAgentDefinition').mockResolvedValue('mock-agent');
    const result = await runner.lint();

    expect(result.success).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0].options.model).toBe('wiki-lint-model');
  });

  it('calls query writer without writeback by default', async () => {
    writeFileSync(
      join(TMP_DIR, '.kto', 'config.json'),
      JSON.stringify({
        vault_path: '/Users/test/Vault',
        output_dir: '.kto',
        agents: { query_writer: 'query-writer-model' },
      }),
    );

    queryMock.mockImplementation(() => successStream());

    const runner = new KtoRunner({ projectDir: TMP_DIR, skipModelValidation: true });
    vi.spyOn(runner as any, 'readAgentDefinition').mockResolvedValue('mock-agent');
    const result = await runner.queryWiki('What changed in auth?');

    expect(result.success).toBe(true);
    expect(result.writeback).toBe(false);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0].options.model).toBe('query-writer-model');
    expect(queryMock.mock.calls[0][0].prompt).toContain('Writeback disabled');
  });

  it('calls query writer with writeback instructions when enabled', async () => {
    writeFileSync(
      join(TMP_DIR, '.kto', 'config.json'),
      JSON.stringify({
        vault_path: '/Users/test/Vault',
        output_dir: '.kto',
        agents: { query_writer: 'query-writer-model' },
      }),
    );

    queryMock.mockImplementation(() => successStream());

    const runner = new KtoRunner({ projectDir: TMP_DIR, skipModelValidation: true });
    vi.spyOn(runner as any, 'readAgentDefinition').mockResolvedValue('mock-agent');
    const result = await runner.queryWiki('Document deployment flow', {
      writeback: true,
      targetPath: 'Projects/APP/Deployment.md',
    });

    expect(result.success).toBe(true);
    expect(result.writeback).toBe(true);
    expect(result.targetPath).toBe('Projects/APP/Deployment.md');
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0].prompt).toContain('Writeback enabled');
    expect(queryMock.mock.calls[0][0].prompt).toContain('Projects/APP/Deployment.md');
  });

  it('rejects writeback queries without an explicit target path', async () => {
    writeFileSync(
      join(TMP_DIR, '.kto', 'config.json'),
      JSON.stringify({
        vault_path: '/Users/test/Vault',
        output_dir: '.kto',
        agents: { query_writer: 'query-writer-model' },
      }),
    );

    const runner = new KtoRunner({ projectDir: TMP_DIR, skipModelValidation: true });
    vi.spyOn(runner as any, 'readAgentDefinition').mockResolvedValue('mock-agent');
    const result = await runner.queryWiki('Write this back', { writeback: true });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/targetPath/i);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('returns failure when enriched_knowledge.json violates graph contract', async () => {
    writeFileSync(
      join(TMP_DIR, '.kto', 'config.json'),
      JSON.stringify({
        vault_path: '/Users/test/Vault',
        output_dir: '.kto',
        agents: { obsidian_sync: 'inherit' },
      }),
    );
    writeFileSync(
      join(TMP_DIR, '.kto', 'enriched_knowledge.json'),
      JSON.stringify({
        ...validEnrichedGraph(),
        features: [{ ...validEnrichedGraph().features[0], description: 'unknown' }],
      }),
    );

    queryMock.mockImplementation(() => successStream());

    const runner = new KtoRunner({ projectDir: TMP_DIR });
    const result = await runner.sync();

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid enriched knowledge graph/i);
    expect(result.error).toMatch(/placeholder/i);
    expect(queryMock).not.toHaveBeenCalled();
  });
});
