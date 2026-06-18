#!/usr/bin/env node

/**
 * Fricless CLI — 终端入口
 *
 * 用法:
 *   fricless              → 交互式终端对话模式（类似 claude 命令）
 *   fricless gateway      → 飞书网关服务模式（后台运行）
 *   fricless --help       → 显示帮助
 *   fricless --version    → 显示版本
 */

import pino from 'pino';
import path from 'node:path';
import fs from 'node:fs';
import * as readline from 'node:readline';
import os from 'node:os';
import { loadConfig } from './config.js';
import { AnthropicProvider } from './providers/AnthropicProvider.js';
import { OpenAIProvider } from './providers/OpenAIProvider.js';
import { TerminalRenderer } from './render/terminal/TerminalRenderer.js';
import { Harness } from './harness/Harness.js';
import { TokenCounter } from './harness/TokenCounter.js';
import { Session } from './session/Session.js';
import { InMemorySessionStore } from './session/InMemorySessionStore.js';
import { SQLiteSessionStore } from './session/SQLiteSessionStore.js';
import { MetricsCollector } from './server/MetricsCollector.js';
import { builtinTools } from './harness/tools/index.js';
import { pingCommand } from './harness/commands/ping.js';
import { helpCommand } from './harness/commands/help.js';
import { clearCommand } from './harness/commands/clear.js';
import { createAdvisorCommand } from './harness/commands/advisor.js';
import { createBranchCommand } from './harness/commands/branch.js';
import { createBridgeCommand } from './harness/commands/bridge.js';
import { createBriefCommand } from './harness/commands/brief.js';
import { createChromeCommand } from './harness/commands/chrome.js';
import { createColorCommand } from './harness/commands/color.js';
import { createCompactCommand } from './harness/commands/compact.js';
import { createConfigCommand } from './harness/commands/config.js';
import { createContextCommand } from './harness/commands/context.js';
import { createCopyCommand } from './harness/commands/copy.js';
import { createCostCommand } from './harness/commands/cost.js';
import { createCtxVizCommand } from './harness/commands/ctx_viz.js';
import { createDebugCommand } from './harness/commands/debug.js';
import { createDesktopCommand } from './harness/commands/desktop.js';
import { createDiffCommand } from './harness/commands/diff.js';
import { createDoctorCommand } from './harness/commands/doctor.js';
import { createEffortCommand } from './harness/commands/effort.js';
import { createEnvCommand } from './harness/commands/env.js';
import { createExitCommand } from './harness/commands/exit.js';
import { createExportCommand } from './harness/commands/export.js';
import { createExtraUsageCommand } from './harness/commands/extra_usage.js';
import { createFastCommand } from './harness/commands/fast.js';
import { createFeedbackCommand } from './harness/commands/feedback.js';
import { createFilesCommand } from './harness/commands/files.js';
import { createGoodClaudeCommand } from './harness/commands/good_claude.js';
import { createHistoryCommand } from './harness/commands/history.js';
import { createHooksCommand } from './harness/commands/hooks.js';
import { createIdeCommand } from './harness/commands/ide.js';
import { createInitCommand } from './harness/commands/init.js';
import { createInsightsCommand } from './harness/commands/insights.js';
import { createIssueCommand } from './harness/commands/issue.js';
import { createKeybindingsCommand } from './harness/commands/keybindings.js';
import { createLoadCommand } from './harness/commands/load.js';
import { createLoginCommand } from './harness/commands/login.js';
import { createLogoutCommand } from './harness/commands/logout.js';
import { createMemoryCommands } from './harness/commands/memory_cmd.js';
import { createMobileCommand } from './harness/commands/mobile.js';
import { createMockLimitsCommand } from './harness/commands/mock_limits.js';
import { createModeCommand } from './harness/commands/mode.js';
import { createModelCommand } from './harness/commands/model.js';
import { createNotebookCommand } from './harness/commands/notebook.js';
import { createOauthRefreshCommand } from './harness/commands/oauth_refresh.js';
import { createOnboardingCommand } from './harness/commands/onboarding.js';
import { createOutputStyleCommand } from './harness/commands/output_style.js';
import { createPassesCommand } from './harness/commands/passes.js';
import { createPerfIssueCommand } from './harness/commands/perf_issue.js';
import { createPermissionsCommand } from './harness/commands/permissions.js';
import { createPlanCommand } from './harness/commands/plan.js';
import { createPluginCommand } from './harness/commands/plugin.js';
import { createPluginsCommand } from './harness/commands/plugins.js';
import { createPrCommentsCommand } from './harness/commands/pr_comments.js';
import { createPrivacySettingsCommand } from './harness/commands/privacy_settings.js';
import { createRateLimitOptionsCommand } from './harness/commands/rate_limit_options.js';
import { createReleaseNotesCommand } from './harness/commands/release_notes.js';
import { createReloadPluginsCommand } from './harness/commands/reload_plugins.js';
import { createRemoteEnvCommand } from './harness/commands/remote_env.js';
import { createRemoteSetupCommand } from './harness/commands/remote_setup.js';
import { createRenameCommand } from './harness/commands/rename.js';
import { createResetLimitsCommand } from './harness/commands/reset_limits.js';
import { createResumeCommand } from './harness/commands/resume.js';
import { createRetryCommand } from './harness/commands/retry.js';
import { createReviewCommand } from './harness/commands/review.js';
import { createRewindCommand } from './harness/commands/rewind.js';
import { createSandboxToggleCommand } from './harness/commands/sandbox_toggle.js';
import { createSaveCommand } from './harness/commands/save.js';
import { createSearchCommand } from './harness/commands/search.js';
import { createSecurityReviewCommand } from './harness/commands/security_review.js';
import { createSessionCommands } from './harness/commands/session_cmd.js';
import { createShareCommand } from './harness/commands/share.js';
import { createSkillsCommand } from './harness/commands/skills.js';
import { createStatsCommand } from './harness/commands/stats.js';
import { createStatusCommand } from './harness/commands/status.js';
import { createStickersCommand } from './harness/commands/stickers.js';
import { createSummaryCommand } from './harness/commands/summary.js';
import { createSystemCommand } from './harness/commands/system.js';
import { createTagCommand } from './harness/commands/tag.js';
import { createTaskCommand } from './harness/commands/task.js';
import { createTeleportCommand } from './harness/commands/teleport.js';
import { createTerminalSetupCommand } from './harness/commands/terminal_setup.js';
import { createThinkbackCommand } from './harness/commands/thinkback.js';
import { createTokenCommand } from './harness/commands/token.js';
import { createToolsCommand } from './harness/commands/tools.js';
import { createUpgradeCommand } from './harness/commands/upgrade.js';
import { createUsageCommand } from './harness/commands/usage.js';
import { createVersionCommand } from './harness/commands/version.js';
import { createVimCommand } from './harness/commands/vim.js';
import { createVoiceCommand } from './harness/commands/voice.js';
import { Gateway } from './gateway/Gateway.js';
import { FeishuChannel } from './channels/feishu/FeishuChannel.js';
import { PluginManager } from './plugins/PluginManager.js';
import { startServer } from './server/index.js';
import { BridgeServer } from './bridge/BridgeServer.js';
import { MemoryStore } from './memory/MemoryStore.js';
import { MemoryExtractor } from './memory/MemoryExtractor.js';
import { MemoryInjector } from './memory/MemoryInjector.js';
import type { AnyTool } from './harness/Tool.js';
import type { CommandDef } from './harness/Command.js';
import type { ISessionStore } from './session/ISessionStore.js';
import type { ChannelStatus } from './channels/types.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', name: 'fricless' });

