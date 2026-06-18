import pino from 'pino';
import type { Message } from '../types/index.js';
import type { AIProvider, ToolDescriptor } from '../providers/types.js';
import type { AnyTool, ToolContext } from './Tool.js';
import type { CommandDef } from './Command.js';
import type { Renderer } from '../render/RenderLayer.js';
import type { ToolExecutionEvent } from './StreamingToolExecutor.js';
import { Command } from './Command.js';
import { Session } from '../session/Session.js';
import { TokenCounter } from './TokenCounter.js';
import { StreamingToolExecutor } from './StreamingToolExecutor.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', name: 'harness' });

// Claude Code constants (direct copy)
const MAX_RECOVERY_ATTEMPTS = 3;
const ESCALATED_MAX_TOKENS = 64000;
const MAX_OUTPUT_TOKENS_DEFAULT = 32000;
const CAPPED_DEFAULT_MAX_TOKENS = 8000;
const MAX_CONSECUTIVE_COMPACT_FAILURES = 3;

// ── State Machine Types (Claude Code-style) ───────────────

/** 非终端状态转移原因 — 对话循环继续 */
type ContinueReason = 'next_turn' | 'max_output_tokens_recovery';

/** 终端状态转移原因 — 对话循环结束 */
type TerminalReason = 'completed' | 'max_turns' | 'model_error' | 'blocking_limit';

/** 对话循环状态 */
interface ConversationState {
  turnCount: number;
  maxOutputTokensRecoveryCount: number;
  hasAttemptedReactiveCompact: boolean;
  transition?: { reason: ContinueReason } | { reason: TerminalReason };
}

/** 对话循环结果 */
interface ConversationResult {
  reason: TerminalReason;
  turnCount: number;
}

/** Claude Code-style: 显式转移原因（内部使用） */
type TransitionReason = ContinueReason | TerminalReason;

// ── Harness 选项 ─────────────────────────────────────────

export interface HarnessOptions {
  /** 系统提示词 */
  systemPrompt?: string;
  /** 允许的最大连续 Tool Call 次数（防止循环） */
  maxToolRoundtrips?: number;
  /** 最大上下文 Token 数 */
  maxContextTokens?: number;
}

// ── 内部辅助类型 ─────────────────────────────────────────

interface StreamOutput {
  assistantContent: string;
  streamError: string | null;
  /** 原始错误消息（用于分类判断，如认证错误） */
  rawError: string | null;
}

/**
 * Harness — 对话循环引擎
 *
 * 这是整个系统的核心，类比 Claude Code 的对话循环。
 * 职责:
 * 1. 解析用户输入（检测是否为斜杠命令）
 * 2. 管理 AI Provider 的请求/响应流（含流式输出 + 自动重试）
 * 3. 执行 Tool Call 并返回结果给 AI（通过 StreamingToolExecutor 支持并行）
 * 4. 管理对话上下文（Token 窗口修剪）
 * 5. 中断处理（AbortSignal）
 * 6. Tool 结果截断
 * 7. B2 确认流程
 * 8. Tool 产生的额外消息注入
 */
export class Harness {
  private session: Session;
  private provider: AIProvider;
  private tools: AnyTool[];
  private commands: Command[];
  private options: Required<HarnessOptions>;
  private renderer: Renderer;
  private chatId: string;
  private abortController: AbortController;
  private onAuthError?: () => Promise<void>;

  constructor(params: {
    session: Session;
    provider: AIProvider;
    tools: AnyTool[];
    commandDefs: CommandDef[];
    renderer: Renderer;
    chatId: string;
    options?: HarnessOptions;
    /** API 认证失败时触发，可用于让用户重新输入 Key */
    onAuthError?: () => Promise<void>;
  }) {
    this.session = params.session;
    this.provider = params.provider;
    this.tools = params.tools;
    this.commands = params.commandDefs.map(d => new Command(d));
    this.renderer = params.renderer;
    this.chatId = params.chatId;
    this.abortController = new AbortController();
    this.onAuthError = params.onAuthError;
    this.options = {
      systemPrompt: params.options?.systemPrompt ?? '你是一个智能助手，请用中文回答用户的问题。',
      maxToolRoundtrips: params.options?.maxToolRoundtrips ?? 10,
      maxContextTokens: params.options?.maxContextTokens ?? 32000,
    };
  }

