import type { AnyTool, ToolContext } from './Tool.js';

// ── 内部类型 ───────────────────────────────────────────────

type ToolStatus = 'queued' | 'executing' | 'completed' | 'error';

interface TrackedTool {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: ToolStatus;
  isConcurrencySafe: boolean;
  result?: string;
  isError?: boolean;
  promise?: Promise<void>;
  startTime: number;
  extraMessages?: import('./Tool.js').ToolResult['extraMessages'];
  newMessages?: import('./Tool.js').ToolResult['newMessages'];
}

// ── 公开事件类型 ──────────────────────────────────────────

/**
 * Tool 完成事件 — 包含执行结果以及 tool 产生的额外消息。
 * Harness 通过 onToolResult 回调接收该事件，用于渲染和日志记录。
 */
export interface ToolExecutionEvent {
  id: string;
  name: string;
  result: string;
  isError: boolean;
  /** Tool 可选追加到对话的上下文消息 */
  extraMessages?: import('./Tool.js').ToolResult['extraMessages'];
  /** Tool 产生的独立新消息 */
  newMessages?: import('./Tool.js').ToolResult['newMessages'];
}

// ── Option 类型 ────────────────────────────────────────────

export interface StreamingToolExecutorOptions {
  /** 最大并发执行数（仅对 isConcurrencySafe 的 Tool 生效） */
  maxConcurrency?: number;
  /** 每个 Tool 完成时的回调（用于实时渲染） */
  onToolResult?: (event: ToolExecutionEvent) => void;
}

// ── StreamingToolExecutor ─────────────────────────────────

/**
 * StreamingToolExecutor — 基于 Claude Code 模式的流式 Tool 执行器。
 *
 * 设计目标:
 *   1. 在流式响应到达时即可开始执行 Tool Call，无需等到流结束
 *   2. 并发安全的 Tool 可以并行执行，非安全 Tool 串行执行
 *   3. Harness 可在流结束后通过 getRemainingResults() 等待所有结果
 *
 * 执行流程（processQueue）:
 *   ┌──────────┐
 *   │  queued  │ ← addTool() 入队
 *   └────┬─────┘
 *        ▼
 *   ┌──────────┐
 *   │executing │ ← processQueue 调度开始执行
 *   └────┬─────┘
 *        ▼
 *   ┌──────────┐   ┌──────────┐
 *   │completed │   │  error   │ ← 执行完毕，触发 onToolResult
 *   └──────────┘   └──────────┘
 *
 * 并发调度规则:
 *   - isConcurrencySafe === true 的 Tool 可以任意并行
 *   - isConcurrencySafe === false 的 Tool 必须串行（独占整个队列）
 *   - 当有非安全 Tool 正在执行时，所有后续 Tool 均不启动
 */
export class StreamingToolExecutor {
  private tools: TrackedTool[] = [];
  private toolDefs: Map<string, AnyTool>;
  private ctx: ToolContext;
  private maxConcurrency: number;
  private onToolResult?: (event: ToolExecutionEvent) => void;

  constructor(
    toolDefs: AnyTool[],
    ctx: ToolContext,
    options?: StreamingToolExecutorOptions,
  ) {
    this.toolDefs = new Map(toolDefs.map(t => [t.name, t]));
    this.ctx = ctx;
    this.maxConcurrency = options?.maxConcurrency ?? 10;
    this.onToolResult = options?.onToolResult;
  }

  // ── 公共 API ─────────────────────────────────────────────

  /** 当前入队的工具总数（含 queued / executing / completed / error） */
  get toolCount(): number {
    return this.tools.length;
  }

  /** 是否还有正在执行或排队中的工具 */
  get hasPending(): boolean {
    return this.tools.some(
      t => t.status === 'queued' || t.status === 'executing',
    );
  }

  /**
   * 入队一个工具调用。
   * 如果并发条件允许，会立即通过 processQueue 开始执行。
   * 可以在流式响应进行中多次调用。
   */
  addTool(name: string, input: Record<string, unknown>, id: string): void {
    const toolDef = this.toolDefs.get(name);
    const isConcurrencySafe = toolDef?.isConcurrencySafe ?? false;

    const tracked: TrackedTool = {
      id,
      name,
      input,
      status: 'queued',
      isConcurrencySafe,
      startTime: Date.now(),
    };

    this.tools.push(tracked);
    this.processQueue();
  }

  /**
   * 同步获取当前已完成的工具结果。
   * 仍在执行或尚未开始的工具不包含在返回数组中。
   * 用于流刚结束时立即捞取已就绪的结果。
   */
  getCompletedResults(): ToolExecutionEvent[] {
    return this.tools
      .filter(t => t.status === 'completed' || t.status === 'error')
      .map(this.toEvent);
  }

  /**
   * 等待所有工具执行完毕，返回全部结果。
   * 如果还有工具在排队或执行中，此调用会阻塞直到全部完成。
   * 结果按入队顺序排列。
   */
  async getRemainingResults(): Promise<ToolExecutionEvent[]> {
    const pending = this.tools.filter(
      t => t.status === 'queued' || t.status === 'executing',
    );
    if (pending.length > 0) {
      await Promise.allSettled(pending.map(t => t.promise));
    }
    return this.tools.map(this.toEvent);
  }

  // ── 队列调度 ─────────────────────────────────────────────