const VERSION = '0.2.0';

// ── CLI 参数解析 ──────────────────────────────────────────

function showHelp(): void {
  console.log(`
Fricless — AI 机器人网关 (v${VERSION})

用法:
  fricless                 启动交互式终端对话
  fricless gateway         启动飞书网关服务
  fricless gateway --daemon 以守护进程模式启动
  fricless --help          显示此帮助
  fricless --version       显示版本

命令:
  无参数    交互式终端 CLI（类似 claude 命令）
  gateway   飞书 Bot 网关服务模式

环境变量:
  参见 .env.example 文件
`);
}

function showVersion(): void {
  console.log(`fricless v${VERSION}`);
}

// ── 交互式终端模式（类似 claude） ─────────────────────────

/**
 * 支持的 AI 模型提供商列表
 */
interface ProviderOption {
  id: string;
  name: string;
  keyEnvVar: string;
  modelEnvVar: string;
  defaultModel: string;
  keyHint: string;
  keyPrefix: string;
  baseUrlEnvVar?: string;
  defaultBaseUrl?: string;
}

const PROVIDERS: ProviderOption[] = [
  { id: 'anthropic',    name: 'Anthropic Claude',   keyEnvVar: 'ANTHROPIC_API_KEY',  modelEnvVar: 'ANTHROPIC_MODEL',  defaultModel: 'claude-sonnet-4-6',   keyHint: '', keyPrefix: 'sk-ant-' },
  { id: 'openai',       name: 'OpenAI',              keyEnvVar: 'OPENAI_API_KEY',     modelEnvVar: 'OPENAI_MODEL',    defaultModel: 'gpt-4o',              keyHint: '', keyPrefix: 'sk-' },
  { id: 'deepseek',     name: 'DeepSeek',            keyEnvVar: 'DEEPSEEK_API_KEY',   modelEnvVar: 'DEEPSEEK_MODEL',  defaultModel: 'deepseek-chat',       keyHint: '', keyPrefix: 'sk-',  baseUrlEnvVar: 'DEEPSEEK_BASE_URL', defaultBaseUrl: 'https://api.deepseek.com/v1' },
  { id: 'qwen',         name: 'Qwen',                keyEnvVar: 'QWEN_API_KEY',       modelEnvVar: 'QWEN_MODEL',      defaultModel: 'qwen-plus',           keyHint: '', keyPrefix: 'sk-' },
  { id: 'kimi',         name: 'Kimi',                keyEnvVar: 'MOONSHOT_API_KEY',   modelEnvVar: 'MOONSHOT_MODEL',  defaultModel: 'moonshot-v1-8k',      keyHint: '', keyPrefix: 'sk-' },
  { id: 'minimax',      name: 'MiniMax',             keyEnvVar: 'MINIMAX_API_KEY',    modelEnvVar: 'MINIMAX_MODEL',   defaultModel: 'minimax-text-01',     keyHint: '', keyPrefix: 'sk-' },
  { id: 'openrouter',   name: 'OpenRouter',          keyEnvVar: 'OPENROUTER_API_KEY', modelEnvVar: 'OPENROUTER_MODEL', defaultModel: 'openai/gpt-4o',       keyHint: '', keyPrefix: 'sk-or-' },
  { id: 'google',       name: 'Gemini',              keyEnvVar: 'GOOGLE_API_KEY',     modelEnvVar: 'GOOGLE_MODEL',    defaultModel: 'gemini-2.0-flash',    keyHint: '', keyPrefix: 'AIza' },
];

