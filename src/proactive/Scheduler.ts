/**
 * Scheduler — 基于 Cron 表达式的定时任务调度器
 *
 * 支持标准的 5 字段 Cron 表达式，用于 Fricless 的主动检查模式。
 */

import crypto from 'node:crypto';
import pino from 'pino';

const logger = pino({ name: 'scheduler' });

/** 标准 5 字段 Cron 表达式：分 时 日 月 星期 */
export type CronSchedule = string;

export interface ScheduledTask {
  id: string;
  name: string;
  cron: CronSchedule;
  handler: () => Promise<void>;
  enabled: boolean;
}

/**
 * 解析 Cron 表达式字段为数值集合
 * 支持: 数字、*、逗号分隔、步进（/）、范围（-）
 */
function parseField(field: string, min: number, max: number): Set<number> {
  const values = new Set<number>();

  // 先按逗号分割
  const parts = field.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed === '*') {
      // 全部范围
      for (let i = min; i <= max; i++) values.add(i);
    } else if (trimmed.includes('/')) {
      // 步进表达式: */5 或 1-10/2
      const [range, stepStr] = trimmed.split('/');
      const step = parseInt(stepStr, 10);
      if (isNaN(step) || step < 1) continue;

      let rangeStart = min;
      let rangeEnd = max;
      if (range !== '*' && range.includes('-')) {
        const [rs, re] = range.split('-');
        rangeStart = parseInt(rs, 10);
        rangeEnd = parseInt(re, 10);
      } else if (range !== '*') {
        rangeStart = parseInt(range, 10);
        rangeEnd = max;
      }

      if (isNaN(rangeStart) || isNaN(rangeEnd)) continue;

      for (let i = rangeStart; i <= rangeEnd; i += step) {
        if (i >= min && i <= max) values.add(i);
      }
    } else if (trimmed.includes('-')) {
      // 范围表达式: 1-5
      const [rs, re] = trimmed.split('-');
      const rStart = parseInt(rs, 10);
      const rEnd = parseInt(re, 10);
      if (!isNaN(rStart) && !isNaN(rEnd)) {
        for (let i = rStart; i <= rEnd; i++) {
          if (i >= min && i <= max) values.add(i);
        }
      }
    } else {
      // 单个数字
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num >= min && num <= max) {
        values.add(num);
      }
    }
  }

  return values;
}

/** 解析完整的 Cron 表达式为各字段的数值集合 */
function parseCron(cron: CronSchedule): {
  minutes: Set<number>;
  hours: Set<number>;
  dayOfMonth: Set<number>;
  months: Set<number>;
  dayOfWeek: Set<number>;
} {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`Invalid cron expression "${cron}": expected 5 fields, got ${fields.length}`);
  }

  return {
    minutes: parseField(fields[0], 0, 59),
    hours: parseField(fields[1], 0, 23),
    dayOfMonth: parseField(fields[2], 1, 31),
    months: parseField(fields[3], 1, 12),
    dayOfWeek: parseField(fields[4], 0, 6),
  };
}

/** 检查当前时间是否匹配 Cron 表达式 */
function matchesCron(cron: CronSchedule, now: Date = new Date()): boolean {
  try {
    const parsed = parseCron(cron);
    const minute = now.getMinutes();
    const hour = now.getHours();
    const day = now.getDate();
    const month = now.getMonth() + 1; // JS month is 0-based
    const weekDay = now.getDay(); // 0=Sun

    return (
      parsed.minutes.has(minute) &&
      parsed.hours.has(hour) &&
      parsed.months.has(month) &&
      // dayOfMonth 和 dayOfWeek 是 OR 关系
      (parsed.dayOfMonth.has(day) || parsed.dayOfWeek.has(weekDay))
    );
  } catch (err) {
    logger.warn({ cron, err }, 'Cron parse error');
    return false;
  }
}

export class Scheduler {
  private tasks: ScheduledTask[] = [];
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private tickIntervalMs = 30_000; // 每 30 秒检查一次

  /**
   * 添加一个定时任务
   * @returns 任务 ID
   */
  add(name: string, cron: CronSchedule, handler: () => Promise<void>): string {
    const id = crypto.randomUUID();
    this.tasks.push({ id, name, cron, handler, enabled: true });
    logger.info({ id, name, cron }, 'Scheduled task added');
    return id;
  }

  /**
   * 移除一个定时任务
   */
  remove(id: string): void {
    const index = this.tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      const [removed] = this.tasks.splice(index, 1);
      logger.info({ id: removed.id, name: removed.name }, 'Scheduled task removed');
    }
  }

  /**
   * 启动调度器，开始周期性检查并执行到期任务
   */
  start(): void {
    if (this.intervalHandle) {
      logger.warn('Scheduler already running');
      return;
    }
    logger.info({ taskCount: this.tasks.length, tickInterval: this.tickIntervalMs }, 'Scheduler starting');
    this.intervalHandle = setInterval(() => this.tick(), this.tickIntervalMs);
    // 立即执行一次检查
    this.tick();
  }

  /**
   * 停止调度器
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      logger.info('Scheduler stopped');
    }
  }

  /**
   * 获取所有已注册的定时任务
   */
  list(): ScheduledTask[] {
    return [...this.tasks];
  }

  /** 每次 tick 检查所有任务并执行到期的 */
  private async tick(): Promise<void> {
    const now = new Date();
    for (const task of this.tasks) {
      if (!task.enabled) continue;
      try {
        if (matchesCron(task.cron, now)) {
          logger.info({ task: task.name }, 'Executing scheduled task');
          // 异步执行，不阻塞后续任务
          task.handler().catch(err => {
            logger.error({ task: task.name, err }, 'Scheduled task handler failed');
          });
        }
      } catch (err) {
        logger.error({ task: task.name, err }, 'Error checking scheduled task');
      }
    }
  }

  /** 获取当前所有任务的快照（用于测试/调试） */
  getTaskSnapshot(): Array<{ id: string; name: string; cron: string; enabled: boolean }> {
    return this.tasks.map(t => ({ id: t.id, name: t.name, cron: t.cron, enabled: t.enabled }));
  }
}
