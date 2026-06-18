/**
 * ProactiveEngine — 主动检查引擎
 *
 * Fricless 的主动模式核心，允许系统在不需要用户触发的情况下，
 * 按预设的 Cron 计划主动向 AI Provider 发送检查提示并处理结果。
 *
 * 典型用途:
 *   - 定期检查外部数据源变化
 *   - 定时生成报告/摘要
 *   - 预设的主动提醒
 */

import pino from 'pino';
import { Scheduler } from './Scheduler.js';
import type { AIProvider } from '../providers/types.js';
import type { Message } from '../types/index.js';

const logger = pino({ name: 'proactive-engine' });

export interface ProactiveEngineOptions {
  /** AI Provider 实例 */
  provider: AIProvider;
  /** 可选：系统提示词，用于所有主动检查 */
  systemPrompt?: string;
  /** 可选：主动检查完成后的回调 */
  onCheckResult?: (name: string, result: string) => Promise<void>;
  /** 可选：错误处理回调 */
  onError?: (name: string, err: Error) => Promise<void>;
}

export class ProactiveEngine {
  readonly scheduler = new Scheduler();
  private running = false;
  private provider: AIProvider;
  private systemPrompt: string;
  private onCheckResult?: (name: string, result: string) => Promise<void>;
  private onError?: (name: string, err: Error) => Promise<void>;

  constructor(private options: ProactiveEngineOptions) {
    this.provider = options.provider;
    this.systemPrompt = options.systemPrompt ?? '你是一个主动检查助手。根据给定的提示进行信息检查并返回结果。';
    this.onCheckResult = options.onCheckResult;
    this.onError = options.onError;
  }

  /**
   * 启动主动检查引擎
   *
   * 启动内部的 Scheduler，开始按预设任务执行周期性检查。
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn('ProactiveEngine is already running');
      return;
    }
    this.running = true;
    this.scheduler.start();
    logger.info('ProactiveEngine started');
  }

  /**
   * 停止主动检查引擎
   *
   * 停止 Scheduler 的所有定时任务。
   */
  async stop(): Promise<void> {
    if (!this.running) {
      logger.warn('ProactiveEngine is not running');
      return;
    }
    this.scheduler.stop();
    this.running = false;
    logger.info('ProactiveEngine stopped');
  }

  /**
   * 添加一个周期性检查任务
   *
   * @param name - 任务名称（用于日志和回调识别）
   * @param cron - 标准 5 字段 Cron 表达式
   * @param prompt - 发送给 AI Provider 的检查提示
   */
  addPeriodicCheck(name: string, cron: string, prompt: string): void {
    const handler = async (): Promise<void> => {
      try {
        logger.info({ name }, 'Executing proactive check');
        const result = await this.runCheck(prompt);
        logger.info({ name, resultLength: result.length }, 'Proactive check completed');

        if (this.onCheckResult) {
          await this.onCheckResult(name, result).catch(err => {
            logger.error({ name, err }, 'onCheckResult callback failed');
          });
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error({ name, err: error }, 'Proactive check failed');

        if (this.onError) {
          await this.onError(name, error).catch(err => {
            logger.error({ name, err }, 'onError callback failed');
          });
        }
      }
    };

    this.scheduler.add(name, cron, handler);
    logger.info({ name, cron, prompt: prompt.substring(0, 100) }, 'Periodic check added');
  }

  /** 当前是否正在运行 */
  get isRunning(): boolean {
    return this.running;
  }

  // ── 私有方法 ──────────────────────────────────────────

  /** 向 Provider 发送检查提示并获取结果 */
  private async runCheck(prompt: string): Promise<string> {
    const messages: Message[] = [];

    if (this.systemPrompt) {
      messages.push({ role: 'system', content: this.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const stream = this.provider.stream(messages, []);
    let content = '';
    for await (const event of stream) {
      if (event.type === 'text') {
        content += event.delta;
      }
    }
    return content.trim();
  }
}