  // ── 公共接口 ─────────────────────────────────────────────

  /** 中断当前正在执行的 Tool 调用 */
  abort(): void {
    this.abortController.abort();
    // 每次中断后重置，以便后续正常使用
    this.abortController = new AbortController();
  }

  /** 处理用户输入的主入口 */
  async handleUserMessage(text: string): Promise<void> {
    logger.info({ sessionId: this.session.id, text }, '处理用户消息');

    // Step 1: 检查是否为斜杠命令
    if (text.startsWith('/')) {
      await this.handleCommand(text);
      return;
    }

    // Step 2: 添加用户消息到上下文
    this.session.addMessage({ role: 'user', content: text });

    // Step 3: 运行 AI 对话循环（State Machine 驱动）
    const result = await this.runConversationLoop();
    logger.debug({ result }, '对话循环结束');
  }

  // ── 命令处理 ─────────────────────────────────────────────

  /** 处理斜杠命令 */
  private async handleCommand(raw: string): Promise<void> {
    const matched = this.commands.find(c => c.matches(raw));

    if (!matched) {
      const cmdName = raw.replace(/^\//, '').trim().split(/\s+/)[0];
      await this.renderer.text(`未知命令: /${cmdName}。输入 /help 查看可用命令。`);
      return;
    }

    // 特殊处理 /clear: 需要清空 session
    if (matched.name === 'clear') {
      this.session.clearMessages();
    }

    await matched.execute(raw, {
      sessionId: this.session.id,
      userId: this.session.userId,
      chatId: this.chatId,
      sendMessage: (content) => this.renderer.text(content),
    });
  }

  // ── AI 对话主循环（State Machine 模式） ─────────────────

  /**
   * AI 对话主循环 — 基于 Claude Code 风格的状态机。
   *
   * 状态流转:
   * ┌──────────┐
   * │  next    │ ← 每轮开始，turnCount++
   * └────┬─────┘
   *      ▼
   * ┌──────────┐      ┌──────────────┐
   * │ stream() │ ──→  │ model_error  │ (Terminal)
   * └────┬─────┘      └──────────────┘
   *      ▼
   * ┌──────────┐      ┌──────────────┐
   * │has tools?│ ──→  │ completed    │ (Terminal, 无 Tool)
   * └────┬─────┘      └──────────────┘
   *      ▼
   * ┌──────────┐
   * │ execute  │ ← 通过 StreamingToolExecutor 执行
   * └────┬─────┘
   *      ▼
   * ┌──────────┐      ┌──────────────────┐
   * │ recovery?│ ──→  │ max_output_      │ (空结果恢复)
   * │  check   │      │ tokens_recovery  │
   * └────┬─────┘      └──────────────────┘
   *      ▼
   * ┌──────────┐      ┌──────────────┐
   * │max turns?│ ──→  │ max_turns    │ (Terminal)
   * └────┬─────┘      └──────────────┘
   *      ▼
   * ┌──────────┐
   * │  next    │ ← ContinueReason.next_turn
   * └──────────┘
   */
  private async runConversationLoop(): Promise<ConversationResult> {
    const state: ConversationState = {
      turnCount: 0,
      maxOutputTokensRecoveryCount: 0,
      hasAttemptedReactiveCompact: false,
    };

    while (state.turnCount < this.options.maxToolRoundtrips) {
      state.turnCount++;

      // ── 1. 获取上下文消息（含 Token 窗口修剪） ──────────
      const contextMessages = this.getContextMessages();

      // ── 2. 获取可用的 Tool 描述 ──────────────────────────
      const toolDescriptors = this.getToolDescriptors();

      // ── 3. 创建 StreamingToolExecutor ────────────────────
      const signal = this.abortController.signal;
      const ctx: ToolContext = {
        sessionId: this.session.id,
        userId: this.session.userId,
        chatId: this.chatId,
        sendMessage: (content) => this.renderer.text(content),
        signal,
      };

      const executor = new StreamingToolExecutor(this.tools, ctx, {
        onToolResult: (event) => {
          this.renderer.toolResult(event.name, event.result, event.isError).catch(() => {});
        },
      });

      // ── 4. 从 AI Provider 流式获取响应（含自动重试） ────
      const { assistantContent, streamError, rawError } =
        await this.streamWithRetry(contextMessages, toolDescriptors, executor);

      // ── 5. 检查流错误 → TerminalReason.model_error ──────
      if (streamError) {
        await this.renderer.error(streamError);
        // 认证错误：触发重新配置流程
        if (this.onAuthError && rawError && isAuthError(rawError)) {
          await this.onAuthError();
        }
        state.transition = { reason: 'model_error' };
        return { reason: 'model_error', turnCount: state.turnCount };
      }

      // ── 6. 收集所有 Tool 执行结果 ────────────────────────
      const allToolResults: ToolExecutionEvent[] = executor.toolCount > 0
        ? await executor.getRemainingResults()
        : [];

      // ── 7. 无 Tool Use → TerminalReason.completed ───────
      if (allToolResults.length === 0) {
        if (assistantContent) {
          this.session.addMessage({ role: 'assistant', content: assistantContent });
        }
        state.transition = { reason: 'completed' };
        return { reason: 'completed', turnCount: state.turnCount };
      }

      // ── 8a. 连续搜索限制（DeepSeek 兼容） ────────────────
      // DeepSeek 不擅长判断何时停止搜索。连续 6 次以上网络工具 → 强制回答
      const networkTools = ['web_search', 'web_browser', 'web_fetch'];
      let searchCount = 0;
      for (let i = this.session.messages.length - 1; i >= 0; i--) {
        const m = this.session.messages[i];
        if (m.role === 'tool' && m.toolName && networkTools.includes(m.toolName)) searchCount++;
        else if (m.role === 'assistant' && m.content && m.content.length > 10) break;
      }
      if (searchCount >= 6) {
        await this.renderer.text('我已有足够信息，现在为你整理回答。');
        const finalStream = this.provider.stream(
          this.getContextMessages().concat([{ role: 'user', content: '直接回答用户的问题，不要调用任何工具。请基于已有信息给出完整回答。' }]),
          [],
        );
        let finalContent = '';
        for await (const ev of finalStream) {
          if (ev.type === 'text') { finalContent += ev.delta; await this.renderer.streamText(ev.delta, false); }
          if (ev.type === 'done') { await this.renderer.streamText('', true); this.session.addMessage({ role: 'assistant', content: finalContent }); break; }
        }
        state.transition = { reason: 'completed' };
        return { reason: 'completed', turnCount: state.turnCount };
      }

      // ── 8b. 空/低质量结果恢复检测（Claude Code 模式） ────
      // 连续两次所有 Tool 返回空或错误 → 进入恢复路径，强制最终回答
      const isEmptyResult = (r: string) =>
        !r || r.trim().length < 5 || r.includes('输入校验失败') || r.includes('搜索失败');
      const allEmpty = allToolResults.every(tr => isEmptyResult(tr.result) || tr.isError);

      if (allEmpty) {
        state.maxOutputTokensRecoveryCount++;
        if (state.maxOutputTokensRecoveryCount >= 2) {
          state.hasAttemptedReactiveCompact = true;
          await this.renderer.text('我已有足够信息，现在为你整理回答。');
          // 不带 Tool 重新请求，强制模型直接回答
          const finalStream = this.provider.stream(
            this.getContextMessages().concat([
              { role: 'user', content: '直接回答用户的问题，不要调用任何工具。' },
            ]),
            [],
          );
          let finalContent = '';
          for await (const ev of finalStream) {
            if (ev.type === 'text') {
              finalContent += ev.delta;
              await this.renderer.streamText(ev.delta, false);
            }
            if (ev.type === 'done') {
              await this.renderer.streamText('', true);
              this.session.addMessage({ role: 'assistant', content: finalContent });
              state.transition = { reason: 'completed' };
              return { reason: 'completed', turnCount: state.turnCount };
            }
          }
          state.transition = { reason: 'completed' };
          return { reason: 'completed', turnCount: state.turnCount };
        }
      } else {
        state.maxOutputTokensRecoveryCount = 0;
      }

      // ── 9. 记录本轮结果到会话上下文 ─────────────────────
      const toolNames = allToolResults.map(r => r.name).join(', ');
      this.session.addMessage({
        role: 'assistant',
        content: assistantContent || `[调用工具: ${toolNames}]`,
      });

      for (const tr of allToolResults) {
        this.session.addMessage({
          role: 'tool',
          content: tr.result,
          toolCallId: tr.id,
          toolName: tr.name,
        });

        // 注入 Tool 产生的额外上下文消息
        if (tr.extraMessages) {
          for (const msg of tr.extraMessages) {
            this.session.addMessage(msg);
          }
        }

        // 注入 Tool 产生的独立新消息
        if (tr.newMessages) {
          for (const msg of tr.newMessages) {
            this.session.addMessage(msg);
          }
        }
      }

      // ── 10. 检查是否达到最大轮次 → TerminalReason.max_turns ──
      if (state.turnCount >= this.options.maxToolRoundtrips) {
        await this.renderer.error(
          '⚠️ 对话步骤过多，请简化你的问题或使用 /clear 重新开始。',
        );
        state.transition = { reason: 'max_turns' };
        return { reason: 'max_turns', turnCount: state.turnCount };
      }

      // ── 11. 继续下一轮 → ContinueReason.next_turn ─────────
      state.transition = { reason: 'next_turn' };
    }

    // 循环条件退出（防御性返回）
    return { reason: 'max_turns', turnCount: state.turnCount };
  }

  // ── Provider 流式处理（含重试） ─────────────────────────

  /**
   * 从 Provider 流式获取响应，非致命错误自动重试（最多 2 次重试）。
   *
   * 重试判定:
   *   - 网络超时 / 速率限制 / 临时服务不可用 → 重试
   *   - 认证错误 / 请求格式错误 / 权限问题 → 不重试，直接返回错误
   */
  private async streamWithRetry(
    messages: Message[],
    tools: ToolDescriptor[],
    executor: StreamingToolExecutor,
  ): Promise<StreamOutput> {
    const maxRetries = 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.processStream(messages, tools, executor);
      } catch (err) {
        lastError = err;
        const isNonFatal = this.isRetryableError(err);

        if (attempt < maxRetries && isNonFatal) {
          logger.warn({ err, attempt }, 'Provider 流错误，正在重试...');
          await this.renderer.text(`(网络波动，正在重试第 ${attempt + 1} 次...)`);
          continue;
        }

        const msg = err instanceof Error ? err.message : String(err);
        logger.error(msg);
        return {
          assistantContent: '',
          streamError: sanitizeErrorMessage(msg),
          rawError: msg,
        };
      }
    }

