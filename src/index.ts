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

interface ModelAvailabilityError {
  category: 'invalid_model' | 'authentication' | 'unavailable' | 'unknown';
  detail: string;
}

function isInheritModel(model: string | undefined): boolean {
  return (model ?? '').trim().toLowerCase() === 'inherit';
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
  /** Disable startup model-access checks. */
  skipModelValidation?: boolean;
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
  private readonly skipModelValidation: boolean;
  private readonly modelAvailabilityCache = new Map<string, Promise<void>>();
  private readonly resolvedModelCache = new Map<AgentName, ResolvedAgentRunContext>();

  constructor(options: KtoRunnerOptions) {
    this.projectDir = options.projectDir;
    this.modelOverrides = options.modelOverrides ?? {};
    this.skipModelValidation = options.skipModelValidation ?? false;
  }

  /** Run the full pipeline: Project Mapper → Graph Builder → Obsidian Sync. */
  async analyze(): Promise<KtoPipelineResult> {
    const config = await loadConfig(this.projectDir, { requireVault: true });
    this.resolvedModelCache.clear();
    const resolvedContexts = await this.resolveModelsForAgents(config, [
      'kto-project-mapper',
      'kto-graph-builder',
      'kto-obsidian-sync',
    ]);

    await this.runAgent(resolvedContexts['kto-project-mapper']!, {
      task: 'scan repository and produce knowledge.json',
      cwd: this.projectDir,
    });

    await this.runAgent(resolvedContexts['kto-graph-builder']!, {
      task: 'build knowledge graph from knowledge.json',
      cwd: this.projectDir,
    });

    await this.runAgent(resolvedContexts['kto-obsidian-sync']!, {
      task: 'sync enriched knowledge graph to obsidian vault',
      cwd: this.projectDir,
    });

    return this.buildResult(config);
  }

  /** Run only the Obsidian sync phase from existing enriched_knowledge.json. */
  async sync(): Promise<KtoPipelineResult> {
    const config = await loadConfig(this.projectDir, { requireVault: true });
    this.resolvedModelCache.clear();
    const resolvedContexts = await this.resolveModelsForAgents(config, ['kto-obsidian-sync']);

    await this.runAgent(resolvedContexts['kto-obsidian-sync']!, {
      task: 'sync enriched knowledge graph to obsidian vault',
      cwd: this.projectDir,
    });

    return this.buildResult(config);
  }

  /** Run the change detector for a specific set of changed files. */
  async diff(changedFiles: string[]): Promise<KtoPipelineResult> {
    const config = await loadConfig(this.projectDir, { requireVault: true });
    const fileList = changedFiles.join('\n');
    this.resolvedModelCache.clear();
    const resolvedContexts = await this.resolveModelsForAgents(config, ['kto-change-detector']);

    await this.runAgent(resolvedContexts['kto-change-detector']!, {
      task: `update knowledge for changed files:\n${fileList}`,
      cwd: this.projectDir,
    });

    return this.buildResult(config);
  }

  private async runAgent(
    runContext: ResolvedAgentRunContext,
    opts: { task: string; cwd: string },
  ): Promise<void> {
    const agentName = runContext.name;
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
        ...(isInheritModel(runContext.model) ? {} : { model: runContext.model }),
      },
    });

    for await (const msg of stream) {
      if (msg.type === 'result' && msg.subtype !== 'success') {
        throw new Error(`Agent ${agentName} failed: ${JSON.stringify((msg as { errors: unknown }).errors)}`);
      }
    }
  }

  private async resolveModelsForAgents(
    config: KtoConfig,
    agentNames: AgentName[],
  ): Promise<Partial<Record<AgentName, ResolvedAgentRunContext>>> {
    const entries = await Promise.all(agentNames.map(async (agentName) => {
      const context = await this.resolveAgentRunContext(config, agentName, this.projectDir);
      return [agentName, context] as const;
    }));

    return Object.fromEntries(entries) as Partial<Record<AgentName, ResolvedAgentRunContext>>;
  }

  private async resolveAgentRunContext(
    config: KtoConfig,
    agentName: AgentName,
    cwd: string,
  ): Promise<ResolvedAgentRunContext> {
    const cachedContext = this.resolvedModelCache.get(agentName);
    if (cachedContext !== undefined) {
      return cachedContext;
    }

    const configKey = AGENT_CONFIG_KEY_BY_NAME[agentName];
    const primaryOverride = this.modelOverrides[agentName]?.trim()
      ?? this.modelOverrides[configKey]?.trim();
    const primaryModel = primaryOverride
      ?? config.agents[configKey];
    const fallbackModel = primaryOverride === undefined
      ? config.model_fallbacks[configKey]
      : undefined;

    if (!this.skipModelValidation) {
      if (isInheritModel(primaryModel)) {
        const resolvedContext = {
          name: agentName,
          configKey,
          model: primaryModel,
        };
        this.resolvedModelCache.set(agentName, resolvedContext);
        return resolvedContext;
      }

      try {
        await this.assertModelAvailable(primaryModel, cwd);
      } catch (primaryErr) {
        const primaryAvailability = this.toModelAvailabilityError(primaryErr);
        if (
          fallbackModel !== undefined
          && fallbackModel !== primaryModel
          && !isInheritModel(fallbackModel)
          && primaryAvailability.category !== 'unknown'
        ) {
          try {
            await this.assertModelAvailable(fallbackModel, cwd);
            const resolvedContext = {
              name: agentName,
              configKey,
              model: fallbackModel,
            };
            this.resolvedModelCache.set(agentName, resolvedContext);
            return resolvedContext;
          } catch (fallbackErr) {
            throw new Error(this.formatFallbackFailure({
              agentName,
              configKey,
              primaryModel,
              primaryErr: primaryAvailability,
              fallbackModel,
              fallbackErr,
            }));
          }
        }

        if (
          fallbackModel !== undefined
          && fallbackModel !== primaryModel
          && isInheritModel(fallbackModel)
          && primaryAvailability.category !== 'unknown'
        ) {
          const resolvedContext = {
            name: agentName,
            configKey,
            model: fallbackModel,
          };
          this.resolvedModelCache.set(agentName, resolvedContext);
          return resolvedContext;
        }

        throw new Error(this.formatPrimaryFailure({
          agentName,
          configKey,
          primaryModel,
          primaryErr: primaryAvailability,
          fallbackConfigured: fallbackModel !== undefined,
        }));
      }
    }

    const resolvedContext = {
      name: agentName,
      configKey,
      model: primaryModel,
    };
    this.resolvedModelCache.set(agentName, resolvedContext);
    return resolvedContext;
  }

  private async assertModelAvailable(model: string, cwd: string): Promise<void> {
    const existing = this.modelAvailabilityCache.get(model);
    if (existing !== undefined) {
      return existing;
    }

    const validationPromise = this.probeModelAccess(model, cwd);
    this.modelAvailabilityCache.set(model, validationPromise);

    try {
      await validationPromise;
    } catch (err) {
      this.modelAvailabilityCache.delete(model);
      throw err;
    }
  }

  private async probeModelAccess(model: string, cwd: string): Promise<void> {
    const stream = query({
      prompt: 'Reply with exactly OK.',
      options: {
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        allowedTools: [],
        maxTurns: 1,
        cwd,
        model,
      },
    });

    for await (const msg of stream) {
      if (msg.type === 'result' && msg.subtype !== 'success') {
        const raw = JSON.stringify((msg as { errors?: unknown }).errors ?? msg);
        throw this.toModelAvailabilityError(raw);
      }
    }
  }

  private toModelAvailabilityError(input: unknown): ModelAvailabilityError {
    const detail = this.stringifyAvailabilityInput(input);
    const normalized = detail.toLowerCase();

    if (
      normalized.includes('invalid api key')
      || normalized.includes('authentication_failed')
      || normalized.includes('please run /login')
      || normalized.includes('auth token')
      || normalized.includes('api key')
    ) {
      return { category: 'authentication', detail };
    }

    if (
      normalized.includes('invalid model')
      || normalized.includes('invalid-model')
      || normalized.includes('model identifier is invalid')
      || normalized.includes('model not found')
      || normalized.includes('not_found_error')
    ) {
      return { category: 'invalid_model', detail };
    }

    if (
      normalized.includes('403')
      || normalized.includes('forbidden')
      || normalized.includes('not been granted access')
      || normalized.includes('unavailable')
      || normalized.includes('unsupported region')
      || normalized.includes('provider')
    ) {
      return { category: 'unavailable', detail };
    }

    return { category: 'unknown', detail };
  }

  private stringifyAvailabilityInput(input: unknown): string {
    if (input instanceof Error) {
      return input.message;
    }

    if (typeof input === 'string') {
      return input;
    }

    try {
      return JSON.stringify(input);
    } catch {
      return String(input);
    }
  }

  private formatPrimaryFailure(args: {
    agentName: AgentName;
    configKey: AgentConfigKey;
    primaryModel: string;
    primaryErr: unknown;
    fallbackConfigured: boolean;
  }): string {
    const classified = this.toModelAvailabilityError(args.primaryErr);
    const fix = args.fallbackConfigured
      ? `Fix .kto/config.json -> agents.${args.configKey} or remove/update model_fallbacks.${args.configKey}.`
      : `Fix .kto/config.json -> agents.${args.configKey} or add model_fallbacks.${args.configKey}.`;

    return [
      `Configured model "${args.primaryModel}" for agent "${args.agentName}" is unavailable (${this.describeAvailabilityCategory(classified.category)}).`,
      `Detail: ${classified.detail}`,
      fix,
    ].join(' ');
  }

  private formatFallbackFailure(args: {
    agentName: AgentName;
    configKey: AgentConfigKey;
    primaryModel: string;
    primaryErr: unknown;
    fallbackModel: string;
    fallbackErr: unknown;
  }): string {
    const primary = this.toModelAvailabilityError(args.primaryErr);
    const fallback = this.toModelAvailabilityError(args.fallbackErr);

    return [
      `Configured model "${args.primaryModel}" for agent "${args.agentName}" is unavailable (${this.describeAvailabilityCategory(primary.category)}).`,
      `Fallback model "${args.fallbackModel}" also failed (${this.describeAvailabilityCategory(fallback.category)}).`,
      `Primary detail: ${primary.detail}`,
      `Fallback detail: ${fallback.detail}`,
      `Fix .kto/config.json -> agents.${args.configKey} / model_fallbacks.${args.configKey}.`,
    ].join(' ');
  }

  private describeAvailabilityCategory(category: ModelAvailabilityError['category']): string {
    switch (category) {
      case 'authentication':
        return 'authentication failed';
      case 'invalid_model':
        return 'invalid or unavailable model ID';
      case 'unavailable':
        return 'provider or account access unavailable';
      default:
        return 'unknown runtime error';
    }
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
