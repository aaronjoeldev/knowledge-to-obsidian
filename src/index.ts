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
import { loadConfig } from './config.js';

// ─── KtoRunner ────────────────────────────────────────────────────────────────

export interface KtoRunnerOptions {
  /** Absolute path to the project to analyze. */
  projectDir: string;
  /** Override model for a specific agent. Takes precedence over config. */
  modelOverrides?: Partial<Record<string, string>>;
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
  private readonly modelOverrides: Partial<Record<string, string>>;

  constructor(options: KtoRunnerOptions) {
    this.projectDir = options.projectDir;
    this.modelOverrides = options.modelOverrides ?? {};
  }

  /** Run the full pipeline: Project Mapper → Graph Builder → Obsidian Sync. */
  async analyze(): Promise<KtoPipelineResult> {
    const config = await loadConfig(this.projectDir, { requireVault: true });

    await this.runAgent('kto-project-mapper', config.agents.project_mapper, {
      task: 'scan repository and produce knowledge.json',
      cwd: this.projectDir,
    });

    await this.runAgent('kto-graph-builder', config.agents.graph_builder, {
      task: 'build knowledge graph from knowledge.json',
      cwd: this.projectDir,
    });

    await this.runAgent('kto-obsidian-sync', config.agents.obsidian_sync, {
      task: 'sync enriched knowledge graph to obsidian vault',
      cwd: this.projectDir,
    });

    return this.buildResult();
  }

  /** Run only the Obsidian sync phase from existing enriched_knowledge.json. */
  async sync(): Promise<KtoPipelineResult> {
    const config = await loadConfig(this.projectDir, { requireVault: true });

    await this.runAgent('kto-obsidian-sync', config.agents.obsidian_sync, {
      task: 'sync enriched knowledge graph to obsidian vault',
      cwd: this.projectDir,
    });

    return this.buildResult();
  }

  /** Run the change detector for a specific set of changed files. */
  async diff(changedFiles: string[]): Promise<KtoPipelineResult> {
    const config = await loadConfig(this.projectDir, { requireVault: true });
    const fileList = changedFiles.join('\n');

    await this.runAgent('kto-change-detector', config.agents.change_detector, {
      task: `update knowledge for changed files:\n${fileList}`,
      cwd: this.projectDir,
    });

    return this.buildResult();
  }

  private async runAgent(
    agentName: string,
    defaultModel: string,
    opts: { task: string; cwd: string },
  ): Promise<void> {
    const model = this.modelOverrides[agentName] ?? defaultModel;

    const agentDefPath = new URL(`../../agents/${agentName}.md`, import.meta.url);
    let agentDef: string;
    try {
      agentDef = await readFile(agentDefPath, 'utf-8');
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
        model,
      },
    });

    for await (const msg of stream) {
      if (msg.type === 'result' && msg.subtype !== 'success') {
        throw new Error(`Agent ${agentName} failed: ${JSON.stringify((msg as { errors: unknown }).errors)}`);
      }
    }
  }

  private async buildResult(): Promise<KtoPipelineResult> {
    try {
      const enrichedPath = join(this.projectDir, '.kto', 'enriched_knowledge.json');
      const raw = await readFile(enrichedPath, 'utf-8');
      const graph = JSON.parse(raw) as { features?: unknown[]; modules?: unknown[] };
      return {
        success: true,
        filesScanned: 0,
        featuresFound: Array.isArray(graph.features) ? graph.features.length : 0,
        modulesFound: Array.isArray(graph.modules) ? graph.modules.length : 0,
        notesWritten: 0,
      };
    } catch {
      return { success: true, filesScanned: 0, featuresFound: 0, modulesFound: 0, notesWritten: 0 };
    }
  }
}