    // 不会执行到这里
    const lastMsg = lastError instanceof Error ? lastError.message : String(lastError);
    return {
      assistantContent: '',
      streamError: sanitizeErrorMessage(lastMsg),
      rawError: lastMsg,
    };
  }

  /** 处理单次 Provider 流 */
  private async processStream(
    messages: Message[],
    tools: ToolDescriptor[],
    executor: StreamingToolExecutor,
  ): Promise<StreamOutput> {
    const stream = this.provider.stream(messages, tools);
    let assistantContent = '';

    for await (const event of stream) {
      switch (event.type) {
        case 'text': {
          assistantContent += event.delta;
          await this.renderer.streamText(event.delta, false);
          break;
        }
        case 'tool_use': {
          // 将工具调用加入 StreamingToolExecutor（并发安全工具可立即开始执行）
          executor.addTool(event.name, event.input, event.id);
          await this.renderer.toolUse(event.name, event.input);
          break;
        }
        case 'tool_result': {
          // Provider 直接返回 tool result（非标准流程）
          break;
        }
        case 'error': {
          // 关闭流并抛出错误，由 streamWithRetry 决定是否重试
          await this.renderer.streamText('', true);
          logger.error(event.message);
          throw new Error(event.message);
        }
        case 'done': {
          // 流正常结束
          break;
        }
      }
    }

    // 通知渲染器流结束
    await this.renderer.streamText('', true);

    return { assistantContent, streamError: null, rawError: null };
  }

  /** 判断错误是否可重试 */
  private isRetryableError(err: unknown): boolean {
    if (err instanceof Error) {
      const msg = err.message.toLowerCase();

      // 不可重试的错误模式
      if (msg.includes('auth') || msg.includes('unauthorized') || msg.includes('api key')) return false;
      if (msg.includes('invalid') && !msg.includes('timeout')) return false;
      if (msg.includes('not found')) return false;
      if (msg.includes('permission') || msg.includes('forbidden')) return false;
      if (msg.includes('invalid_request')) return false;

      // 其余（超时、速率限制、服务不可用等）可以重试
      return true;
    }
    // 未知错误默认可重试
    return true;
  }

  // ── 上下文管理 ─────────────────────────────────────────

  /** 获取上下文消息（含系统提示 + Token 窗口修剪） */
  private getContextMessages(): Message[] {
    const msgs: Message[] = [];

    // 系统提示
    if (this.options.systemPrompt) {
      msgs.push({ role: 'system', content: this.options.systemPrompt });
    }

    // Token 预算（系统提示占用一部分）
    const systemTokens = this.countTokens(this.options.systemPrompt);
    let budget = this.options.maxContextTokens - systemTokens - 1000; // 1000 token 输出预留
    if (budget <= 0) budget = 4000;

    // 从最新的消息开始反向遍历，填满 Token 预算
    const reversedMessages: Message[] = [];
    for (let i = this.session.messages.length - 1; i >= 0; i--) {
      const msg = this.session.messages[i];
      const tokens = this.countTokens(
        typeof msg.content === 'string'
          ? msg.content
          : msg.content.map(c => c.text || '').join(' '),
      );
      if (tokens > budget) break;
      reversedMessages.unshift(msg);
      budget -= tokens;
    }

    msgs.push(...reversedMessages);
    return msgs;
  }

  /** 估算 Token 数（委托给 TokenCounter 实现字符感知估算） */
  private countTokens(text: string): number {
    return TokenCounter.estimate(text) + 4;
  }

  /** 获取 Tool 描述（给 Provider 的 Schema） */
  private getToolDescriptors(): ToolDescriptor[] {
    return this.tools
      .filter(t => t.isEnabled())
      .map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.jsonSchema,
      }));
  }
}

