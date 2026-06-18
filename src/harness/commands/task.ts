/**
 * Task Command — 管理任务（list / create / stop）
 *
 * 对应斜杠命令:
 *   /task list — 列出任务
 *   /task create <描述> — 创建任务
 *   /task stop <id> — 停止任务
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /task 命令
 *
 * @param taskManager - 任务管理器接口
 */
export function createTaskCommand(
  taskManager?: {
    list: () => { id: string; description: string; status: string; createdAt: Date }[];
    create: (description: string) => Promise<string>;
    stop: (id: string) => Promise<void>;
  },
): CommandDef {
  return {
    name: 'task',
    aliases: ['tasks', 'job'],
    description: '管理任务（list / create / stop）',
    usage: '/task <list|create|stop> [参数]',
    async execute(args: string[], ctx: CommandContext) {
      const subcommand = args[0]?.toLowerCase();

      if (!subcommand) {
        await ctx.sendMessage([
          '📋 **任务管理**',
          '---',
          '子命令:',
          '  • `/task list` — 列出所有任务',
          '  • `/task create <描述>` — 创建新任务',
          '  • `/task stop <id>` — 停止任务',
        ].join('\n'));
        return;
      }

      if (subcommand === 'list' || subcommand === 'ls') {
        const tasks = taskManager?.list() ?? [
          { id: '1', description: '示例任务 1', status: 'running', createdAt: new Date() },
          { id: '2', description: '示例任务 2', status: 'completed', createdAt: new Date() },
        ];

        if (tasks.length === 0) {
          await ctx.sendMessage('当前没有任务。');
          return;
        }

        const lines = [
          '📋 **任务列表**',
          '---',
          ...tasks.map(t => {
            const statusIcon = t.status === 'running' ? '🟢' : t.status === 'completed' ? '✅' : '🔴';
            const time = t.createdAt.toLocaleString();
            return `${statusIcon} \`${t.id}\`: ${t.description} (${t.status}) — ${time}`;
          }),
        ];
        await ctx.sendMessage(lines.join('\n'));
        return;
      }

      if (subcommand === 'create' || subcommand === 'add') {
        const description = args.slice(1).join(' ').trim();
        if (!description) {
          await ctx.sendMessage('请提供任务描述。用法: `/task create <描述>`');
          return;
        }

        if (!taskManager) {
          await ctx.sendMessage(`✅ 任务已创建（模拟）: "${description}"`);
          return;
        }

        try {
          const id = await taskManager.create(description);
          await ctx.sendMessage(`✅ 任务已创建: \`${id}\``);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`创建任务失败: ${msg}`);
        }
        return;
      }

      if (subcommand === 'stop' || subcommand === 'kill' || subcommand === 'cancel') {
        const id = args[1]?.trim();
        if (!id) {
          await ctx.sendMessage('请提供任务 ID。用法: `/task stop <id>`');
          return;
        }

        if (!taskManager) {
          await ctx.sendMessage(`🛑 任务 \`${id}\` 已停止（模拟）。`);
          return;
        }

        try {
          await taskManager.stop(id);
          await ctx.sendMessage(`🛑 任务 \`${id}\` 已停止。`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`停止任务失败: ${msg}`);
        }
        return;
      }

      await ctx.sendMessage(`未知子命令 "${subcommand}"。可用: list, create, stop`);
    },
  };
}
