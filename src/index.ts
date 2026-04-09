// src/index.ts
/**
 * kto — Knowledge to Obsidian
 * Programmatic API for orchestrating the kto pipeline via Claude Agent SDK.
 */

export type { KnowledgeGraph, EnrichedKnowledgeGraph, RawKnowledge } from './types.js';
export type { KtoConfig, KtoAgentsConfig } from './config.js';
export { loadConfig, CONFIG_DEFAULTS } from './config.js';
export {
  validateKnowledgeGraph,
  validateRawKnowledge,
  isValidEntityId,
} from './knowledge-validator.js';

import { query } from '@anthropic-ai/claude-agent-sdk';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig, type KtoAgentsConfig, type KtoConfig } from './config.js';

type AgentConfigKey = keyof KtoAgentsConfig;

const AGENT_CONFIG_KEY_BY_NAME = {
  'kto-project-mapper': 'project_mapper',
  'kto-graph-builder': 'graph_builder',
  'kto-obsidian-sync': 'obsidian_sync',
  'kto-change-detector': 'change_detector',
} as const satisfies Record<string, AgentConfigKey>;

type AgentName = keyof typeof AGENT_CONFIG_KEY_BY_NAME;
type ModelOverrideKey = AgentName | AgentConfigKey;

interface ResolvedAgentRunContext {
  name: AgentName;
  configKey: AgentConfigKey;
  model: string;
}

interface ResolvedPaths {
  outputDir: string;
  enrichedKnowledgePath: string;
}

// ─── KtoRunner ────────────────────────────────────────────────────────────────

export interface KtoRunnerOptions {
  /** Absolute path to the project to analyze. */
  projectDir: string;
  /** Override model for a specific agent. Takes precedence over config. */
  modelOverrides?: Partial<Record<ModelOverrideKey, string>>;
}

export interface KtoPipelineResult {
  success: boolean;
  filesScanned: number;
  featuresFound: number;
  modulesFound: number;
  notesWritten: number;
  error?: string;
}

/**
 * Orchestrates the full kto pipeline programmatically.
 */
export class KtoRunner {
  private readonly projectDir: string;
  private readonly modelOverrides: Partial<Record<ModelOverrideKey, string>>;

  constructor(options: KtoRunnerOptions) {
    this.projectDir = options.projectDir;
    this.modelOverrides = options.modelOverrides ?? {};
  }

  /** Run the full pipeline: Project Mapper → Graph Builder → Obsidian Sync. */
  async analyze(): Promise<KtoPipelineResult> {
    const config = await loadConfig(this.projectDir, { requireVault: true });

    await this.runAgent(config, 'kto-project-mapper', {
      task: 'scan repository and produce knowledge.json',
      cwd: this.projectDir,
    });

    await this.runAgent(config, 'kto-graph-builder', {
      task: 'build knowledge graph from knowledge.json',
      cwd: this.projectDir,
    });

    await this.runAgent(config, 'kto-obsidian-sync', {
      task: 'sync enriched knowledge graph to obsidian vault',
      cwd: this.projectDir,
    });

    return this.buildResult(config);
  }

  /** Run only the Obsidian sync phase from existing enriched_knowledge.json. */
  async sync(): Promise<KtoPipelineResult> {
    const config = await loadConfig(this.projectDir, { requireVault: true });

    await this.runAgent(config, 'kto-obsidian-sync', {
      task: 'sync enriched knowledge graph to obsidian vault',
      cwd: this.projectDir,
    });

    return this.buildResult(config);
  }

  /** Run the change detector for a specific set of changed files. */
  async diff(changedFiles: string[]): Promise<KtoPipelineResult> {
    const config = await loadConfig(this.projectDir, { requireVault: true });
    const fileList = changedFiles.join('\n');

    await this.runAgent(config, 'kto-change-detector', {
      task: `update knowledge for changed files:\n${fileList}`,
      cwd: this.projectDir,
    });

    return this.buildResult(config);
  }

  private async runAgent(
    config: KtoConfig,
    agentName: AgentName,
    opts: { task: string; cwd: string },
  ): Promise<void> {
    const runContext = this.resolveAgentRunContext(config, agentName);
    let agentDef: string;
    try {
      agentDef = await this.readAgentDefinition(agentName);
    } catch {
      throw new Error(`Agent definition not found: ${agentName}.md`);
    }

    const stream = query({
      prompt: opts.task,
      options: {
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append: agentDef,
        },
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
        maxTurns: 50,
        cwd: opts.cwd,
        model: runContext.model,
      },
    });

    for await (const msg of stream) {
      if (msg.type === 'result' && msg.subtype !== 'success') {
        throw new Error(`Agent ${agentName} failed: ${JSON.stringify((msg as { errors: unknown }).errors)}`);
      }
    }
  }

  private resolveAgentRunContext(config: KtoConfig, agentName: AgentName): ResolvedAgentRunContext {
    const configKey = AGENT_CONFIG_KEY_BY_NAME[agentName];
    const model = this.modelOverrides[agentName]
      ?? this.modelOverrides[configKey]
      ?? config.agents[configKey];

    return {
      name: agentName,
      configKey,
      model,
    };
  }

  private async readAgentDefinition(agentName: AgentName): Promise<string> {
    const candidatePaths = [
      new URL(`../agents/${agentName}.md`, import.meta.url),
      new URL(`../../agents/${agentName}.md`, import.meta.url),
    ];

    for (const path of candidatePaths) {
      try {
        return await readFile(path, 'utf-8');
      } catch {
        // try next candidate path
      }
    }

    throw new Error(`Agent definition not found: ${agentName}.md`);
  }

  private resolvePaths(config: KtoConfig): ResolvedPaths {
    const outputDir = join(this.projectDir, config.output_dir);
    return {
      outputDir,
      enrichedKnowledgePath: join(outputDir, 'enriched_knowledge.json'),
    };
  }

  private async buildResult(config: KtoConfig): Promise<KtoPipelineResult> {
    const paths = this.resolvePaths(config);

    try {
      const raw = await readFile(paths.enrichedKnowledgePath, 'utf-8');
      const graph = JSON.parse(raw) as { features?: unknown[]; modules?: unknown[] };

      if (!Array.isArray(graph.features) || !Array.isArray(graph.modules)) {
        return {
          success: false,
          filesScanned: 0,
          featuresFound: 0,
          modulesFound: 0,
          notesWritten: 0,
          error: `Invalid enriched knowledge format at ${paths.enrichedKnowledgePath}: expected features/modules arrays`,
        };
      }

      return {
        success: true,
        filesScanned: 0,
        featuresFound: graph.features.length,
        modulesFound: graph.modules.length,
        notesWritten: 0,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        filesScanned: 0,
        featuresFound: 0,
        modulesFound: 0,
        notesWritten: 0,
        error: `Failed to build pipeline result from ${paths.enrichedKnowledgePath}: ${msg}`,
      };
    }
  }
}