/**
 * 交互式 API 提供商和 Key 设置流程
 * 首次运行或无有效 Key 时，让用户选择大模型提供商并输入 API Key
 */
// 保存主 readline 实例，供 onAuthError 复用其 question 方法
let mainReadline: readline.Interface | null = null;

/**
 * 通过主 readline 的 question 方法读取用户输入（避免 readline 冲突）
 */
function rlQuestion(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    if (mainReadline) {
      mainReadline.question(prompt, (answer) => resolve(answer.trim()));
    } else {
      process.stdout.write(prompt);
      process.stdin.once('data', (data) => resolve(data.toString().trim()));
    }
  });
}

async function ensureApiKey(force = false): Promise<void> {
  const envPath = path.resolve(process.cwd(), '.env');

  // 非强制模式下：有 key 就跳过
  if (!force) {
    const hasAnyKey = PROVIDERS.some(p => {
      const val = process.env[p.keyEnvVar];
      return val && val.length > 8 && !val.includes('sk-test-fake');
    });
    if (hasAnyKey) return;
  }

  const ask = rlQuestion;

  console.log('\n  ┌─────────────────────────────────────────────┐');
  console.log('  │  🤖  首次使用 — 请选择 AI 模型提供商       │');
  console.log('  └─────────────────────────────────────────────┘\n');

  const maxNameLen = Math.max(...PROVIDERS.map(p => p.name.length + 2));
  console.log('请选择你要使用的 AI 模型提供商:\n');
  PROVIDERS.forEach((p, i) => {
    const namePad = p.name.padEnd(maxNameLen, ' ');
    console.log(`  ${String(i + 1).padStart(2)}. ${namePad}${p.keyHint}`);
  });
  console.log(`  ${String(PROVIDERS.length + 1).padStart(2)}. 手动编辑 .env 文件`);
  console.log(`  ${String(PROVIDERS.length + 2).padStart(2)}. 跳过，进入离线模式\n`);

  const choice = await ask(`请输入编号 (1-${PROVIDERS.length + 2}): `);
  const num = parseInt(choice.trim());

  if (isNaN(num) || num < 1 || num > PROVIDERS.length + 2) {
    console.log('  无效选项，进入离线模式。\n');
    return;
  }

  // 手动编辑模式
  if (num === PROVIDERS.length + 1) {
    console.log(`\n  请编辑 .env 文件配置 API Key:`);
    console.log(`  ${envPath}\n`);
    console.log(`  参考格式（按需选用）:`);
    console.log(`  ${'─'.repeat(40)}`);
    PROVIDERS.forEach(p => {
      console.log(`  ${p.keyEnvVar}=${p.keyHint}`);
      console.log(`  ${p.modelEnvVar}=${p.defaultModel}`);
      if (p.baseUrlEnvVar) console.log(`  ${p.baseUrlEnvVar}=${p.defaultBaseUrl}`);
      console.log(`  ${'─'.repeat(40)}`);
    });
    console.log(`  编辑完成后重新运行 fricless 即可。\n`);
    return;
  }

  // 跳过
  if (num === PROVIDERS.length + 2) {
    console.log('  已跳过，进入离线模式。\n');
    return;
  }

  // 选择了某个提供商
  const provider = PROVIDERS[num - 1];
  console.log(`\n  ── ${provider.name} ──`);
  const keyUrls: Record<string, string> = {
    anthropic: 'https://console.anthropic.com/',
    openai:    'https://platform.openai.com/api-keys',
    deepseek:  'https://platform.deepseek.com/api_keys',
    qwen:      'https://help.aliyun.com/zh/model-studio/',
    kimi:      'https://platform.moonshot.cn/console/api-keys',
    minimax:   'https://platform.minimaxi.com/',
    openrouter:'https://openrouter.ai/keys',
    google:    'https://aistudio.google.com/app/apikey',
  };
  if (keyUrls[provider.id]) console.log(`  获取 Key: ${keyUrls[provider.id]}`);
  console.log('');

  const apiKey = await ask(`  API Key (${provider.keyHint}): `);
  const trimmed = apiKey.trim();

  if (!trimmed) {
    console.log('  未输入 Key，进入离线模式。\n');
    return;
  }

  const modelInput = await ask(`  模型 (默认 ${provider.defaultModel}): `);
  const model = modelInput.trim() || provider.defaultModel;

  let baseUrl = '';
  if (provider.defaultBaseUrl) {
    const urlInput = await ask(`  API 地址 (默认 ${provider.defaultBaseUrl}): `);
    baseUrl = urlInput.trim() || provider.defaultBaseUrl;
  }

  // 保存到 .env
  try {
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }

    // 更新或追加 KEY
    const keyLine = `${provider.keyEnvVar}=${trimmed}`;
    const keyRegex = new RegExp(`^${provider.keyEnvVar}=.*`, 'm');
    if (keyRegex.test(envContent)) {
      envContent = envContent.replace(keyRegex, keyLine);
    } else {
      envContent += `${keyLine}\n`;
    }

    // 更新或追加 MODEL
    const modelLine = `${provider.modelEnvVar}=${model}`;
    const modelRegex = new RegExp(`^${provider.modelEnvVar}=.*`, 'm');
    if (modelRegex.test(envContent)) {
      envContent = envContent.replace(modelRegex, modelLine);
    } else {
      envContent += `${modelLine}\n`;
    }

    // 更新或追加 BASE URL
    if (baseUrl && provider.baseUrlEnvVar) {
      const urlLine = `${provider.baseUrlEnvVar}=${baseUrl}`;
      const urlRegex = new RegExp(`^${provider.baseUrlEnvVar}=.*`, 'm');
      if (urlRegex.test(envContent)) {
        envContent = envContent.replace(urlRegex, urlLine);
      } else {
        envContent += `${urlLine}\n`;
      }
    }

    fs.writeFileSync(envPath, envContent, 'utf-8');
    console.log(`  ✅ 配置已保存到 .env\n`);
  } catch {
    console.log('  ⚠️  无法写入 .env，Key 仅本次会话有效\n');
  }

  // 设置环境变量使当前进程生效
  process.env[provider.keyEnvVar as string] = trimmed;
  process.env[provider.modelEnvVar as string] = model;
  if (baseUrl && provider.baseUrlEnvVar) {
    process.env[provider.baseUrlEnvVar as string] = baseUrl;
  }
}

