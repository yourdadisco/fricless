/**
 * Tasks Command — 任务管理面板
 *
 * 对应斜杠命令:
 *   /tasks — 显示任务管理总览
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createTasksCommand(
  getTaskSummary?: () => { total: number; active: number; completed: number; failed: number },
): CommandDef {
  return {
    name: 'tasks',
    aliases: ['task-list', 'all-tasks', 'task-overview'],
    description: '显示所有任务的概览',
    usage: '/tasks',
    async execute(_args: string[], ctx: CommandContext) {
      if (getTaskSummary) {
        const summary = getTaskSummary();
        const lines = [
          '📋 **任务总览**',
          '---',
          `总计: ${summary.total}`,
          `🟢 进行中: ${summary.active}`,
          `✅ 已完成: ${summary.completed}`,
          `❌ 失败: ${summary.failed}`,
          '---',
          '使用 \`/task list\` 查看详细任务列表。',
        ];
        await ctx.sendMessage(lines.join('\n'));
      } else {
        await ctx.sendMessage(
          '📋 **任务总览**\n---\n' +
          '总计: 0\n' +
          '暂无任务。使用 \`/task create <描述>\` 创建任务。',
        );
      }
    },
  };
}
