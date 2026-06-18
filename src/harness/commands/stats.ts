/**
 * Stats Command — 系统统计信息
 *
 * 对应斜杠命令:
 *   /stats — 显示消息数、工具调用数、运行时长、活跃会话数
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';
import type { MetricsCollector } from '../../server/MetricsCollector.js';
import type { ISessionStore } from '../../session/ISessionStore.js';

/**
 * 创建 /stats 命令
 *
 * @param metricsCollector - 指标采集器
 * @param sessionStore - Session 存储（用于获取活跃会话数）
 */
export function createStatsCommand(
  metricsCollector: MetricsCollector,
  sessionStore: ISessionStore,
): CommandDef {
  return {
    name: 'stats',
    aliases: ['statistics'],
    description: '显示系统运行统计信息',
    usage: '/stats',
    async execute(_args: string[], ctx: CommandContext) {
      const snapshot = metricsCollector.snapshot();
      const activeSessions = sessionStore.activeCount;
      const uptimeSeconds = snapshot.uptime;
      const uptimeStr = formatUptime(uptimeSeconds);

      const lines = [
        '📊 **系统统计**',
        '---',
        `📨 总消息数: ${snapshot.messagesTotal}`,
        `🔧 工具调用数: ${countToolUsage(snapshot)}`,
        `❌ 总错误数: ${snapshot.errorsTotal}`,
        `⏱ 运行时长: ${uptimeStr}`,
        `👥 活跃会话: ${activeSessions}`,
        `📈 历史峰值: ${snapshot.peakSessions}`,
        `⚡ 平均延迟: ${snapshot.avgLatencyMs}ms`,
        '---',
        `启动时间: ${new Date(snapshot.startTime).toISOString()}`,
        `快照时间: ${snapshot.timestamp}`,
      ];
      await ctx.sendMessage(lines.join('\n'));
    },
  };
}

/** 格式化运行时长 */
function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (d > 0) parts.push(`${d} 天`);
  if (h > 0) parts.push(`${h} 小时`);
  if (m > 0) parts.push(`${m} 分`);
  parts.push(`${s} 秒`);
  return parts.join(' ');
}

/** 从快照中估计工具使用次数（按 Token 用量中的 completion count 估算） */
function countToolUsage(snapshot: { tokenUsage?: Record<string, { prompt: number; completion: number; total: number }> }): number {
  if (!snapshot.tokenUsage) return 0;
  let total = 0;
  for (const model of Object.values(snapshot.tokenUsage)) {
    total += model.completion;
  }
  return Math.round(total / 100); // 粗略估算
}