/**
 * 根据环境变量自动选择合适的 AI Provider
 * 支持: Anthropic, OpenAI, DeepSeek, Qwen, Kimi, Yi, OpenRouter, Google
 * 优先级: 按 PROVIDERS 数组顺序匹配第一个有有效 Key 的
 */
function createProviderFromEnv(): AnthropicProvider | OpenAIProvider {
  const config = loadConfig();
  const openaiVendors = ['openai', 'deepseek', 'qwen', 'kimi', 'minimax', 'openrouter', 'google'];

  for (const p of PROVIDERS) {
    const key = process.env[p.keyEnvVar] || '';
    if (key && !key.includes('sk-test-fake') && key.length > 8) {
      const model = process.env[p.modelEnvVar] || p.defaultModel;
      const baseUrl = p.baseUrlEnvVar ? (process.env[p.baseUrlEnvVar] || p.defaultBaseUrl) : undefined;

      if (openaiVendors.includes(p.id)) {
        return new OpenAIProvider({
          apiKey: key, model,
          baseUrl: baseUrl || 'https://api.openai.com/v1',
          maxTokens: config.maxTokens, vendor: p.id,
        });
      }
      return new AnthropicProvider({
        apiKey: key, model,
        baseUrl: baseUrl || undefined,
        maxTokens: config.maxTokens, vendor: p.id,
      });
    }
  }

  const fallbackKey = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '';
  if (fallbackKey) {
    return new AnthropicProvider({ apiKey: fallbackKey, model: config.anthropicModel, maxTokens: config.maxTokens });
  }
  return new AnthropicProvider({ apiKey: 'noop', model: 'noop', maxTokens: 1 });
}

