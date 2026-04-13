// src/index.ts
/**
 * kto — Knowledge to Obsidian
 * Programmatic API for orchestrating the kto pipeline via Claude Agent SDK.
 */

export type {
  KnowledgeGraph,
  EnrichedKnowledgeGraph,
  RawKnowledge,
} from './types.js';
export type { KtoConfig, KtoAgentsConfig, KtoProvider } from './config.js';
export {
  loadConfig,
  CONFIG_DEFAULTS,
} from './config.js';
export {
  validateKnowledgeGraph,
  validateEnrichedKnowledgeGraph,
  validateRawKnowledge,
  isValidEntityId,
} from './knowledge-validator.js';

import { query } from '@anthropic-ai/claude-agent-sdk';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig, type KtoAgentsConfig, type KtoConfig } from './config.js';
import { validateEnrichedKnowledgeGraph, validateKnowledgeGraph, validateRawKnowledge } from './knowledge-validator.js';
import type { EnrichedKnowledgeGraph, KnowledgeGraph, KnowledgeStalenessStatus, RawKnowledge } from './types.js';

type AgentConfigKey = keyof KtoAgentsConfig;

const AGENT_CONFIG_KEY_BY_NAME = {
  'kto-project-mapper': 'project_mapper',
  'kto-graph-builder': 'graph_builder',
  'kto-obsidian-sync': 'obsidian_sync',
  'kto-change-detector': 'change_detector',
  'kto-wiki-lint': 'wiki_lint',
  'kto-query-writer': 'query_writer',
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
  knowledgePath: string;
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

export interface KtoQueryResult {
  success: boolean;
  writeback: boolean;
  targetPath?: string;
  error?: string;
}

export type KtoRecommendedAction = 'init' | 'analyze' | 'sync' | 'lint' | 'none';

export interface KtoArtifactStatus {
  path: string;
  exists: boolean;
  valid: boolean | null;
  generatedAt?: string;
  errors: string[];
  warnings: string[];
}

export interface KtoStatusResult {
  success: boolean;
  config: {
    path: string;
    exists: boolean;
    valid: boolean;
    errors: string[];
  };
  outputDir?: string;
  knowledge: KtoArtifactStatus;
  enrichedKnowledge: KtoArtifactStatus & {
    counts?: {
      features: number;
      modules: number;
      thirdParties: number;
    };
  };
  freshness: {
    enrichedFromKnowledge: KnowledgeStalenessStatus;
    wikiFromEnriched: KnowledgeStalenessStatus;
  };
  recommendedAction: KtoRecommendedAction;
  error?: string;
}

type InternalEnrichedArtifactStatus = KtoStatusResult['enrichedKnowledge'] & {
  metaWikiFreshness?: KnowledgeStalenessStatus;
};

// ─── Token Tracking ──────────────────────────────────────────────────────────

export interface AgentUsage {
  inputTokens: number;
  output_tokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  totalTokens: number;
}

export interface AgentRunMetrics {
  agent: string;
  model: string;
  usage: AgentUsage;
  durationMs: number;
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

  /** Run the full wiki pipeline: Mapper → Graph → Wiki Sync. */
  async analyze(): Promise<KtoPipelineResult> {
    const config = await loadConfig(this.projectDir, { requireVault: true });
    this.resolvedModelCache.clear();
    const resolvedContexts = await this.resolveModelsForAgents(config, [
      'kto-project-mapper',
      'kto-graph-builder',
      'kto-obsidian-sync',
    ]);

    await this.runAgent(resolvedContexts['kto-project-mapper']!, {
      task: 'scan repository and produce wiki knowledge.json',
      cwd: this.projectDir,
    });

    await this.runAgent(resolvedContexts['kto-graph-builder']!, {
      task: 'build wiki knowledge graph from knowledge.json',
      cwd: this.projectDir,
    });

    try {
      await this.assertEnrichedKnowledgeGraphValid(config);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        filesScanned: 0,
        featuresFound: 0,
        modulesFound: 0,
        notesWritten: 0,
        error: msg,
      };
    }

    await this.runAgent(resolvedContexts['kto-obsidian-sync']!, {
      task: 'sync enriched wiki knowledge graph to obsidian vault',
      cwd: this.projectDir,
    });

    return this.buildResult(config);
  }

  /** Run only the wiki sync phase from existing enriched_knowledge.json. */
  async sync(): Promise<KtoPipelineResult> {
    const config = await loadConfig(this.projectDir, { requireVault: true });
    this.resolvedModelCache.clear();
    const resolvedContexts = await this.resolveModelsForAgents(config, ['kto-obsidian-sync']);

    try {
      await this.assertEnrichedKnowledgeGraphValid(config);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        filesScanned: 0,
        featuresFound: 0,
        modulesFound: 0,
        notesWritten: 0,
        error: msg,
      };
    }

    await this.runAgent(resolvedContexts['kto-obsidian-sync']!, {
      task: 'sync enriched wiki knowledge graph to obsidian vault',
      cwd: this.projectDir,
    });

    return this.buildResult(config);
  }

  /** Run wiki change detection for a specific set of changed files. */
  async diff(changedFiles: string[]): Promise<KtoPipelineResult> {
    const config = await loadConfig(this.projectDir, { requireVault: true });
    const fileList = changedFiles.join('\n');
    this.resolvedModelCache.clear();
    const resolvedContexts = await this.resolveModelsForAgents(config, ['kto-change-detector']);

    await this.runAgent(resolvedContexts['kto-change-detector']!, {
      task: `update wiki knowledge for changed files:\n${fileList}`,
      cwd: this.projectDir,
    });

    return this.buildResult(config);
  }

  /** Run wiki lint checks for the generated knowledge artifacts. */
  async lint(): Promise<KtoPipelineResult> {
    const config = await loadConfig(this.projectDir, { requireVault: true });
    this.resolvedModelCache.clear();
    const resolvedContexts = await this.resolveModelsForAgents(config, ['kto-wiki-lint']);

    await this.runAgent(resolvedContexts['kto-wiki-lint']!, {
      task: 'lint wiki knowledge artifacts and report issues',
      cwd: this.projectDir,
    });

    return this.buildResult(config);
  }

  /** Query the wiki knowledge and optionally request writeback. */
  async queryWiki(
    question: string,
    options: { writeback?: boolean; targetPath?: string } = {},
  ): Promise<KtoQueryResult> {
    const config = await loadConfig(this.projectDir, { requireVault: true });
    this.resolvedModelCache.clear();
    const resolvedContexts = await this.resolveModelsForAgents(config, ['kto-query-writer']);

    const trimmedQuestion = question.trim();
    if (trimmedQuestion === '') {
      return {
        success: false,
        writeback: options.writeback === true,
        ...(options.targetPath === undefined ? {} : { targetPath: options.targetPath }),
        error: 'Question must be a non-empty string',
      };
    }

    const writebackRequested = options.writeback === true;
    const trimmedTargetPath = options.targetPath?.trim();
    if (writebackRequested && (trimmedTargetPath === undefined || trimmedTargetPath === '')) {
      return {
        success: false,
        writeback: true,
        error: 'targetPath is required when writeback is enabled',
      };
    }

    const writebackInstruction = writebackRequested
      ? `Writeback enabled. Apply changes to ${trimmedTargetPath}.`
      : 'Writeback disabled. Do not modify files; provide a read-only answer.';

    await this.runAgent(resolvedContexts['kto-query-writer']!, {
      task: `Answer this wiki question:\n${trimmedQuestion}\n\n${writebackInstruction}`,
      cwd: this.projectDir,
    });

    return {
      success: true,
      writeback: writebackRequested,
      ...(trimmedTargetPath === undefined ? {} : { targetPath: trimmedTargetPath }),
    };
  }

  async status(): Promise<KtoStatusResult> {
    const configPath = join(this.projectDir, '.kto', 'config.json');
    const configStatus = await this.inspectConfig(configPath);

    if (!configStatus.exists || !configStatus.valid || configStatus.config === undefined) {
      return {
        success: false,
        config: {
          path: configPath,
          exists: configStatus.exists,
          valid: configStatus.valid,
          errors: configStatus.errors,
        },
        knowledge: {
          path: join(this.projectDir, '.kto', 'knowledge.json'),
          exists: false,
          valid: null,
          errors: [],
          warnings: [],
        },
        enrichedKnowledge: {
          path: join(this.projectDir, '.kto', 'enriched_knowledge.json'),
          exists: false,
          valid: null,
          errors: [],
          warnings: [],
        },
        freshness: {
          enrichedFromKnowledge: 'unknown',
          wikiFromEnriched: 'unknown',
        },
        recommendedAction: 'init',
        error: configStatus.errors[0] ?? 'kto is not initialized. Run /kto:init first.',
      };
    }

    const paths = this.resolvePaths(configStatus.config);
    const knowledge = await this.inspectRawKnowledge(paths.knowledgePath);
    const enrichedKnowledge = await this.inspectEnrichedKnowledge(paths.enrichedKnowledgePath);
    const freshness = this.deriveFreshness(knowledge, enrichedKnowledge);
    const recommendedAction = this.deriveRecommendedAction(configStatus.valid, knowledge, enrichedKnowledge, freshness.wikiFromEnriched);

    return {
      success: configStatus.valid && (enrichedKnowledge.valid ?? false),
      config: {
        path: configPath,
        exists: configStatus.exists,
        valid: configStatus.valid,
        errors: configStatus.errors,
      },
      outputDir: configStatus.config.output_dir,
      knowledge,
      enrichedKnowledge: {
        path: enrichedKnowledge.path,
        exists: enrichedKnowledge.exists,
        valid: enrichedKnowledge.valid,
        errors: enrichedKnowledge.errors,
        warnings: enrichedKnowledge.warnings,
        ...(enrichedKnowledge.generatedAt === undefined ? {} : { generatedAt: enrichedKnowledge.generatedAt }),
        ...(enrichedKnowledge.counts === undefined ? {} : { counts: enrichedKnowledge.counts }),
      },
      freshness,
      recommendedAction,
      ...(enrichedKnowledge.valid === false ? { error: enrichedKnowledge.errors[0] } : {}),
    };
  }

  private async runAgent(
    runContext: ResolvedAgentRunContext,
    opts: { task: string; cwd: string },
  ): Promise<AgentRunMetrics> {
    const agentName = runContext.name;
    let agentDef: string;
    try {
      agentDef = await this.readAgentDefinition(agentName);
    } catch {
      throw new Error(`Agent definition not found: ${agentName}.md`);
    }

    const startTime = Date.now();
    let totalUsage: AgentUsage | undefined;

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
      if (msg.type === 'result') {
        if (msg.subtype !== 'success') {
          throw new Error(`Agent ${agentName} failed: ${JSON.stringify((msg as { errors: unknown }).errors)}`);
        }
        // Capture usage from final result
        const resultMsg = msg as unknown as {
          usage?: {
            input_tokens?: number;
            output_tokens?: number;
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
          };
          total_cost_usd?: number;
        };
        if (resultMsg.usage) {
          totalUsage = {
            inputTokens: resultMsg.usage.input_tokens ?? 0,
            output_tokens: resultMsg.usage.output_tokens ?? 0,
            cacheCreationInputTokens: resultMsg.usage.cache_creation_input_tokens ?? 0,
            cacheReadInputTokens: resultMsg.usage.cache_read_input_tokens ?? 0,
            totalTokens:
              (resultMsg.usage.input_tokens ?? 0) +
              (resultMsg.usage.output_tokens ?? 0),
          };
        }
      }
    }

    const durationMs = Date.now() - startTime;

    const metrics: AgentRunMetrics = {
      agent: agentName,
      model: runContext.model,
      usage: totalUsage ?? {
        inputTokens: 0,
        output_tokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
        totalTokens: 0,
      },
      durationMs,
    };

    this.logAgentMetrics(metrics);

    return metrics;
  }

  private logAgentMetrics(metrics: AgentRunMetrics): void {
    const u = metrics.usage;
    const total = u.totalTokens.toLocaleString();

    const lines = [
      '',
      `┌─ ${metrics.agent} (${metrics.model}) ─────────`,
      `│ input: ${u.inputTokens.toLocaleString()} tokens`,
      `│ output: ${u.output_tokens.toLocaleString()} tokens`,
      `│ cache read: ${u.cacheReadInputTokens.toLocaleString()}`,
      `│ cache create: ${u.cacheCreationInputTokens.toLocaleString()}`,
      `│ total: ${total} tokens`,
      `│ duration: ${metrics.durationMs}ms`,
      `└─────────────────────────────`,
    ];

    for (const line of lines) {
      process.stdout.write(line + '\n');
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
      knowledgePath: join(outputDir, 'knowledge.json'),
      enrichedKnowledgePath: join(outputDir, 'enriched_knowledge.json'),
    };
  }

  private async loadEnrichedKnowledgeGraph(config: KtoConfig): Promise<{ path: string; graph: EnrichedKnowledgeGraph }> {
    const paths = this.resolvePaths(config);
    const raw = await readFile(paths.enrichedKnowledgePath, 'utf-8');
    return {
      path: paths.enrichedKnowledgePath,
      graph: JSON.parse(raw) as EnrichedKnowledgeGraph,
    };
  }

  private async assertEnrichedKnowledgeGraphValid(config: KtoConfig): Promise<void> {
    const { path, graph } = await this.loadEnrichedKnowledgeGraph(config);
    const validation = validateEnrichedKnowledgeGraph(graph);

    if (!validation.valid) {
      throw new Error(`Invalid enriched knowledge graph at ${path}: ${validation.errors.join('; ')}`);
    }
  }

  private async buildResult(config: KtoConfig): Promise<KtoPipelineResult> {
    try {
      const { path, graph } = await this.loadEnrichedKnowledgeGraph(config);

      const validation = validateEnrichedKnowledgeGraph(graph);
      if (!validation.valid) {
        return {
          success: false,
          filesScanned: 0,
          featuresFound: 0,
          modulesFound: 0,
          notesWritten: 0,
          error: `Invalid enriched knowledge graph at ${path}: ${validation.errors.join('; ')}`,
        };
      }

      if (!Array.isArray(graph.features) || !Array.isArray(graph.modules)) {
        return {
          success: false,
          filesScanned: 0,
          featuresFound: 0,
          modulesFound: 0,
          notesWritten: 0,
          error: `Invalid enriched knowledge format at ${path}: expected features/modules arrays`,
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
      const paths = this.resolvePaths(config);
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

  private async inspectConfig(configPath: string): Promise<{
    exists: boolean;
    valid: boolean;
    config?: KtoConfig;
    errors: string[];
  }> {
    try {
      await readFile(configPath, 'utf-8');
    } catch {
      return { exists: false, valid: false, errors: ['.kto/config.json not found'] };
    }

    try {
      const config = await loadConfig(this.projectDir, { requireVault: false });
      return { exists: true, valid: true, config, errors: [] };
    } catch (err) {
      return {
        exists: true,
        valid: false,
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  private async inspectRawKnowledge(path: string): Promise<KtoArtifactStatus> {
    try {
      const raw = JSON.parse(await readFile(path, 'utf-8')) as RawKnowledge;
      const validation = validateRawKnowledge(raw);
      return {
        path,
        exists: true,
        valid: validation.valid,
        generatedAt: raw.scanned_at,
        errors: validation.errors,
        warnings: validation.warnings,
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return { path, exists: false, valid: null, errors: [], warnings: [] };
      }
      return {
        path,
        exists: true,
        valid: false,
        errors: [err instanceof Error ? err.message : String(err)],
        warnings: [],
      };
    }
  }

  private async inspectEnrichedKnowledge(path: string): Promise<InternalEnrichedArtifactStatus> {
    try {
      const graph = JSON.parse(await readFile(path, 'utf-8')) as EnrichedKnowledgeGraph;
      const validation = validateEnrichedKnowledgeGraph(graph);
      return {
        path,
        exists: true,
        valid: validation.valid,
        generatedAt: graph.enriched_at,
        errors: validation.errors,
        warnings: validation.warnings,
        ...(graph.meta?.staleness?.wiki_from_enriched?.status === undefined
          ? {}
          : { metaWikiFreshness: graph.meta.staleness.wiki_from_enriched.status }),
        ...(Array.isArray(graph.features) && Array.isArray(graph.modules) && Array.isArray(graph.third_parties)
          ? {
              counts: {
                features: graph.features.length,
                modules: graph.modules.length,
                thirdParties: graph.third_parties.length,
              },
            }
          : {}),
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return { path, exists: false, valid: null, errors: [], warnings: [] };
      }
      return {
        path,
        exists: true,
        valid: false,
        errors: [err instanceof Error ? err.message : String(err)],
        warnings: [],
      };
    }
  }

  private deriveFreshness(
    knowledge: KtoArtifactStatus,
    enriched: InternalEnrichedArtifactStatus,
  ): KtoStatusResult['freshness'] {
    let enrichedFromKnowledge: KnowledgeStalenessStatus = 'unknown';
    if (knowledge.generatedAt !== undefined && enriched.generatedAt !== undefined) {
      enrichedFromKnowledge = Date.parse(enriched.generatedAt) >= Date.parse(knowledge.generatedAt) ? 'fresh' : 'stale';
    }

    const wikiFromEnriched = enriched.metaWikiFreshness ?? 'unknown';

    return { enrichedFromKnowledge, wikiFromEnriched };
  }

  private deriveRecommendedAction(
    configValid: boolean,
    knowledge: KtoArtifactStatus,
    enriched: KtoStatusResult['enrichedKnowledge'],
    wikiFromEnriched: KnowledgeStalenessStatus,
  ): KtoRecommendedAction {
    if (!configValid) return 'init';
    if (!enriched.exists || enriched.valid !== true) return 'analyze';
    if (wikiFromEnriched === 'stale') return 'sync';
    if (knowledge.valid === false || enriched.warnings.length > 0) return 'lint';
    return 'none';
  }
}
