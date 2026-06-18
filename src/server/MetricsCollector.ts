/**
 * MetricsCollector — 用量 / 性能指标采集器
 *
 * 收集全局运行时指标：消息量、错误数、Token 用量、活跃 Session 等。
 * 数据由 Server 面板 REST API 消费，也可用于 Bridge 事件推送。
 */

export interface MetricsSnapshot {
  /** 启动时间戳 */
  startTime: number;
  /** 总处理消息数 */
  messagesTotal: number;
  /** 消息数按通道分类 */
  messagesByChannel: Record<string, number>;
  /** 总错误次数 */
  errorsTotal: number;
  /** 错误数按类型分类 */
  errorsByType: Record<string, number>;
  /** Token 用量按模型分类 */
  tokenUsage: Record<string, { prompt: number; completion: number; total: number }>;
  /** 平均延迟 ms */
  avgLatencyMs: number;
  /** 当前活跃 Session 数 */
  activeSessions: number;
  /** 历史峰值并发 */
  peakSessions: number;
  /** 运行时长（秒） */
  uptime: number;
  /** 快照时间戳 */
  timestamp: string;
}

export class MetricsCollector {
  private startTime = Date.now();
  private messagesTotal = 0;
  private messagesByChannel: Record<string, number> = {};
  private errorsTotal = 0;
  private errorsByType: Record<string, number> = {};
  private tokenUsage: Record<string, { prompt: number; completion: number; total: number }> = {};
  private latencies: number[] = [];
  private _peakSessions = 0;
  private _activeSessions = 0;
  private readonly maxLatencySamples = 1000;

  /** 记录一条已处理消息 */
  recordMessage(channel: string, latencyMs: number): void {
    this.messagesTotal++;
    this.messagesByChannel[channel] = (this.messagesByChannel[channel] ?? 0) + 1;
    this.latencies.push(latencyMs);
    if (this.latencies.length > this.maxLatencySamples) {
      this.latencies.shift();
    }
  }

  /** 记录一个错误 */
  recordError(type: string): void {
    this.errorsTotal++;
    this.errorsByType[type] = (this.errorsByType[type] ?? 0) + 1;
  }

  /** 记录一次 Token 用量 */
  recordTokenUsage(model: string, prompt: number, completion: number): void {
    const existing = this.tokenUsage[model] ?? { prompt: 0, completion: 0, total: 0 };
    existing.prompt += prompt;
    existing.completion += completion;
    existing.total += prompt + completion;
    this.tokenUsage[model] = existing;
  }

  /** 更新活跃 Session 数 */
  setActiveSessions(n: number): void {
    this._activeSessions = n;
    if (n > this._peakSessions) {
      this._peakSessions = n;
    }
  }

  /** 获取当前快照 */
  snapshot(): MetricsSnapshot {
    const avgLatencyMs =
      this.latencies.length > 0
        ? Math.round(this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length)
        : 0;

    return {
      startTime: this.startTime,
      messagesTotal: this.messagesTotal,
      messagesByChannel: { ...this.messagesByChannel },
      errorsTotal: this.errorsTotal,
      errorsByType: { ...this.errorsByType },
      tokenUsage: Object.fromEntries(
        Object.entries(this.tokenUsage).map(([k, v]) => [k, { ...v }]),
      ),
      avgLatencyMs,
      activeSessions: this._activeSessions,
      peakSessions: this._peakSessions,
      uptime: (Date.now() - this.startTime) / 1000,
      timestamp: new Date().toISOString(),
    };
  }

  /** 重置所有计数（用于测试） */
  reset(): void {
    this.startTime = Date.now();
    this.messagesTotal = 0;
    this.messagesByChannel = {};
    this.errorsTotal = 0;
    this.errorsByType = {};
    this.tokenUsage = {};
    this.latencies = [];
    this._peakSessions = 0;
    this._activeSessions = 0;
  }
}