  /**
   * 调度队列 — 遍历工具列表，尽可能多地启动可以执行的工具。
   *
   * Claude Code 调度策略:
   *   1. 依次检查每个 queued 状态的工具
   *   2. 如果已有非并发安全工具在执行，停止调度（等待它完成）
   *   3. 非并发安全工具需等所有执行中的工具完成后再启动
   *   4. 如果达到 maxConcurrency 上限，停止调度
   *   5. 每次启动新工具后，若它是非并发安全的，也停止调度（独占）
   *
   * 每次工具执行完毕后会再次调用 processQueue，以释放下一个工具。
   */
  private processQueue(): void {
    const executing = this.tools.filter(t => t.status === 'executing');
    const hasNonConcurrentExecuting = executing.some(t => !t.isConcurrencySafe);
    const executingCount = executing.length;

    for (const tracked of this.tools) {
      if (tracked.status !== 'queued') continue;

      // 规则 1: 有非并发安全工具正在执行时，整条队列阻塞
      if (hasNonConcurrentExecuting) break;

      // 规则 2: 非并发安全工具必须等所有其他工具执行完毕
      if (!tracked.isConcurrencySafe && executingCount > 0) continue;

      // 规则 3: 并发上限检查（仅对并发安全工具有效）
      if (tracked.isConcurrencySafe && executingCount >= this.maxConcurrency) continue;

      // ── 启动执行 ──
      tracked.status = 'executing';
      const promise = this.executeTool(tracked);
      tracked.promise = promise;

      // 工具完成后重新调度队列（下一个工具可以开始）
      promise.finally(() => this.processQueue());

      // 规则 4: 非并发安全工具独占一条通道，不再继续调度
      if (!tracked.isConcurrencySafe) break;
    }
  }

  // ── 单个工具执行 ─────────────────────────────────────────

  /**
   * 执行单个工具 — 完整的生命周期:
   *
   *   validateInput → checkPermissions → call → 结果截断 → onToolResult
   *
   * 所有异常都会被捕获并转为 error 状态，不会向上抛出。
   */
  private async executeTool(tracked: TrackedTool): Promise<void> {
    const toolDef = this.toolDefs.get(tracked.name);

    try {
      // ── 1. Tool 不存在 ────────────────────────────────
      if (!toolDef) {
        tracked.result = `错误: 工具 "${tracked.name}" 不存在。`;
        tracked.isError = true;
        tracked.status = 'error';
        this.emitResult(tracked);
        return;
      }

      // ── 2. Tool 未启用 ────────────────────────────────
      if (!toolDef.isEnabled()) {
        tracked.result = `错误: 工具 "${tracked.name}" 当前未启用。`;
        tracked.isError = true;
        tracked.status = 'error';
        this.emitResult(tracked);
        return;
      }

      // ── 3. 中断检查 ───────────────────────────────────
      if (this.ctx.signal?.aborted) {
        tracked.result = '执行已被中断';
        tracked.isError = true;
        tracked.status = 'error';
        this.emitResult(tracked);
        return;
      }

      // ── 4. 输入校验（validateInput） ──────────────────
      if (toolDef.validateInput) {
        const validation = toolDef.validateInput(tracked.input);
        if (!validation.valid) {
          tracked.result = `输入校验失败: ${validation.error}`;
          tracked.isError = true;
          tracked.status = 'error';
          this.emitResult(tracked);
          return;
        }
      }

      // ── 5. 权限检查（checkPermissions） ───────────────
      if (toolDef.checkPermissions) {
        const perm = await toolDef.checkPermissions(
          tracked.input as Parameters<typeof toolDef.call>[0],
          this.ctx,
        );
        if (!perm.allowed) {
          tracked.result = `权限不足: ${perm.reason || '无权访问'}`;
          tracked.isError = true;
          tracked.status = 'error';
          this.emitResult(tracked);
          return;
        }
      }

      // ── 6. 执行前再次中断检查 ─────────────────────────
      if (this.ctx.signal?.aborted) {
        tracked.result = '执行已被中断';
        tracked.isError = true;
        tracked.status = 'error';
        this.emitResult(tracked);
        return;
      }

      // ── 7. 实际执行 ───────────────────────────────────
      const rawResult = await toolDef.call(
        tracked.input as Parameters<typeof toolDef.call>[0],
        this.ctx,
      );

      // ── 8. 结果截断（maxResultSizeChars） ─────────────
      let resultData = rawResult.data;
      const maxChars = toolDef.maxResultSizeChars;
      if (
        maxChars &&
        typeof resultData === 'string' &&
        resultData.length > maxChars
      ) {
        resultData =
          resultData.slice(0, maxChars) +
          `\n\n[结果已截断: 原长度 ${resultData.length} 字符，保留前 ${maxChars} 字符]`;
      }

      // ── 9. 保存结构化结果 ─────────────────────────────
      tracked.result = rawResult.isError
        ? `执行出错: ${resultData}`
        : resultData;
      tracked.isError = !!rawResult.isError;
      tracked.extraMessages = rawResult.extraMessages;
      tracked.newMessages = rawResult.newMessages;
      tracked.status = 'completed';

      this.emitResult(tracked);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      tracked.result = `工具执行异常: ${msg}`;
      tracked.isError = true;
      tracked.status = 'error';
      this.emitResult(tracked);
    }
  }

  // ── 辅助方法 ─────────────────────────────────────────────

  /** 将内部 TrackedTool 转为公开的 ToolExecutionEvent */
  private toEvent = (tool: TrackedTool): ToolExecutionEvent => ({
    id: tool.id,
    name: tool.name,
    result: tool.result ?? '',
    isError: tool.isError ?? false,
    extraMessages: tool.extraMessages,
    newMessages: tool.newMessages,
  });

  /** 触发 onToolResult 回调（用于实时渲染） */
  private emitResult(tracked: TrackedTool): void {
    if (this.onToolResult) {
      try {
        this.onToolResult(this.toEvent(tracked));
      } catch {
        // 回调异常不可影响工具执行本身
      }
    }
  }
}
