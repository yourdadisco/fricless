/**
 * Fricless 错误类层次
 *
 * 类比 Claude Code 的错误处理模式。
 * 所有业务异常继承自 FriclessError，携带 code、context 等结构化信息。
 */

export class FriclessError extends Error {
  readonly code: string;
  readonly context?: Record<string, unknown>;
  readonly cause?: Error;

  constructor(code: string, message: string, opts?: { cause?: Error; context?: Record<string, unknown> }) {
    super(message);
    this.name = 'FriclessError';
    this.code = code;
    this.cause = opts?.cause;
    this.context = opts?.context;
  }
}

/** Harness 对话循环错误 */
export class HarnessError extends FriclessError {
  constructor(message: string, opts?: { cause?: Error; context?: Record<string, unknown> }) {
    super('HARNESS_ERROR', message, opts);
    this.name = 'HarnessError';
  }
}

/** Tool 执行错误 */
export class ToolExecutionError extends FriclessError {
  readonly toolName: string;

  constructor(toolName: string, message: string, opts?: { cause?: Error; context?: Record<string, unknown> }) {
    super('TOOL_EXECUTION_ERROR', `[${toolName}] ${message}`, opts);
    this.name = 'ToolExecutionError';
    this.toolName = toolName;
  }
}

/** Provider (AI 模型) 错误 */
export class ProviderError extends FriclessError {
  readonly vendor: string;

  constructor(vendor: string, message: string, opts?: { cause?: Error; context?: Record<string, unknown> }) {
    super('PROVIDER_ERROR', `[${vendor}] ${message}`, opts);
    this.name = 'ProviderError';
    this.vendor = vendor;
  }
}

/** 通道错误 */
export class ChannelError extends FriclessError {
  readonly channelName: string;

  constructor(channelName: string, message: string, opts?: { cause?: Error; context?: Record<string, unknown> }) {
    super('CHANNEL_ERROR', `[${channelName}] ${message}`, opts);
    this.name = 'ChannelError';
    this.channelName = channelName;
  }
}

/** Session 错误 */
export class SessionError extends FriclessError {
  readonly sessionId?: string;

  constructor(message: string, opts?: { cause?: Error; context?: Record<string, unknown>; sessionId?: string }) {
    super('SESSION_ERROR', message, opts);
    this.name = 'SessionError';
    this.sessionId = opts?.sessionId;
  }
}

/** 速率限制错误 */
export class RateLimitError extends FriclessError {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number, message?: string) {
    super('RATE_LIMIT', message ?? `请求过于频繁，请在 ${Math.ceil(retryAfterMs / 1000)} 秒后重试`);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/** 配置错误 */
export class ConfigError extends FriclessError {
  constructor(key: string, message: string) {
    super('CONFIG_ERROR', `配置错误 [${key}]: ${message}`);
    this.name = 'ConfigError';
  }
}