// ── 工具函数 ───────────────────────────────────────────────

/**
 * 清洗错误消息，将 API 原始错误转为用户友好的提示。
 * 用户不需要看到 401 原始报文，只需知道 API Key 有问题即可。
 */
function sanitizeErrorMessage(msg: string): string {
  const lower = msg.toLowerCase();

  // API Key 认证错误
  if (lower.includes('401') || lower.includes('authentication_error') || lower.includes('invalid x-api-key') || lower.includes('unauthorized')) {
    return 'Anthropic API Key 无效。请检查 ANTHROPIC_API_KEY 环境变量或用 /config 重新设置。';
  }

  // 速率限制
  if (lower.includes('429') || lower.includes('rate_limit') || lower.includes('too many requests')) {
    return '请求过于频繁，请稍后再试。';
  }

  // 余额不足
  if (lower.includes('billing') || lower.includes('credit') || lower.includes('insufficient_quota')) {
    return 'API 余额不足，请检查 https://console.anthropic.com/ 的账单。';
  }

  // 模型不存在或已弃用
  if (lower.includes('model not found') || lower.includes('not found') && lower.includes('model')) {
    return '指定的模型不可用，请检查 ANTHROPIC_MODEL 配置。';
  }

  // 上下文超长
  if (lower.includes('too large') || lower.includes('too long') || lower.includes('max_tokens')) {
    return '上下文过长，请使用 /clear 清空对话后重试。';
  }

  // 超时
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'AI 响应超时，请重试。';
  }

  // Schema 错误（一般是 tool schema 格式问题）
  if (lower.includes('invalid schema') || lower.includes('400')) {
    return 'AI 模型拒绝请求: 工具参数格式异常。请重试或使用 /clear 清空上下文。';
  }

  // 截断原始错误到合理长度
  return `AI 响应出错: ${msg.slice(0, 200)}`;
}

/** 判断错误是否为 API 认证错误 */
function isAuthError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return lower.includes('401') || lower.includes('authentication_error') || lower.includes('invalid x-api-key') || lower.includes('unauthorized') || lower.includes('missing credentials');
}