async function terminalMode(): Promise<void> {
  // 先加载 .env 配置，再检查 API Key（避免 dotenv 未加载导致找不到 key）
  const config = loadConfig();
  await ensureApiKey();

  const renderer = new TerminalRenderer();
  const metrics = new MetricsCollector();
  const memoryStore = new MemoryStore();
  let permissionMode = 'auto';
  let debugModeEnabled = false;

  const sessionStore: ISessionStore = config.sessionStore === 'sqlite'
    ? new SQLiteSessionStore(config.sqlitePath)
    : new InMemorySessionStore();

  const pluginDir = process.env.PLUGIN_DIR ?? path.resolve(process.cwd(), 'plugins');
  const pluginManager = new PluginManager();
  await pluginManager.loadAll(pluginDir);

  // DeepSeek 有原生联网搜索（enable_web_search），不需要 web_search/browser/fetch 等网络工具
  const isDeepSeek = !!process.env.DEEPSEEK_API_KEY;
  const tools: AnyTool[] = [
    ...builtinTools.filter(t => !isDeepSeek || !['agent', 'task_create', 'task_get', 'task_list', 'task_update', 'task_stop', 'task_output'].includes(t.name)),
    ...pluginManager.allTools,
  ];

  // 重试处理器
  let lastUserMessage = '';
  const retryHandler = async () => {
    if (lastUserMessage && lastHarness) {
      await lastHarness.handleUserMessage(lastUserMessage);
    }
  };

  const memoryExtractor = new MemoryExtractor(memoryStore);
  const memoryInjector = new MemoryInjector(memoryStore);

  const provider = createProviderFromEnv();

  const commands: CommandDef[] = [
    pingCommand.def,
    clearCommand.def,
    createAdvisorCommand(),
    createBranchCommand(),
    createBridgeCommand(),
    createBriefCommand(),
    createChromeCommand(),
    createColorCommand(),
    createCompactCommand(),
    createConfigCommand(() => config as unknown as Record<string, unknown>),
    createContextCommand(),
    createCopyCommand(),
    createCostCommand(),
    createCtxVizCommand(),
    createDebugCommand(
      () => debugModeEnabled,
      (enabled) => { debugModeEnabled = enabled; },
    ),
    createDesktopCommand(),
    createDiffCommand(),
    createDoctorCommand(),
    createEffortCommand(),
    createEnvCommand(),
    createExitCommand(),
    createExportCommand(sessionStore),
    createExtraUsageCommand(),
    createFastCommand(),
    createFeedbackCommand(),
    createFilesCommand(),
    createGoodClaudeCommand(),
    createHistoryCommand(() => session.messages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : '',
    }))),
    createHooksCommand(),
    createIdeCommand(),
    createInitCommand(),
    createInsightsCommand(),
    createIssueCommand(),
    createKeybindingsCommand(),
    createLoadCommand(),
    createLoginCommand(),
    createLogoutCommand(),
    ...createMemoryCommands(memoryStore),
    createMobileCommand(),
    createMockLimitsCommand(),
    createModeCommand(
      () => permissionMode,
      (mode) => { permissionMode = mode; },
    ),
    createModelCommand(() => {
      const info = provider.getModelInfo();
      return { name: info.name, vendor: info.vendor, maxContextTokens: info.maxContextTokens };
    }),
    createNotebookCommand(),
    createOauthRefreshCommand(),
    createOnboardingCommand(),
    createOutputStyleCommand(),
    createPassesCommand(),
    createPerfIssueCommand(),
    createPermissionsCommand(),
    createPlanCommand(),
    createPluginCommand(),
    createPluginsCommand(() => pluginManager.loadedPlugins.map(n => { const p = pluginManager.getPlugin(n); return { name: n, version: p?.meta.version ?? '0.0.0', enabled: true, description: p?.meta.description }; })),
    createPrCommentsCommand(),
    createPrivacySettingsCommand(),
    createRateLimitOptionsCommand(),
    createReleaseNotesCommand(),
    createReloadPluginsCommand(),
    createRemoteEnvCommand(),
    createRemoteSetupCommand(),
    createRenameCommand(),
    createResetLimitsCommand(),
    createResumeCommand(),
    createRetryCommand(retryHandler),
    createReviewCommand(),
    createRewindCommand(),
    createSandboxToggleCommand(),
    createSaveCommand(),
    createSearchCommand(),
    createSecurityReviewCommand(),
    ...createSessionCommands(sessionStore),
    createShareCommand(),
    createSkillsCommand(),
    createStatsCommand(metrics, sessionStore),
    createStatusCommand(),
    createStickersCommand(),
    createSummaryCommand(),
    createSystemCommand(() => ({
      platform: os.platform(),
      arch: os.arch(),
      memory: { free: os.freemem(), total: os.totalmem() },
      uptime: os.uptime(),
      nodeVersion: process.version,
    })),
    createTagCommand(),
    createTaskCommand(),
    createTeleportCommand(),
    createTerminalSetupCommand(),
    createThinkbackCommand(),
    createTokenCommand(() => {
      let promptTokens = 0;
      let completionTokens = 0;
      for (const msg of session.messages) {
        const content = typeof msg.content === 'string' ? msg.content : '';
        const tokens = TokenCounter.estimate(content);
        if (msg.role === 'assistant') completionTokens += tokens;
        else promptTokens += tokens;
      }
      return { prompt: promptTokens, completion: completionTokens, total: promptTokens + completionTokens };
    }),
    ...createToolsCommand(() => tools),
    createUpgradeCommand(),
    createUsageCommand(),
    createVersionCommand({ version: VERSION }),
    createVimCommand(),
    createVoiceCommand(),
  ];
  commands.push(helpCommand(commands).def);
  commands.push(...pluginManager.allCommands);

  const session = new Session({
    id: 'cli-session',
    userId: 'cli-user',
    systemPrompt: '你是一个智能助手，请用中文回答用户的问题。你可以调用工具来帮助用户完成各种任务。'
      + (isDeepSeek ? '\n\n当用户询问需要最新信息的问题（如新闻、趋势、市场数据等）时，使用 web_search 工具搜索互联网获取最新资讯。对于日期时间等基础信息，使用 datetime 工具获取准确值。不要捏造信息，搜索后基于结果回答。' : ''),
  });
  sessionStore.getOrCreate({ id: session.id, userId: session.userId, systemPrompt: session.systemPrompt });

  let lastHarness: Harness | null = null;

  // readline 控制器：让 onAuthError 能暂停/恢复 CLI 输入
  let cliRl: readline.Interface | null = null;

  const harness = new Harness({
    session,
    provider,
    tools,
    commandDefs: commands,
    renderer,
    chatId: 'terminal',
    options: {
      systemPrompt: session.systemPrompt,
      maxToolRoundtrips: 10,
      maxContextTokens: config.maxContextTokens,
    },
    onAuthError: async () => {
      await ensureApiKey(true);
      await renderer.text('✅ API Key 已更新，请重新发送消息。');
    },
  });
  lastHarness = harness;

  // 注入记忆到会话
  const enriched = await memoryInjector.enrichContext([], session.userId);
  if (enriched.length > 0) {
    session.systemPrompt += '\n\n' + (enriched[0].content as string);
  }

  // 简洁启动（类似 Claude Code）
  const providerInfo = provider?.getModelInfo?.();
  const modelName = providerInfo?.name || 'unknown';
  await renderer.markdown(`**Fricless** v${VERSION}  —  \`/help\` for commands  —  ${modelName}`);

  function setupReadline(rl: readline.Interface) {
    rl.on('line', async (line: string) => {
      const text = line.trim();
      if (!text) { rl.prompt(); return; }
      if (['/quit', '/exit', '/q'].includes(text)) {
        await renderer.text('再见！');
        rl.close();
        process.exit(0);
      }
      try {
        lastUserMessage = text;
        await harness.handleUserMessage(text);
        metrics.recordMessage('terminal', 0);
        memoryExtractor.extractFromMessages(session.messages, session.id, session.userId).catch(() => {});
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await renderer.error(`处理消息时出错: ${msg}`);
      }
      rl.prompt();
    });
    rl.on('close', () => process.exit(0));
  }

  cliRl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\x1b[36m⎜ \x1b[0m',
  });
  mainReadline = cliRl;
  setupReadline(cliRl);
  cliRl.prompt();
}

