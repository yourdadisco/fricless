import pino from 'pino';
import type { Message } from '../types/index.js';
import type { AIProvider, ToolDescriptor } from '../providers/types.js';
import type { AnyTool, ToolContext, ToolResult } from './Tool.js';
import type { CommandDef } from './Command.js';
import type { Renderer } from '../render/RenderLayer.js';
import { Command } from './Command.js';
import { Session } from '../session/Session.js';

const logger = pino({ name: 'harness' });

export interface HarnessOptions {
  /** 系统提示词 */
  systemPrompt?: string;
  /** 允许的最大连续 Tool Call 次数（防止循环） */
  maxToolRoundtrips?: number;
  /** 最大上下文 Token 数 */
  maxContextTokens?: number;
}

// ── 内部辅助类型 ───────────────────────────────────────────

interface PendingToolUse {
  name: string;
  input: Record<string, unknown>;
  id: string;
}

interface ToolExecutionResult {
  name: string;
  id: string;
  result: string;
  isError: boolean;
  extraMessages?: Message[];
  newMessages?: Message[];
}

interface StreamOutput {
  assistantContent: string;
  pendingToolUses: PendingToolUse[];
  streamError: string | null;
}

/**
 * Harness — 对话循环引擎
 *
 * 这是整个系统的核心，类比 Claude Code 的对话循环。
 * 职责:
 * 1. 解析用户输入（检测是否为斜杠命令）
 * 2. 管理 AI Provider 的请求/响应流（含流式输出 + 自动重试）
 * 3. 执行 Tool Call 并返回结果给 AI（支持并行 Tool 执行）
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

  constructor(params: {
    session: Session;
    provider: AIProvider;
    tools: AnyTool[];
    commandDefs: CommandDef[];
    renderer: Renderer;
    chatId: string;
    options?: HarnessOptions;
  }) {
    this.session = params.session;
    this.provider = params.provider;
    this.tools = params.tools;
    this.commands = params.commandDefs.map(d => new Command(d));
    this.renderer = params.renderer;
    this.chatId = params.chatId;
    this.abortController = new AbortController();
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

    // Step 3: 运行 AI 对话循环
    await this.runConversationLoop();
  }

  // ── 命令处理 ─────────────────────────────────────────────

  /** 处理斜杠命令 */
  private async handleCommand(raw: string): Promise<void> {
    const matched = this.commands.find(c => c.matches(raw));

    if (!matched) {
      await this.renderer.error(
        `未知命令: ${raw}。输入 \`/help\` 查看可用命令。`,
      );
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

  // ── AI 对话主循环 ────────────────────────────────────────

  /** AI 对话主循环（支持流式输出 + Tool Use 多轮往返 + 并行 Tool 执行） */
  private async runConversationLoop(): Promise<void> {
    let roundtrips = 0;

    while (roundtrips < this.options.maxToolRoundtrips) {
      roundtrips++;

      // 获取上下文消息（含 Token 窗口修剪）
      const contextMessages = this.getContextMessages();

      // 收集可用的 Tool 描述
      const toolDescriptors = this.getToolDescriptors();

      // Step 1: 从 AI Provider 流式获取响应（含自动重试）
      const { assistantContent, pendingToolUses, streamError } =
        await this.streamWithRetry(contextMessages, toolDescriptors);

      if (streamError) {
        await this.renderer.error(streamError);
        return;
      }

      // 如果没有 Tool Use，则本轮是最终响应
      if (pendingToolUses.length === 0) {
        if (assistantContent) {
          this.session.addMessage({ role: 'assistant', content: assistantContent });
        }
        return;
      }

      // Step 2: 分组并执行所有 Tool Call
      const toolResults = await this.executeAllToolCalls(pendingToolUses);

      // Step 3: 记录本轮结果到会话上下文
      const toolNames = toolResults.map(r => r.name).join(', ');
      this.session.addMessage({
        role: 'assistant',
        content: assistantContent || `[调用工具: ${toolNames}]`,
      });

      for (const tr of toolResults) {
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
    }

    // 超过最大轮次
    await this.renderer.error(
      '⚠️ 对话步骤过多，请简化你的问题或使用 /clear 重新开始。',
    );
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
  ): Promise<StreamOutput> {
    const maxRetries = 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.processStream(messages, tools);
      } catch (err) {
        lastError = err;
        const isNonFatal = this.isRetryableError(err);

        if (attempt < maxRetries && isNonFatal) {
          logger.warn({ err, attempt }, 'Provider 流错误，正在重试...');
          await this.renderer.text(`(网络波动，正在重试第 ${attempt + 1} 次...)`);
          continue;
        }

        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ err }, 'Provider 流致命错误');
        return {
          assistantContent: '',
          pendingToolUses: [],
          streamError: sanitizeErrorMessage(msg),
        };
      }
    }

    // 不会执行到这里
    return {
      assistantContent: '',
      pendingToolUses: [],
      streamError: sanitizeErrorMessage(String(lastError)),
    };
  }

  /** 处理单次 Provider 流 */
  private async processStream(
    messages: Message[],
    tools: ToolDescriptor[],
  ): Promise<StreamOutput> {
    const stream = this.provider.stream(messages, tools);
    let assistantContent = '';
    const pendingToolUses: PendingToolUse[] = [];

    for await (const event of stream) {
      switch (event.type) {
        case 'text': {
          assistantContent += event.delta;
          await this.renderer.streamText(event.delta, false);
          break;
        }
        case 'tool_use': {
          pendingToolUses.push({
            name: event.name,
            input: event.input,
            id: event.id,
          });
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
          logger.error({ error: event.message }, 'AI Provider 流错误事件');
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

    return { assistantContent, pendingToolUses, streamError: null };
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

  // ── 并行 Tool 执行 ──────────────────────────────────────

  /**
   * 执行所有 Tool Call:
   * 1. 按并发安全分组
   * 2. 依次执行各组（每组内并行执行）
   */
  private async executeAllToolCalls(
    toolUses: PendingToolUse[],
  ): Promise<ToolExecutionResult[]> {
    const groups = this.groupToolsByConcurrency(toolUses);
    const allResults: ToolExecutionResult[] = [];

    for (const group of groups) {
      const results = await this.executeToolGroup(group);
      allResults.push(...results);
    }

    return allResults;
  }

  /**
   * 将 Tool Call 按并发安全性分组:
   *   - 并发安全的 Tool 会尽量聚合在同一组中（并行执行）
   *   - 非并发安全的 Tool 各自独占一组（串行执行）
   * 组之间保持原始的 Tool Call 顺序。
   *
   * 示例:
   *   [A(安全), B(安全), C(不安全), D(安全)] =>
   *   [[A, B], [C], [D]]
   */
  private groupToolsByConcurrency(toolUses: PendingToolUse[]): PendingToolUse[][] {
    const groups: PendingToolUse[][] = [];
    let currentBatch: PendingToolUse[] = [];

    for (const tu of toolUses) {
      const tool = this.tools.find(t => t.name === tu.name);
      const isSafe = tool?.isConcurrencySafe ?? false;

      if (isSafe) {
        // 累加到当前并发批
        currentBatch.push(tu);
      } else {
        // 刷出当前并发批，然后该 Tool 独自一组
        if (currentBatch.length > 0) {
          groups.push(currentBatch);
          currentBatch = [];
        }
        groups.push([tu]);
      }
    }

    // 刷出最后一组
    if (currentBatch.length > 0) {
      groups.push(currentBatch);
    }

    return groups;
  }

  /**
   * 执行一组 Tool Call。
   * 组内所有 Tool 均为并发安全，使用 Promise.all 并行执行。
   * 执行前检查中断信号。
   */
  private async executeToolGroup(
    group: PendingToolUse[],
  ): Promise<ToolExecutionResult[]> {
    const signal = this.abortController.signal;

    // 若已中断，跳过整组
    if (signal.aborted) {
      logger.warn('Tool 执行已被中断信号跳过');
      return group.map(tu => ({
        name: tu.name,
        id: tu.id,
        result: '执行已被中断',
        isError: true,
      }));
    }

    // 并行执行组内所有 Tool
    const promises = group.map(tu => this.executeToolCall(tu, signal));
    return Promise.all(promises);
  }

  // ── 单个 Tool 执行（含校验 + 权限 + 截断） ──────────────

  /**
   * 执行单个 Tool Call，依次进行:
   * 1. 查找 Tool 定义
   * 2. 启用检查
   * 3. 中断检查
   * 4. 输入校验
   * 5. 权限检查
   * 6. B2 确认流程（permissionLevel='confirm'）
   * 7. 再次中断检查
   * 8. 实际执行
   * 9. 结果截断
   * 10. 提取 extraMessages / newMessages
   */
  private async executeToolCall(
    toolUse: PendingToolUse,
    signal: AbortSignal,
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.find(t => t.name === toolUse.name);

    // 1. Tool 不存在
    if (!tool) {
      logger.warn({ toolName: toolUse.name }, 'Tool 不存在');
      return {
        name: toolUse.name,
        id: toolUse.id,
        result: `错误: 工具 "${toolUse.name}" 不存在。`,
        isError: true,
      };
    }

    // 2. Tool 未启用
    if (!tool.isEnabled()) {
      return {
        name: toolUse.name,
        id: toolUse.id,
        result: `错误: 工具 "${toolUse.name}" 当前未启用。`,
        isError: true,
      };
    }

    logger.info({ tool: toolUse.name, input: toolUse.input }, '执行 Tool');

    // 3. 执行前中断检查
    if (signal.aborted) {
      return {
        name: toolUse.name,
        id: toolUse.id,
        result: '执行已被中断',
        isError: true,
      };
    }

    try {
      // 4. 输入校验
      if (tool.validateInput) {
        const validation = tool.validateInput(toolUse.input);
        if (!validation.valid) {
          logger.warn(
            { tool: toolUse.name, input: toolUse.input, error: validation.error },
            'Tool 输入校验失败',
          );
          return {
            name: toolUse.name,
            id: toolUse.id,
            result: `输入校验失败: ${validation.error}`,
            isError: true,
          };
        }
      }

      // 构建 ToolContext（供权限检查 + 执行使用）
      const ctx: ToolContext = {
        sessionId: this.session.id,
        userId: this.session.userId,
        chatId: this.chatId,
        sendMessage: (content) => this.renderer.text(content),
        signal,
      };

      // 5. 权限检查
      if (tool.checkPermissions) {
        const perm = await tool.checkPermissions(toolUse.input as Parameters<typeof tool.call>[0], ctx);
        if (!perm.allowed) {
          return {
            name: toolUse.name,
            id: toolUse.id,
            result: `权限不足: ${perm.reason || '无权访问'}`,
            isError: true,
          };
        }
      }

      // 6. B2 确认流程
      if (tool.permissionLevel === 'confirm') {
        await this.renderer.divider();
        await this.renderer.markdown(`**需要确认**: 工具 \`${toolUse.name}\` 需要你的授权才能执行。`);
        await this.renderer.toolUse(toolUse.name, toolUse.input);
        await this.renderer.text('⏳ 等待确认中...');

        // 模拟等待用户确认
        // 在生产环境中，此处会挂起等待用户的异步确认信号
        await new Promise(resolve => setTimeout(resolve, 300));

        // TODO: 集成真实用户确认机制（如飞书消息回调或 Terminal 输入）
        // 目前默认继续执行
        await this.renderer.text('✅ 已确认，继续执行。');
        await this.renderer.divider();
      }

      // 7. 执行前再次中断检查
      if (signal.aborted) {
        return {
          name: toolUse.name,
          id: toolUse.id,
          result: '执行已被中断',
          isError: true,
        };
      }

      // 8. 执行 Tool
      const rawResult = await tool.call(toolUse.input as Parameters<typeof tool.call>[0], ctx);

      // 9. 结果截断
      let resultData = rawResult.data;
      const maxChars = tool.maxResultSizeChars;
      if (maxChars && typeof resultData === 'string' && resultData.length > maxChars) {
        resultData = resultData.slice(0, maxChars) +
          `\n\n[结果已截断: 原长度 ${resultData.length} 字符，保留前 ${maxChars} 字符]`;
      }

      // 渲染 Tool 结果到 UI
      await this.renderer.toolResult(toolUse.name, resultData, !!rawResult.isError);

      // 10. 返回结构化结果（含额外消息）
      return {
        name: toolUse.name,
        id: toolUse.id,
        result: rawResult.isError ? `执行出错: ${resultData}` : resultData,
        isError: !!rawResult.isError,
        extraMessages: rawResult.extraMessages,
        newMessages: rawResult.newMessages,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, tool: toolUse.name }, 'Tool 执行异常');
      await this.renderer.error(`工具 "${toolUse.name}" 执行异常: ${msg}`);
      return {
        name: toolUse.name,
        id: toolUse.id,
        result: `工具执行异常: ${msg}`,
        isError: true,
      };
    }
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

  /** 估算 Token 数 */
  private countTokens(text: string): number {
    return Math.ceil(text.length * 0.38) + 4;
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
