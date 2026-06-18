/**
 * Init Command — 初始化项目配置
 *
 * 对应斜杠命令:
 *   /init [project-name] — 初始化项目配置文件
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createInitCommand(
  initProject?: (name?: string) => Promise<{ success: boolean; path?: string; message: string }>,
): CommandDef {
  return {
    name: 'init',
    aliases: ['initialize', 'setup-project', 'bootstrap'],
    description: '在当前目录初始化项目配置',
    usage: '/init [项目名称]',
    async execute(args: string[], ctx: CommandContext) {
      const projectName = args.join(' ').trim() || undefined;

      if (initProject) {
        try {
          const result = await initProject(projectName);
          if (result.success) {
            await ctx.sendMessage(
              `✅ 项目已初始化${result.path ? ` at \`${result.path}\`` : ''}。\n${result.message}`,
            );
          } else {
            await ctx.sendMessage(`❌ 初始化失败: ${result.message}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`初始化失败: ${msg}`);
        }
      } else {
        await ctx.sendMessage(
          '✅ **项目初始化（模拟）**\n---\n' +
          `项目名称: ${projectName || '未命名'}\n` +
          '已创建: .claude/settings.json\n' +
          '运行 /help 查看可用命令。',
        );
      }
    },
  };
}