// ── 飞书网关模式 ─────────────────────────────────────────

async function gatewayMode(): Promise<void> {
  const config = loadConfig();
  const metrics = new MetricsCollector();

  const pluginDir = process.env.PLUGIN_DIR ?? path.resolve(process.cwd(), 'plugins');
  const pluginManager = new PluginManager();
  await pluginManager.loadAll(pluginDir);

  const isDeepSeek = !!process.env.DEEPSEEK_API_KEY;
  const tools: AnyTool[] = [
    ...builtinTools.filter(t => !isDeepSeek || !['agent', 'task_create', 'task_get', 'task_list', 'task_update', 'task_stop', 'task_output'].includes(t.name)),
    ...pluginManager.allTools,
  ];

  const sessionStore: ISessionStore = config.sessionStore === 'sqlite'
    ? new SQLiteSessionStore(config.sqlitePath)
    : new InMemorySessionStore();

  const providerFactory = () => createProviderFromEnv();
  let permissionMode = 'auto';
  let debugModeEnabled = false;

  const allCommands: CommandDef[] = [
    pingCommand.def,
    clearCommand.def,
    createAdvisorCommand(),
    createBranchCommand(),
    createBridgeCommand(),
    createBriefCommand(),
    createChromeCommand(),
    createColorCommand(),
    createCompactCommand(),
    createConfigCommand(() => config as unknown as Record<string, unknown>),
    createContextCommand(),
    createCopyCommand(),
    createCostCommand(),
    createCtxVizCommand(),
    createDebugCommand(
      () => debugModeEnabled,
      (enabled) => { debugModeEnabled = enabled; },
    ),
    createDesktopCommand(),
    createDiffCommand(),
    createDoctorCommand(),
    createEffortCommand(),
    createEnvCommand(),
    createExitCommand(),
    createExportCommand(sessionStore),
    createExtraUsageCommand(),
    createFastCommand(),
    createFeedbackCommand(),
    createFilesCommand(),
    createGoodClaudeCommand(),
    createHistoryCommand(() => {
      const allSessions = sessionStore.getAll();
      if (allSessions.length > 0) {
        const latest = allSessions.reduce((a, b) => a.lastActiveAt > b.lastActiveAt ? a : b);
        return latest.messages.map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : '',
        }));
      }
      return [];
    }),
    createHooksCommand(),
    createIdeCommand(),
    createInitCommand(),
    createInsightsCommand(),
    createIssueCommand(),
    createKeybindingsCommand(),
    createLoadCommand(),
    createLoginCommand(),
    createLogoutCommand(),
    ...createMemoryCommands(null),
    createMobileCommand(),
    createMockLimitsCommand(),
    createModeCommand(
      () => permissionMode,
      (mode) => { permissionMode = mode; },
    ),
    createModelCommand(() => {
      const p = providerFactory();
      const info = p.getModelInfo();
      return { name: info.name, vendor: info.vendor, maxContextTokens: info.maxContextTokens };
    }),
    createNotebookCommand(),
    createOauthRefreshCommand(),
    createOnboardingCommand(),
    createOutputStyleCommand(),
    createPassesCommand(),
    createPerfIssueCommand(),
    createPermissionsCommand(),
    createPlanCommand(),
    createPluginCommand(),
    createPluginsCommand(() => pluginManager.loadedPlugins.map(n => { const p = pluginManager.getPlugin(n); return { name: n, version: p?.meta.version ?? '0.0.0', enabled: true, description: p?.meta.description }; })),
    createPrCommentsCommand(),
    createPrivacySettingsCommand(),
    createRateLimitOptionsCommand(),
    createReleaseNotesCommand(),
    createReloadPluginsCommand(),
    createRemoteEnvCommand(),
    createRemoteSetupCommand(),
    createRenameCommand(),
    createResetLimitsCommand(),
    createResumeCommand(),
    createRetryCommand(async () => {}),
    createReviewCommand(),
    createRewindCommand(),
    createSandboxToggleCommand(),
    createSaveCommand(),
    createSearchCommand(),
    createSecurityReviewCommand(),
    ...createSessionCommands(sessionStore),
    createShareCommand(),
    createSkillsCommand(),
    createStatsCommand(metrics, sessionStore),
    createStatusCommand(),
    createStickersCommand(),
    createSummaryCommand(),
    createSystemCommand(() => ({
      platform: os.platform(),
      arch: os.arch(),
      memory: { free: os.freemem(), total: os.totalmem() },
      uptime: os.uptime(),
      nodeVersion: process.version,
    })),
    createTagCommand(),
    createTaskCommand(),
    createTeleportCommand(),
    createTerminalSetupCommand(),
    createThinkbackCommand(),
    createTokenCommand(() => {
      let promptTokens = 0;
      let completionTokens = 0;
      const allSessions = sessionStore.getAll();
      for (const s of allSessions) {
        for (const msg of s.messages) {
          const content = typeof msg.content === 'string' ? msg.content : '';
          const tokens = TokenCounter.estimate(content);
          if (msg.role === 'assistant') completionTokens += tokens;
          else promptTokens += tokens;
        }
      }
      if (promptTokens === 0 && completionTokens === 0) return null;
      return { prompt: promptTokens, completion: completionTokens, total: promptTokens + completionTokens };
    }),
    ...createToolsCommand(() => tools),
    createUpgradeCommand(),
    createUsageCommand(),
    createVersionCommand({ version: VERSION }),
    createVimCommand(),
    createVoiceCommand(),
  ];
  allCommands.push(helpCommand(allCommands).def);
  allCommands.push(...pluginManager.allCommands);

  const gateway = new Gateway({
    tools,
    commands: allCommands,
    providerFactory,
    sessionStore,
    options: {
      systemPrompt: '你是一个智能助手，请用中文回答用户的问题。你可以调用工具来帮助用户完成各种任务。'
        + (isDeepSeek ? '\n\n当用户询问需要最新信息的问题（如新闻、趋势、市场数据等）时，使用 web_search 工具搜索互联网获取最新资讯。对于日期时间等基础信息，使用 datetime 工具获取准确值。不要捏造信息，搜索后基于结果回答。' : ''),
    },
  });

  const channelStatuses: { name: string; status: ChannelStatus }[] = [];

  if (!config.feishuAppId || !config.feishuAppSecret) {
    logger.error('网关模式需要设置 FEISHU_APP_ID 和 FEISHU_APP_SECRET');
    process.exit(1);
  }
  const feishuChannel = new FeishuChannel(config.feishuAppId, config.feishuAppSecret);
  gateway.registerChannel(feishuChannel);
  channelStatuses.push({ name: feishuChannel.name, status: feishuChannel.status });

  await gateway.start();
  metrics.setActiveSessions(gateway.activeSessions);

  if (config.webPanelEnabled) {
    try {
      await startServer({
        port: config.webPanelPort,
        apiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY || 'dev-key',
        sessionStore,
        metrics,
        getChannels: () => channelStatuses.map(c => ({ name: c.name, status: c.status })),
      });
    } catch (err) {
      logger.error({ err }, 'Web 管理面板启动失败');
    }
  }

  let bridgeServer: BridgeServer | undefined;
  if (config.bridgeEnabled) {
    bridgeServer = new BridgeServer({ port: config.bridgePort, authToken: config.anthropicApiKey });
    bridgeServer.onCommand = async (cmd) => {
      switch (cmd.type) {
        case 'send_message':
          logger.info({ channel: cmd.payload.channel, text: cmd.payload.text }, 'Bridge send_message');
          return { type: 'command_result' as const, success: true, data: { message: 'received' } };
        case 'clear_session':
          return {
            type: 'command_result' as const, success: true,
            data: { message: sessionStore.delete(cmd.payload.sessionId) ? 'cleared' : 'not found' },
          };
        default:
          return { type: 'command_result' as const, success: false, error: 'unhandled' };
      }
    };
    try { await bridgeServer.start(); } catch (err) { logger.error({ err }, 'Bridge 启动失败'); }
  }

  logger.info({
    tools: tools.length, commands: allCommands.length, plugins: pluginManager.count,
    channels: channelStatuses.length, server: config.webPanelEnabled, bridge: config.bridgeEnabled,
  }, 'Fricless Gateway 已就绪！');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, '收到退出信号');
    if (bridgeServer) await bridgeServer.stop();
    await gateway.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await new Promise(() => {});
}

// ── 主入口 ────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args[0] === '--help' || args[0] === '-h') {
    showHelp();
    return;
  }

  if (args[0] === '--version' || args[0] === '-v') {
    showVersion();
    return;
  }

  if (args[0] === 'gateway') {
    logger.info('启动网关模式...');
    await gatewayMode();
    return;
  }

  // 默认：交互式终端模式（类似 claude 命令）
  await terminalMode();
}

main().catch(err => {
  logger.fatal({ err }, '启动失败');
  process.exit(1);
});
